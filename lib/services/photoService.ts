// Local photo storage using IndexedDB
// Photos are stored only on the device, not synced to the cloud

const DB_NAME = 'planungstool-photos';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

interface StoredPhoto {
	id: string;
	data: string; // Base64 encoded image
	mimeType: string;
	createdAt: Date;
}

class PhotoService {
	private db: IDBDatabase | null = null;

	private async getDB(): Promise<IDBDatabase> {
		if (this.db) return this.db;

		return new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onerror = () => reject(request.error);

			request.onsuccess = () => {
				this.db = request.result;
				resolve(this.db);
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					db.createObjectStore(STORE_NAME, { keyPath: 'id' });
				}
			};
		});
	}

	async savePhoto(id: string, file: File): Promise<string> {
		// Compress and resize the image
		const compressedData = await this.compressImage(file);

		const db = await this.getDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([STORE_NAME], 'readwrite');
			const store = transaction.objectStore(STORE_NAME);

			const photo: StoredPhoto = {
				id,
				data: compressedData,
				mimeType: 'image/jpeg',
				createdAt: new Date(),
			};

			const request = store.put(photo);

			request.onsuccess = () => resolve(id);
			request.onerror = () => reject(request.error);
		});
	}

	async getPhoto(id: string): Promise<string | null> {
		const db = await this.getDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([STORE_NAME], 'readonly');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.get(id);

			request.onsuccess = () => {
				const photo = request.result as StoredPhoto | undefined;
				if (photo) {
					resolve(photo.data);
				} else {
					resolve(null);
				}
			};

			request.onerror = () => reject(request.error);
		});
	}

	async deletePhoto(id: string): Promise<void> {
		const db = await this.getDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([STORE_NAME], 'readwrite');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.delete(id);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	async getAllPhotoIds(): Promise<string[]> {
		const db = await this.getDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([STORE_NAME], 'readonly');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.getAllKeys();

			request.onsuccess = () => resolve(request.result as string[]);
			request.onerror = () => reject(request.error);
		});
	}

	private async compressImage(file: File): Promise<string> {
		// Validate file type
		const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
		if (!allowedTypes.includes(file.type)) {
			throw new Error('Ungültiger Dateityp. Nur JPEG, PNG, GIF und WebP sind erlaubt.');
		}

		// Validate file size (max 10MB)
		const maxSize = 10 * 1024 * 1024;
		if (file.size > maxSize) {
			throw new Error('Datei zu gross. Maximum ist 10MB.');
		}

		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				const img = new Image();
				img.onload = () => {
					const canvas = document.createElement('canvas');
					const ctx = canvas.getContext('2d');
					if (!ctx) {
						reject(new Error('Could not get canvas context'));
						return;
					}

					// Target size: 200x200 for profile photos
					const maxSize = 200;
					let width = img.width;
					let height = img.height;

					// Calculate crop to make it square
					const size = Math.min(width, height);
					const startX = (width - size) / 2;
					const startY = (height - size) / 2;

					canvas.width = maxSize;
					canvas.height = maxSize;

					// Draw cropped and resized image
					ctx.drawImage(
						img,
						startX, startY, size, size,
						0, 0, maxSize, maxSize
					);

					// Convert to JPEG with compression
					const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
					resolve(dataUrl);
				};
				img.onerror = () => reject(new Error('Failed to load image'));
				img.src = e.target?.result as string;
			};
			reader.onerror = () => reject(new Error('Failed to read file'));
			reader.readAsDataURL(file);
		});
	}
}

export const photoService = new PhotoService();
export default photoService;
