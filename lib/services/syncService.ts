import { supabase, isSupabaseConfigured } from './supabase';
import { storage } from './storage';
import { CloudData, SYNCABLE_KEYS, SyncableKey } from '../types/sync';

export interface SyncResult {
	success: boolean;
	uploaded: string[];
	downloaded: string[];
	errors: string[];
}

export interface CloudBackup {
	id: string;
	created_at: string;
}

class SyncService {
	private isSyncing = false;

	/**
	 * Checks if cloud sync is available
	 */
	isAvailable(): boolean {
		return isSupabaseConfigured();
	}

	/**
	 * Gets the current user ID from Supabase
	 */
	private async getUserId(): Promise<string | null> {
		if (!supabase) return null;

		const { data: { user } } = await supabase.auth.getUser();
		return user?.id ?? null;
	}

	/**
	 * Performs a full sync of all data types
	 */
	async syncAll(): Promise<SyncResult> {
		if (this.isSyncing) {
			return { success: false, uploaded: [], downloaded: [], errors: ['Sync already in progress'] };
		}

		if (!supabase) {
			return { success: false, uploaded: [], downloaded: [], errors: ['Supabase not configured'] };
		}

		const userId = await this.getUserId();
		if (!userId) {
			return { success: false, uploaded: [], downloaded: [], errors: ['Not authenticated'] };
		}

		this.isSyncing = true;
		const result: SyncResult = { success: true, uploaded: [], downloaded: [], errors: [] };

		try {
			// Get all cloud data timestamps
			const { data: cloudData, error: fetchError } = await supabase
				.from('user_data')
				.select('data_type, updated_at')
				.eq('user_id', userId);

			if (fetchError) {
				throw new Error(`Failed to fetch cloud data: ${fetchError.message}`);
			}

			const cloudTimestamps: Record<string, Date> = {};
			for (const item of cloudData || []) {
				cloudTimestamps[item.data_type] = new Date(item.updated_at);
			}

			// Get local timestamps
			const localTimestamps = await storage.getTimestamps();

			// Sync each data type
			for (const key of SYNCABLE_KEYS) {
				try {
					const localTs = localTimestamps[key] ? new Date(localTimestamps[key]) : null;
					const cloudTs = cloudTimestamps[key] || null;

					if (!localTs && !cloudTs) {
						// No data anywhere, skip
						continue;
					}

					if (localTs && (!cloudTs || localTs > cloudTs)) {
						// Local is newer, upload
						await this.uploadDataType(key, userId);
						result.uploaded.push(key);
					} else if (cloudTs && (!localTs || cloudTs > localTs)) {
						// Cloud is newer, download
						await this.downloadDataType(key, userId);
						result.downloaded.push(key);
					}
					// If timestamps are equal, no action needed
				} catch (error) {
					const message = error instanceof Error ? error.message : 'Unknown error';
					result.errors.push(`${key}: ${message}`);
				}
			}

			result.success = result.errors.length === 0;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			result.errors.push(message);
			result.success = false;
		} finally {
			this.isSyncing = false;
		}

		return result;
	}

	/**
	 * Uploads a single data type to the cloud
	 */
	async uploadDataType(key: SyncableKey, userId?: string): Promise<void> {
		if (!supabase) throw new Error('Supabase not configured');

		const uid = userId || await this.getUserId();
		if (!uid) throw new Error('Not authenticated');

		const data = await storage.getRawItem(key);
		if (!data) return; // Nothing to upload

		const now = new Date().toISOString();

		const { error } = await supabase
			.from('user_data')
			.upsert({
				user_id: uid,
				data_type: key,
				encrypted_data: data,
				updated_at: now,
			}, {
				onConflict: 'user_id,data_type',
			});

		if (error) {
			throw new Error(`Failed to upload ${key}: ${error.message}`);
		}
	}

	/**
	 * Downloads a single data type from the cloud
	 */
	async downloadDataType(key: SyncableKey, userId?: string): Promise<void> {
		if (!supabase) throw new Error('Supabase not configured');

		const uid = userId || await this.getUserId();
		if (!uid) throw new Error('Not authenticated');

		const { data, error } = await supabase
			.from('user_data')
			.select('encrypted_data, updated_at')
			.eq('user_id', uid)
			.eq('data_type', key)
			.single();

		if (error) {
			if (error.code === 'PGRST116') {
				// No data found, nothing to download
				return;
			}
			throw new Error(`Failed to download ${key}: ${error.message}`);
		}

		if (data) {
			await storage.setRawItemWithTimestamp(key, data.encrypted_data, data.updated_at);
		}
	}

	/**
	 * Uploads all local data to the cloud (for initial sync)
	 * Creates a backup of existing cloud data before uploading
	 */
	async uploadAll(): Promise<SyncResult> {
		if (!supabase) {
			return { success: false, uploaded: [], downloaded: [], errors: ['Supabase not configured'] };
		}

		const userId = await this.getUserId();
		if (!userId) {
			return { success: false, uploaded: [], downloaded: [], errors: ['Not authenticated'] };
		}

		const result: SyncResult = { success: true, uploaded: [], downloaded: [], errors: [] };

		// Create backup before uploading
		const backupCreated = await this.createBackup();
		if (!backupCreated) {
			console.warn('Could not create backup, but continuing with upload');
		}

		for (const key of SYNCABLE_KEYS) {
			try {
				const data = await storage.getRawItem(key);
				if (data) {
					await this.uploadDataType(key, userId);
					result.uploaded.push(key);
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Unknown error';
				result.errors.push(`${key}: ${message}`);
			}
		}

		result.success = result.errors.length === 0;
		return result;
	}

	/**
	 * Downloads all cloud data to local (for initial sync on new device)
	 */
	async downloadAll(): Promise<SyncResult> {
		if (!supabase) {
			return { success: false, uploaded: [], downloaded: [], errors: ['Supabase not configured'] };
		}

		const userId = await this.getUserId();
		if (!userId) {
			return { success: false, uploaded: [], downloaded: [], errors: ['Not authenticated'] };
		}

		const result: SyncResult = { success: true, uploaded: [], downloaded: [], errors: [] };

		const { data: cloudData, error } = await supabase
			.from('user_data')
			.select('*')
			.eq('user_id', userId);

		if (error) {
			return { success: false, uploaded: [], downloaded: [], errors: [error.message] };
		}

		for (const item of cloudData || []) {
			try {
				await storage.setRawItemWithTimestamp(
					item.data_type,
					item.encrypted_data,
					item.updated_at
				);
				result.downloaded.push(item.data_type);
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Unknown error';
				result.errors.push(`${item.data_type}: ${message}`);
			}
		}

		result.success = result.errors.length === 0;
		return result;
	}

	/**
	 * Checks if the user has any data in the cloud
	 */
	async hasCloudData(): Promise<boolean> {
		if (!supabase) return false;

		const userId = await this.getUserId();
		if (!userId) return false;

		const { count, error } = await supabase
			.from('user_data')
			.select('*', { count: 'exact', head: true })
			.eq('user_id', userId);

		if (error) return false;
		return (count || 0) > 0;
	}

	/**
	 * Deletes all cloud data for the current user
	 */
	async deleteAllCloudData(): Promise<boolean> {
		if (!supabase) return false;

		const userId = await this.getUserId();
		if (!userId) return false;

		const { error } = await supabase
			.from('user_data')
			.delete()
			.eq('user_id', userId);

		return !error;
	}

	// ==================== BACKUP METHODS ====================

	/**
	 * Creates a backup of current cloud data before upload
	 */
	async createBackup(): Promise<boolean> {
		if (!supabase) return false;

		const userId = await this.getUserId();
		if (!userId) return false;

		try {
			// Get all current cloud data
			const { data: cloudData, error: fetchError } = await supabase
				.from('user_data')
				.select('data_type, encrypted_data, updated_at')
				.eq('user_id', userId);

			if (fetchError) {
				console.error('Failed to fetch cloud data for backup:', fetchError);
				return false;
			}

			// Only create backup if there's data to backup
			if (!cloudData || cloudData.length === 0) {
				return true; // No data to backup, but not an error
			}

			// Create backup object
			const backupData: Record<string, { encrypted_data: string; updated_at: string }> = {};
			for (const item of cloudData) {
				backupData[item.data_type] = {
					encrypted_data: item.encrypted_data,
					updated_at: item.updated_at,
				};
			}

			// Insert backup
			const { error: insertError } = await supabase
				.from('user_data_backups')
				.insert({
					user_id: userId,
					backup_data: backupData,
				});

			if (insertError) {
				console.error('Failed to create backup:', insertError);
				return false;
			}

			// Delete old backups (keep only 3)
			await this.deleteOldBackups(userId);

			return true;
		} catch (error) {
			console.error('Backup error:', error);
			return false;
		}
	}

	/**
	 * Deletes backups older than the newest 3
	 */
	private async deleteOldBackups(userId: string): Promise<void> {
		if (!supabase) return;

		// Get all backups sorted by date
		const { data: backups, error } = await supabase
			.from('user_data_backups')
			.select('id, created_at')
			.eq('user_id', userId)
			.order('created_at', { ascending: false });

		if (error || !backups) return;

		// Delete all but the newest 3
		if (backups.length > 3) {
			const toDelete = backups.slice(3).map(b => b.id);
			await supabase
				.from('user_data_backups')
				.delete()
				.in('id', toDelete);
		}
	}

	/**
	 * Gets list of available backups (max 3)
	 */
	async getBackups(): Promise<CloudBackup[]> {
		if (!supabase) return [];

		const userId = await this.getUserId();
		if (!userId) return [];

		const { data, error } = await supabase
			.from('user_data_backups')
			.select('id, created_at')
			.eq('user_id', userId)
			.order('created_at', { ascending: false })
			.limit(3);

		if (error) {
			console.error('Failed to get backups:', error);
			return [];
		}

		return data || [];
	}

	/**
	 * Restores a backup to cloud (overwrites current cloud data)
	 */
	async restoreBackup(backupId: string): Promise<SyncResult> {
		if (!supabase) {
			return { success: false, uploaded: [], downloaded: [], errors: ['Supabase not configured'] };
		}

		const userId = await this.getUserId();
		if (!userId) {
			return { success: false, uploaded: [], downloaded: [], errors: ['Not authenticated'] };
		}

		const result: SyncResult = { success: true, uploaded: [], downloaded: [], errors: [] };

		try {
			// Get backup data
			const { data: backup, error: fetchError } = await supabase
				.from('user_data_backups')
				.select('backup_data')
				.eq('id', backupId)
				.eq('user_id', userId)
				.single();

			if (fetchError || !backup) {
				return { success: false, uploaded: [], downloaded: [], errors: ['Backup nicht gefunden'] };
			}

			const backupData = backup.backup_data as Record<string, { encrypted_data: string; updated_at: string }>;

			// Restore each data type to cloud
			for (const [dataType, data] of Object.entries(backupData)) {
				try {
					const { error } = await supabase
						.from('user_data')
						.upsert({
							user_id: userId,
							data_type: dataType,
							encrypted_data: data.encrypted_data,
							updated_at: data.updated_at,
						}, {
							onConflict: 'user_id,data_type',
						});

					if (error) {
						result.errors.push(`${dataType}: ${error.message}`);
					} else {
						result.uploaded.push(dataType);
					}
				} catch (error) {
					const message = error instanceof Error ? error.message : 'Unknown error';
					result.errors.push(`${dataType}: ${message}`);
				}
			}

			// Now download all restored data to local
			const downloadResult = await this.downloadAll();
			result.downloaded = downloadResult.downloaded;
			if (downloadResult.errors.length > 0) {
				result.errors.push(...downloadResult.errors);
			}

			result.success = result.errors.length === 0;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			result.errors.push(message);
			result.success = false;
		}

		return result;
	}
}

export const syncService = new SyncService();
export default syncService;
