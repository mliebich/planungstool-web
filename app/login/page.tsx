'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function LoginPage() {
	const { hasPassword, login, setupPassword, resetAllData } = useAuth();
	const router = useRouter();

	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [showResetConfirm, setShowResetConfirm] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
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

	const handleReset = async () => {
		setIsLoading(true);
		try {
			await resetAllData();
			setShowResetConfirm(false);
			setPassword('');
			setConfirmPassword('');
			setError('');
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Fehler beim Zurücksetzen');
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--gray-50)' }}>
			<div className="w-full max-w-md">
				{/* Logo */}
				<div className="text-center mb-8">
					<div className="text-6xl mb-4">📚</div>
					<h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
						{hasPassword ? 'Planungstool' : 'Willkommen!'}
					</h1>
					<p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
						{hasPassword
							? 'Bitte Passwort eingeben'
							: 'Erstellen Sie ein Passwort zum Schutz Ihrer Daten'}
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
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

					{/* Confirm Password (Setup only) */}
					{!hasPassword && (
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
							backgroundColor: 'var(--gray-100)',
							color: 'var(--text-primary)',
						}}
					>
						{isLoading ? (
							<span className="inline-block animate-spin">⏳</span>
						) : (
							hasPassword ? '🔓 Entsperren' : '✅ Passwort erstellen'
						)}
					</button>
				</form>

				{/* Forgot Password */}
				{hasPassword && !showResetConfirm && (
					<button
						onClick={() => setShowResetConfirm(true)}
						className="w-full mt-4 py-2 text-sm"
						style={{ color: 'var(--primary)' }}
					>
						Passwort vergessen?
					</button>
				)}

				{/* Reset Confirmation */}
				{showResetConfirm && (
					<div
						className="mt-6 p-4 rounded-xl border-2"
						style={{
							backgroundColor: '#fff3cd',
							borderColor: '#ffc107',
						}}
					>
						<p className="text-center font-semibold mb-4" style={{ color: '#856404' }}>
							⚠️ WARNUNG: Dies löscht alle Ihre Daten unwiderruflich!
						</p>
						<div className="flex gap-3">
							<button
								onClick={() => setShowResetConfirm(false)}
								className="flex-1 py-3 rounded-lg font-semibold text-white"
								style={{ backgroundColor: '#6c757d' }}
							>
								Abbrechen
							</button>
							<button
								onClick={handleReset}
								disabled={isLoading}
								className="flex-1 py-3 rounded-lg font-semibold text-white"
								style={{ backgroundColor: 'var(--danger)' }}
							>
								Daten löschen
							</button>
						</div>
					</div>
				)}

				{/* Info Text */}
				{!hasPassword && (
					<p className="mt-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
						💡 Merken Sie sich dieses Passwort gut. Es gibt keine Wiederherstellungsmöglichkeit!
					</p>
				)}
			</div>
		</div>
	);
}
