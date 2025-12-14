'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { storage } from '../services/storage';

interface AuthContextType {
	isAuthenticated: boolean;
	isLoading: boolean;
	hasPassword: boolean;
	login: (password: string) => Promise<boolean>;
	setupPassword: (password: string) => Promise<void>;
	logout: () => void;
	resetAllData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [hasPassword, setHasPassword] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		checkPasswordStatus();
	}, []);

	const checkPasswordStatus = async () => {
		try {
			const passwordExists = await storage.hasPassword();
			setHasPassword(passwordExists);
		} catch (error) {
			console.error('Fehler beim Prüfen des Passwort-Status:', error);
		} finally {
			setIsLoading(false);
		}
	};

	const login = async (password: string): Promise<boolean> => {
		try {
			const isValid = await storage.validatePassword(password);

			if (isValid) {
				storage.setPassword(password);

				try {
					await storage.migrateUnencryptedData();
				} catch (error) {
					console.error('Migration Warnung:', error);
				}

				setIsAuthenticated(true);
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
		setIsAuthenticated(false);
	};

	const resetAllData = async (): Promise<void> => {
		try {
			await storage.resetAllData();
			setHasPassword(false);
			setIsAuthenticated(false);
		} catch (error) {
			console.error('Reset Fehler:', error);
			throw error;
		}
	};

	return (
		<AuthContext.Provider
			value={{
				isAuthenticated,
				isLoading,
				hasPassword,
				login,
				setupPassword,
				logout,
				resetAllData,
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
