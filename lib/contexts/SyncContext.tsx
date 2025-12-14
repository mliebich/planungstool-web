'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { syncService, SyncResult } from '../services/syncService';
import { useAuth } from './AuthContext';
import { SyncState } from '../types/sync';

interface SyncContextType {
	syncState: SyncState;
	sync: () => Promise<SyncResult>;
	lastSyncResult: SyncResult | null;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	const { isCloudEnabled, isAuthenticated } = useAuth();

	const [syncState, setSyncState] = useState<SyncState>({
		isEnabled: false,
		isSyncing: false,
		lastSyncAt: null,
		error: null,
		isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
	});

	const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

	// Update isEnabled based on auth state
	useEffect(() => {
		setSyncState(prev => ({
			...prev,
			isEnabled: isCloudEnabled && isAuthenticated,
		}));
	}, [isCloudEnabled, isAuthenticated]);

	// Listen for online/offline events
	useEffect(() => {
		const handleOnline = () => {
			setSyncState(prev => ({ ...prev, isOnline: true }));
			// Auto-sync when coming back online
			if (syncState.isEnabled) {
				sync();
			}
		};

		const handleOffline = () => {
			setSyncState(prev => ({ ...prev, isOnline: false }));
		};

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	}, [syncState.isEnabled]);

	// Auto-sync on initial load if enabled
	useEffect(() => {
		if (syncState.isEnabled && syncState.isOnline && !syncState.lastSyncAt) {
			sync();
		}
	}, [syncState.isEnabled, syncState.isOnline]);

	const sync = useCallback(async (): Promise<SyncResult> => {
		if (!syncState.isEnabled || !syncState.isOnline) {
			return {
				success: false,
				uploaded: [],
				downloaded: [],
				errors: ['Sync nicht verfügbar'],
			};
		}

		setSyncState(prev => ({ ...prev, isSyncing: true, error: null }));

		try {
			const result = await syncService.syncAll();
			setLastSyncResult(result);

			setSyncState(prev => ({
				...prev,
				isSyncing: false,
				lastSyncAt: new Date(),
				error: result.errors.length > 0 ? result.errors.join(', ') : null,
			}));

			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Sync fehlgeschlagen';
			setSyncState(prev => ({
				...prev,
				isSyncing: false,
				error: message,
			}));

			return {
				success: false,
				uploaded: [],
				downloaded: [],
				errors: [message],
			};
		}
	}, [syncState.isEnabled, syncState.isOnline]);

	return (
		<SyncContext.Provider
			value={{
				syncState,
				sync,
				lastSyncResult,
			}}
		>
			{children}
		</SyncContext.Provider>
	);
};

export const useSync = (): SyncContextType => {
	const context = useContext(SyncContext);
	if (!context) {
		throw new Error('useSync muss innerhalb eines SyncProvider verwendet werden');
	}
	return context;
};
