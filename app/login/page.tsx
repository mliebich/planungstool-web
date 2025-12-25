'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';

type CloudAction = 'login' | 'register';

export default function LoginPage() {
	const {
		signUpWithCloud,
		signInWithCloud,
	} = useAuth();
	const router = useRouter();

	const [cloudAction, setCloudAction] = useState<CloudAction>('login');

	// Form state
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState('');
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
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

	const needsConfirmPassword = cloudAction === 'register';

	return (
		<div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--gray-50)' }}>
			<div className="w-full max-w-md">
				{/* Logo */}
				<div className="text-center mb-8">
					<img
						src="/logo.svg"
						alt="Planungstool Logo"
						className="w-20 h-20 mx-auto mb-4"
					/>
					<h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
						Planungstool
					</h1>
					<p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
						{cloudAction === 'register' ? 'Konto erstellen' : 'Anmelden'}
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					{/* Email Input */}
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
							autoComplete="current-password"
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
						className="w-full py-4 text-lg font-bold rounded-xl transition-opacity disabled:opacity-60 text-white"
						style={{ backgroundColor: 'var(--primary)' }}
					>
						{isLoading ? (
							<span className="inline-block animate-spin">⏳</span>
						) : (
							cloudAction === 'register' ? '✨ Konto erstellen' : '☁️ Anmelden'
						)}
					</button>

					{/* Action toggle */}
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
				</form>

				{/* Info Text */}
				<div className="mt-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
					<p>☁️ Daten werden verschlüsselt in der Cloud gespeichert und auf allen Geräten synchronisiert.</p>
				</div>
			</div>
		</div>
	);
}
