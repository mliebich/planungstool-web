'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { storage } from '../services/storage';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { syncService } from '../services/syncService';

interface AuthContextType {
	// Local auth
	isAuthenticated: boolean;
	isLoading: boolean;
	hasPassword: boolean;
	login: (password: string) => Promise<boolean>;
	setupPassword: (password: string) => Promise<void>;
	logout: () => void;
	resetAllData: () => Promise<void>;

	// Cloud auth
	user: User | null;
	isCloudEnabled: boolean;
	isCloudConfigured: boolean;
	signUpWithCloud: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
	signInWithCloud: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
	signOutCloud: () => Promise<void>;
	linkToCloud: (email: string) => Promise<{ success: boolean; error?: string }>;
	unlinkFromCloud: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	// Local auth state
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [hasPassword, setHasPassword] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	// Cloud auth state
	const [user, setUser] = useState<User | null>(null);
	const [isCloudEnabled, setIsCloudEnabled] = useState(false);

	// Store password temporarily for cloud sign-up
	const [tempPassword, setTempPassword] = useState<string | null>(null);

	useEffect(() => {
		initializeAuth();
	}, []);

	const initializeAuth = async () => {
		try {
			// Check local password status
			const passwordExists = await storage.hasPassword();
			setHasPassword(passwordExists);

			// Check Supabase session if configured
			if (supabase) {
				const { data: { session } } = await supabase.auth.getSession();
				if (session?.user) {
					setUser(session.user);
					setIsCloudEnabled(true);
				}

				// Listen for auth changes
				supabase.auth.onAuthStateChange((_event, session) => {
					setUser(session?.user ?? null);
					setIsCloudEnabled(!!session?.user);
				});
			}
		} catch (error) {
			console.error('Fehler beim Initialisieren der Auth:', error);
		} finally {
			setIsLoading(false);
		}
	};

	// ==================== LOCAL AUTH ====================

	const login = async (password: string): Promise<boolean> => {
		try {
			const isValid = await storage.validatePassword(password);

			if (isValid) {
				storage.setPassword(password);
				setTempPassword(password);

				try {
					await storage.migrateUnencryptedData();
				} catch (error) {
					console.error('Migration Warnung:', error);
				}

				setIsAuthenticated(true);

				// If cloud is enabled, sync after login
				if (isCloudEnabled) {
					syncService.syncAll().catch(console.error);
				}

				return true;
			} else {
				return false;
			}
		} catch (error) {
			console.error('Login Fehler:', error);
			return false;
		}
	};

	const setupPassword = async (password: string): Promise<void> => {
		try {
			await storage.setupPassword(password);
			setTempPassword(password);

			try {
				await storage.migrateUnencryptedData();
			} catch (error) {
				console.error('Migration Warnung:', error);
			}

			setHasPassword(true);
			setIsAuthenticated(true);
		} catch (error) {
			console.error('Setup Fehler:', error);
			throw error;
		}
	};

	const logout = () => {
		storage.clearPassword();
		setTempPassword(null);
		setIsAuthenticated(false);
	};

	const resetAllData = async (): Promise<void> => {
		try {
			// Sign out from cloud first
			if (isCloudEnabled && supabase) {
				await supabase.auth.signOut();
			}

			await storage.resetAllData();
			setHasPassword(false);
			setIsAuthenticated(false);
			setUser(null);
			setIsCloudEnabled(false);
			setTempPassword(null);
		} catch (error) {
			console.error('Reset Fehler:', error);
			throw error;
		}
	};

	// ==================== CLOUD AUTH ====================

	const signUpWithCloud = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
		if (!supabase) {
			return { success: false, error: 'Cloud-Sync ist nicht konfiguriert' };
		}

		try {
			// Create Supabase account
			const { data, error } = await supabase.auth.signUp({
				email,
				password,
			});

			if (error) {
				return { success: false, error: error.message };
			}

			if (!data.user) {
				return { success: false, error: 'Konto konnte nicht erstellt werden' };
			}

			// Setup local password with the same password
			await storage.setupPassword(password);
			setTempPassword(password);
			setHasPassword(true);
			setIsAuthenticated(true);
			setUser(data.user);
			setIsCloudEnabled(true);

			// Upload all local data to cloud
			await syncService.uploadAll();

			return { success: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
			return { success: false, error: message };
		}
	};

	const signInWithCloud = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
		if (!supabase) {
			return { success: false, error: 'Cloud-Sync ist nicht konfiguriert' };
		}

		try {
			// Sign in to Supabase
			const { data, error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});

			if (error) {
				return { success: false, error: error.message };
			}

			if (!data.user) {
				return { success: false, error: 'Anmeldung fehlgeschlagen' };
			}

			setUser(data.user);
			setIsCloudEnabled(true);

			// Check if local password exists
			const localPasswordExists = await storage.hasPassword();

			if (localPasswordExists) {
				// Validate local password matches
				const isValid = await storage.validatePassword(password);
				if (isValid) {
					storage.setPassword(password);
					setTempPassword(password);
					setIsAuthenticated(true);

					// Sync data
					await syncService.syncAll();
				} else {
					// Local password differs - download cloud data
					// Note: This will overwrite local data!
					await storage.setupPassword(password);
					setTempPassword(password);
					setHasPassword(true);
					setIsAuthenticated(true);
					await syncService.downloadAll();
				}
			} else {
				// No local password - setup with cloud password
				await storage.setupPassword(password);
				setTempPassword(password);
				setHasPassword(true);
				setIsAuthenticated(true);

				// Download cloud data if exists
				const hasCloud = await syncService.hasCloudData();
				if (hasCloud) {
					await syncService.downloadAll();
				}
			}

			return { success: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
			return { success: false, error: message };
		}
	};

	const signOutCloud = async (): Promise<void> => {
		if (supabase) {
			await supabase.auth.signOut();
		}
		setUser(null);
		setIsCloudEnabled(false);
		// Keep local auth state - user is still logged in locally
	};

	const linkToCloud = async (email: string): Promise<{ success: boolean; error?: string }> => {
		if (!supabase) {
			return { success: false, error: 'Cloud-Sync ist nicht konfiguriert' };
		}

		if (!tempPassword) {
			return { success: false, error: 'Bitte zuerst lokal anmelden' };
		}

		try {
			// Create Supabase account with the same password as local
			const { data, error } = await supabase.auth.signUp({
				email,
				password: tempPassword,
			});

			if (error) {
				return { success: false, error: error.message };
			}

			if (!data.user) {
				return { success: false, error: 'Konto konnte nicht erstellt werden' };
			}

			setUser(data.user);
			setIsCloudEnabled(true);

			// Upload all local data to cloud
			await syncService.uploadAll();

			return { success: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
			return { success: false, error: message };
		}
	};

	const unlinkFromCloud = async (): Promise<void> => {
		if (supabase && user) {
			// Optionally delete cloud data
			await syncService.deleteAllCloudData();
			await supabase.auth.signOut();
		}
		setUser(null);
		setIsCloudEnabled(false);
	};

	return (
		<AuthContext.Provider
			value={{
				// Local auth
				isAuthenticated,
				isLoading,
				hasPassword,
				login,
				setupPassword,
				logout,
				resetAllData,

				// Cloud auth
				user,
				isCloudEnabled,
				isCloudConfigured: isSupabaseConfigured(),
				signUpWithCloud,
				signInWithCloud,
				signOutCloud,
				linkToCloud,
				unlinkFromCloud,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
};

export const useAuth = (): AuthContextType => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth muss innerhalb eines AuthProvider verwendet werden');
	}
	return context;
};
