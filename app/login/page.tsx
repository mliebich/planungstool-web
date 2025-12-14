'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';

type LoginMode = 'local' | 'cloud';
type CloudAction = 'login' | 'register';

export default function LoginPage() {
	const {
		hasPassword,
		login,
		setupPassword,
		isCloudConfigured,
		signUpWithCloud,
		signInWithCloud,
	} = useAuth();
	const router = useRouter();

	// Mode selection
	const [mode, setMode] = useState<LoginMode>(isCloudConfigured ? 'cloud' : 'local');
	const [cloudAction, setCloudAction] = useState<CloudAction>('login');

	// Form state
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState('');
	const [isLoading, setIsLoading] = useState(false);

	const handleLocalSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');

		if (!password.trim()) {
			setError('Bitte Passwort eingeben');
			return;
		}

		if (!hasPassword) {
			if (password !== confirmPassword) {
				setError('Passwörter stimmen nicht überein');
				return;
			}
			if (password.length < 6) {
				setError('Passwort muss mindestens 6 Zeichen lang sein');
				return;
			}
		}

		setIsLoading(true);

		try {
			if (hasPassword) {
				const success = await login(password);
				if (success) {
					router.push('/');
				} else {
					setError('Falsches Passwort');
					setPassword('');
				}
			} else {
				await setupPassword(password);
				router.push('/');
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
		} finally {
			setIsLoading(false);
		}
	};

	const handleCloudSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');

		if (!email.trim()) {
			setError('Bitte E-Mail eingeben');
			return;
		}

		if (!password.trim()) {
			setError('Bitte Passwort eingeben');
			return;
		}

		if (cloudAction === 'register') {
			if (password !== confirmPassword) {
				setError('Passwörter stimmen nicht überein');
				return;
			}
			if (password.length < 6) {
				setError('Passwort muss mindestens 6 Zeichen lang sein');
				return;
			}
		}

		setIsLoading(true);

		try {
			if (cloudAction === 'register') {
				const result = await signUpWithCloud(email, password);
				if (result.success) {
					router.push('/');
				} else {
					setError(result.error || 'Registrierung fehlgeschlagen');
				}
			} else {
				const result = await signInWithCloud(email, password);
				if (result.success) {
					router.push('/');
				} else {
					setError(result.error || 'Anmeldung fehlgeschlagen');
				}
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
		} finally {
			setIsLoading(false);
		}
	};

	const needsConfirmPassword = (mode === 'local' && !hasPassword) || (mode === 'cloud' && cloudAction === 'register');

	return (
		<div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--gray-50)' }}>
			<div className="w-full max-w-md">
				{/* Logo */}
				<div className="text-center mb-8">
					<div className="text-6xl mb-4">📚</div>
					<h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
						Planungstool
					</h1>
					<p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
						{mode === 'cloud'
							? (cloudAction === 'register' ? 'Konto erstellen' : 'Mit Cloud anmelden')
							: (hasPassword ? 'Bitte Passwort eingeben' : 'Passwort erstellen')}
					</p>
				</div>

				{/* Mode Tabs (only show if cloud is configured) */}
				{isCloudConfigured && (
					<div className="flex mb-6 rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--gray-100)' }}>
						<button
							type="button"
							onClick={() => setMode('cloud')}
							className={`flex-1 py-3 text-sm font-medium transition-colors ${
								mode === 'cloud' ? 'bg-white shadow-sm' : ''
							}`}
							style={{ color: mode === 'cloud' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
						>
							☁️ Cloud
						</button>
						<button
							type="button"
							onClick={() => setMode('local')}
							className={`flex-1 py-3 text-sm font-medium transition-colors ${
								mode === 'local' ? 'bg-white shadow-sm' : ''
							}`}
							style={{ color: mode === 'local' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
						>
							💾 Lokal
						</button>
					</div>
				)}

				<form onSubmit={mode === 'cloud' ? handleCloudSubmit : handleLocalSubmit} className="space-y-4">
					{/* Email Input (Cloud only) */}
					{mode === 'cloud' && (
						<input
							type="email"
							placeholder="E-Mail"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full px-4 py-4 text-lg rounded-xl border-2"
							style={{
								backgroundColor: 'white',
								borderColor: 'var(--border)',
								color: 'var(--text-primary)',
							}}
							disabled={isLoading}
							autoComplete="email"
						/>
					)}

					{/* Password Input */}
					<div className="relative">
						<input
							type={showPassword ? 'text' : 'password'}
							placeholder="Passwort"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full px-4 py-4 text-lg rounded-xl border-2 pr-16"
							style={{
								backgroundColor: 'white',
								borderColor: 'var(--border)',
								color: 'var(--text-primary)',
							}}
							disabled={isLoading}
							autoComplete={mode === 'cloud' ? 'current-password' : undefined}
						/>
						<button
							type="button"
							onClick={() => setShowPassword(!showPassword)}
							className="absolute right-4 top-1/2 -translate-y-1/2 text-sm"
							style={{ color: 'var(--text-tertiary)' }}
						>
							{showPassword ? '●●●' : 'abc'}
						</button>
					</div>

					{/* Confirm Password */}
					{needsConfirmPassword && (
						<input
							type={showPassword ? 'text' : 'password'}
							placeholder="Passwort bestätigen"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							className="w-full px-4 py-4 text-lg rounded-xl border-2"
							style={{
								backgroundColor: 'white',
								borderColor: 'var(--border)',
								color: 'var(--text-primary)',
							}}
							disabled={isLoading}
							autoComplete="new-password"
						/>
					)}

					{/* Error Message */}
					{error && (
						<p className="text-center font-semibold" style={{ color: 'var(--danger)' }}>
							{error}
						</p>
					)}

					{/* Submit Button */}
					<button
						type="submit"
						disabled={isLoading}
						className="w-full py-4 text-lg font-bold rounded-xl transition-opacity disabled:opacity-60"
						style={{
							backgroundColor: mode === 'cloud' ? 'var(--primary)' : 'var(--gray-100)',
							color: mode === 'cloud' ? 'white' : 'var(--text-primary)',
						}}
					>
						{isLoading ? (
							<span className="inline-block animate-spin">⏳</span>
						) : mode === 'cloud' ? (
							cloudAction === 'register' ? '✨ Konto erstellen' : '☁️ Anmelden'
						) : (
							hasPassword ? '🔓 Entsperren' : '✅ Passwort erstellen'
						)}
					</button>

					{/* Cloud action toggle */}
					{mode === 'cloud' && (
						<button
							type="button"
							onClick={() => setCloudAction(cloudAction === 'login' ? 'register' : 'login')}
							className="w-full py-2 text-sm"
							style={{ color: 'var(--text-secondary)' }}
						>
							{cloudAction === 'login'
								? 'Noch kein Konto? Jetzt registrieren'
								: 'Bereits ein Konto? Anmelden'}
						</button>
					)}
				</form>

				{/* Info Text */}
				<div className="mt-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
					{mode === 'cloud' ? (
						<p>☁️ Daten werden verschlüsselt in der Cloud gespeichert und auf allen Geräten synchronisiert.</p>
					) : (
						!hasPassword && (
							<p>💡 Merken Sie sich dieses Passwort gut. Es gibt keine Wiederherstellungsmöglichkeit!</p>
						)
					)}
				</div>
			</div>
		</div>
	);
}
