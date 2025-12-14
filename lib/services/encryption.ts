import CryptoJS from 'crypto-js';

/**
 * Verschlüsselungs-Service für sensible Daten
 * Verwendet AES-256-CBC mit PBKDF2 Key Derivation
 */
class EncryptionService {
	private static readonly PBKDF2_ITERATIONS = 20000;
	private static readonly KEY_SIZE = 256;
	private static readonly SALT_SIZE = 16; // bytes
	private static readonly IV_SIZE = 12; // bytes

	// Key Cache für bessere Performance
	private static keyCache: Map<string, string> = new Map();

	/**
	 * Erzeugt einen kryptographischen Schlüssel aus dem Passwort
	 */
	private static deriveKey(password: string, salt: string): string {
		const cacheKey = `${password}:${salt}`;

		if (this.keyCache.has(cacheKey)) {
			return this.keyCache.get(cacheKey)!;
		}

		const key = CryptoJS.PBKDF2(password, salt, {
			keySize: this.KEY_SIZE / 32,
			iterations: this.PBKDF2_ITERATIONS,
		}).toString();

		this.keyCache.set(cacheKey, key);

		// Begrenze Cache-Größe
		if (this.keyCache.size > 100) {
			const firstKey = this.keyCache.keys().next().value;
			if (firstKey) this.keyCache.delete(firstKey);
		}

		return key;
	}

	/**
	 * Generiert einen zufälligen Salt
	 */
	private static generateSalt(): string {
		return CryptoJS.lib.WordArray.random(this.SALT_SIZE).toString();
	}

	/**
	 * Generiert einen zufälligen IV
	 */
	private static generateIV(): string {
		return CryptoJS.lib.WordArray.random(this.IV_SIZE).toString();
	}

	/**
	 * Verschlüsselt Daten mit AES-256
	 * @returns Verschlüsselter String im Format: salt:iv:ciphertext
	 */
	static encrypt(data: unknown, password: string): string {
		try {
			const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
			const salt = this.generateSalt();
			const iv = this.generateIV();
			const key = this.deriveKey(password, salt);

			const encrypted = CryptoJS.AES.encrypt(
				jsonString,
				CryptoJS.enc.Hex.parse(key),
				{
					iv: CryptoJS.enc.Hex.parse(iv),
					mode: CryptoJS.mode.CBC,
					padding: CryptoJS.pad.Pkcs7,
				}
			);

			return `${salt}:${iv}:${encrypted.toString()}`;
		} catch (error) {
			console.error('Encryption error:', error);
			throw new Error('Verschlüsselung fehlgeschlagen');
		}
	}

	/**
	 * Entschlüsselt Daten
	 * @returns Entschlüsselte Daten
	 */
	static decrypt(encryptedData: string, password: string): unknown {
		try {
			const parts = encryptedData.split(':');
			if (parts.length !== 3) {
				throw new Error('Ungültiges Format der verschlüsselten Daten');
			}

			const [salt, iv, ciphertext] = parts;
			const key = this.deriveKey(password, salt);

			const decrypted = CryptoJS.AES.decrypt(
				ciphertext,
				CryptoJS.enc.Hex.parse(key),
				{
					iv: CryptoJS.enc.Hex.parse(iv),
					mode: CryptoJS.mode.CBC,
					padding: CryptoJS.pad.Pkcs7,
				}
			);

			const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);

			if (!decryptedString) {
				throw new Error('Entschlüsselung fehlgeschlagen');
			}

			try {
				return JSON.parse(decryptedString);
			} catch {
				return decryptedString;
			}
		} catch (error) {
			console.error('Decryption error:', error);
			throw new Error('Entschlüsselung fehlgeschlagen - falsches Passwort?');
		}
	}

	/**
	 * Löscht den Key-Cache
	 */
	static clearKeyCache(): void {
		this.keyCache.clear();
	}
}

export default EncryptionService;
