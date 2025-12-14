import { openDB, IDBPDatabase } from 'idb';
import EncryptionService from './encryption';
import { LocalTimestamps, SYNCABLE_KEYS, SyncableKey } from '../types/sync';

const DB_NAME = 'planungstool';
const DB_VERSION = 1;
const STORE_NAME = 'data';
const TIMESTAMPS_KEY = 'localTimestamps';

// Keys die verschlüsselt werden
const ENCRYPTED_KEYS = [
	'lessons',
	'themes',
	'blockages',
	'students',
	'classes',
	'coachingSessions',
	'coachingTags',
	'exams',
	'examResults',
	'customClassColors',
	'materialUsages',
	'importedEvents',
];

const PASSWORD_CHECK_KEY = 'passwordCheck';
const PASSWORD_CHECK_VALUE = 'VALID';

/**
 * Browser Storage Service mit IndexedDB und Verschlüsselung
 */
class BrowserStorage {
	private db: IDBPDatabase | null = null;
	private password: string | null = null;
	private initPromise: Promise<void> | null = null;

	/**
	 * Initialisiert die IndexedDB
	 */
	private async init(): Promise<void> {
		if (this.db) return;

		// Verhindere mehrfache Initialisierung
		if (this.initPromise) {
			await this.initPromise;
			return;
		}

		this.initPromise = (async () => {
			this.db = await openDB(DB_NAME, DB_VERSION, {
				upgrade(db) {
					if (!db.objectStoreNames.contains(STORE_NAME)) {
						db.createObjectStore(STORE_NAME);
					}
				},
			});
		})();

		await this.initPromise;
	}

	/**
	 * Prüft ob ein Key verschlüsselt werden soll
	 */
	private shouldEncrypt(key: string): boolean {
		return ENCRYPTED_KEYS.includes(key);
	}

	/**
	 * Setzt das Passwort für Ver-/Entschlüsselung
	 */
	setPassword(password: string): void {
		this.password = password;
	}

	/**
	 * Entfernt das Passwort aus dem Memory
	 */
	clearPassword(): void {
		this.password = null;
		EncryptionService.clearKeyCache();
	}

	/**
	 * Prüft ob ein Passwort gesetzt ist
	 */
	hasPasswordInMemory(): boolean {
		return this.password !== null;
	}

	/**
	 * Speichert Daten
	 */
	async setItem(key: string, value: string): Promise<void> {
		await this.init();
		if (!this.db) throw new Error('Database not initialized');

		try {
			if (this.shouldEncrypt(key)) {
				if (!this.password) {
					throw new Error('Kein Passwort gesetzt - kann nicht verschlüsseln');
				}
				const encrypted = EncryptionService.encrypt(value, this.password);
				await this.db.put(STORE_NAME, encrypted, key);
			} else {
				await this.db.put(STORE_NAME, value, key);
			}

			// Update timestamp for syncable keys
			if (SYNCABLE_KEYS.includes(key as SyncableKey)) {
				await this.updateTimestamp(key);
			}
		} catch (error) {
			console.error(`Fehler beim Speichern von ${key}:`, error);
			throw error;
		}
	}

	/**
	 * Lädt Daten
	 */
	async getItem(key: string): Promise<string | null> {
		await this.init();
		if (!this.db) throw new Error('Database not initialized');

		try {
			const value = await this.db.get(STORE_NAME, key);

			if (value === undefined || value === null) {
				return null;
			}

			if (this.shouldEncrypt(key)) {
				if (!this.password) {
					throw new Error('Kein Passwort gesetzt - kann nicht entschlüsseln');
				}

				// Prüfe ob verschlüsselt (Format: salt:iv:ciphertext)
				if (typeof value === 'string' && value.includes(':') && value.split(':').length === 3) {
					const decrypted = EncryptionService.decrypt(value, this.password);
					return typeof decrypted === 'string' ? decrypted : JSON.stringify(decrypted);
				} else {
					// Unverschlüsselte Daten (Migration)
					return value;
				}
			}

			return value;
		} catch (error) {
			console.error(`Fehler beim Laden von ${key}:`, error);
			throw error;
		}
	}

	/**
	 * Löscht Daten
	 */
	async removeItem(key: string): Promise<void> {
		await this.init();
		if (!this.db) throw new Error('Database not initialized');

		await this.db.delete(STORE_NAME, key);
	}

	/**
	 * Richtet das Passwort ein
	 */
	async setupPassword(password: string): Promise<void> {
		await this.init();
		if (!this.db) throw new Error('Database not initialized');

		const encrypted = EncryptionService.encrypt(PASSWORD_CHECK_VALUE, password);
		await this.db.put(STORE_NAME, encrypted, PASSWORD_CHECK_KEY);
		this.password = password;
	}

	/**
	 * Validiert das Passwort
	 */
	async validatePassword(password: string): Promise<boolean> {
		await this.init();
		if (!this.db) throw new Error('Database not initialized');

		try {
			const encrypted = await this.db.get(STORE_NAME, PASSWORD_CHECK_KEY);

			if (!encrypted) return false;

			const decrypted = EncryptionService.decrypt(encrypted, password);
			return decrypted === PASSWORD_CHECK_VALUE;
		} catch {
			return false;
		}
	}

	/**
	 * Prüft ob bereits ein Passwort existiert
	 */
	async hasPassword(): Promise<boolean> {
		await this.init();
		if (!this.db) throw new Error('Database not initialized');

		const encrypted = await this.db.get(STORE_NAME, PASSWORD_CHECK_KEY);
		return encrypted !== undefined && encrypted !== null;
	}

	/**
	 * Migriert unverschlüsselte Daten
	 */
	async migrateUnencryptedData(): Promise<void> {
		if (!this.password) {
			throw new Error('Kein Passwort gesetzt');
		}

		await this.init();
		if (!this.db) throw new Error('Database not initialized');

		for (const key of ENCRYPTED_KEYS) {
			try {
				const value = await this.db.get(STORE_NAME, key);

				if (value === undefined || value === null) continue;

				// Prüfe ob bereits verschlüsselt
				if (typeof value === 'string' && value.includes(':') && value.split(':').length === 3) {
					try {
						EncryptionService.decrypt(value, this.password);
						continue; // Bereits verschlüsselt
					} catch {
						// Nicht verschlüsselt, migrieren
					}
				}

				// Verschlüssele
				const encrypted = EncryptionService.encrypt(value, this.password);
				await this.db.put(STORE_NAME, encrypted, key);
			} catch (error) {
				console.error(`Fehler bei Migration von ${key}:`, error);
			}
		}
	}

	/**
	 * Setzt alle Daten zurück
	 */
	async resetAllData(): Promise<void> {
		await this.init();
		if (!this.db) throw new Error('Database not initialized');

		const keysToDelete = [PASSWORD_CHECK_KEY, ...ENCRYPTED_KEYS];

		for (const key of keysToDelete) {
			await this.db.delete(STORE_NAME, key);
		}

		this.clearPassword();
	}

	/**
	 * Gibt alle Keys zurück
	 */
	async getAllKeys(): Promise<string[]> {
		await this.init();
		if (!this.db) throw new Error('Database not initialized');

		return this.db.getAllKeys(STORE_NAME) as Promise<string[]>;
	}

	/**
	 * Löscht alles
	 */
	async clear(): Promise<void> {
		await this.init();
		if (!this.db) throw new Error('Database not initialized');

		await this.db.clear(STORE_NAME);
	}

	// ==================== SYNC METHODS ====================

	/**
	 * Updates the timestamp for a key
	 */
	private async updateTimestamp(key: string): Promise<void> {
		await this.init();
		if (!this.db) throw new Error('Database not initialized');

		const timestamps = await this.getTimestamps();
		timestamps[key] = new Date().toISOString();
		await this.db.put(STORE_NAME, JSON.stringify(timestamps), TIMESTAMPS_KEY);
	}

	/**
	 * Gets all local timestamps
	 */
	async getTimestamps(): Promise<LocalTimestamps> {
		await this.init();
		if (!this.db) throw new Error('Database not initialized');

		const data = await this.db.get(STORE_NAME, TIMESTAMPS_KEY);
		if (!data) return {};

		try {
			return JSON.parse(data);
		} catch {
			return {};
		}
	}

	/**
	 * Gets the timestamp for a specific key
	 */
	async getTimestamp(key: string): Promise<Date | null> {
		const timestamps = await this.getTimestamps();
		const ts = timestamps[key];
		return ts ? new Date(ts) : null;
	}

	/**
	 * Gets raw encrypted data for sync (without decrypting)
	 */
	async getRawItem(key: string): Promise<string | null> {
		await this.init();
		if (!this.db) throw new Error('Database not initialized');

		const value = await this.db.get(STORE_NAME, key);
		return value ?? null;
	}

	/**
	 * Sets raw data from cloud sync (already encrypted or unencrypted settings)
	 * Does NOT update timestamp (to avoid sync loops)
	 */
	async setRawItem(key: string, value: string): Promise<void> {
		await this.init();
		if (!this.db) throw new Error('Database not initialized');

		await this.db.put(STORE_NAME, value, key);
	}

	/**
	 * Sets raw data and updates timestamp (for initial cloud download)
	 */
	async setRawItemWithTimestamp(key: string, value: string, timestamp: string): Promise<void> {
		await this.init();
		if (!this.db) throw new Error('Database not initialized');

		await this.db.put(STORE_NAME, value, key);

		// Update timestamp to match cloud
		const timestamps = await this.getTimestamps();
		timestamps[key] = timestamp;
		await this.db.put(STORE_NAME, JSON.stringify(timestamps), TIMESTAMPS_KEY);
	}

	/**
	 * Gets all syncable data with their timestamps (for full sync)
	 */
	async getAllSyncableData(): Promise<{ key: string; data: string | null; timestamp: string | null }[]> {
		const timestamps = await this.getTimestamps();
		const result: { key: string; data: string | null; timestamp: string | null }[] = [];

		for (const key of SYNCABLE_KEYS) {
			const data = await this.getRawItem(key);
			result.push({
				key,
				data,
				timestamp: timestamps[key] || null,
			});
		}

		return result;
	}
}

// Singleton Export
export const storage = new BrowserStorage();
export default storage;
