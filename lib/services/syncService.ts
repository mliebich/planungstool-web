import { supabase, isSupabaseConfigured } from './supabase';
import { storage } from './storage';
import { CloudData, SYNCABLE_KEYS, SyncableKey } from '../types/sync';

export interface SyncResult {
	success: boolean;
	uploaded: string[];
	downloaded: string[];
	errors: string[];
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
}

export const syncService = new SyncService();
export default syncService;
