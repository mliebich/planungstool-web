export interface SyncState {
	isEnabled: boolean;
	isSyncing: boolean;
	lastSyncAt: Date | null;
	error: string | null;
	isOnline: boolean;
}

export interface CloudData {
	id: string;
	user_id: string;
	data_type: string;
	encrypted_data: string;
	updated_at: string;
}

export interface LocalTimestamps {
	[key: string]: string; // ISO date string
}

export const SYNCABLE_KEYS = [
	'classes',
	'exams',
	'examResults',
	'coachingSessions',
	'coachingTags',
	'lessons',
	'themes',
	'blockages',
	'students',
	'customClassColors',
	'materialUsages',
	'importedEvents',
	'appSettings',
] as const;

export type SyncableKey = typeof SYNCABLE_KEYS[number];
