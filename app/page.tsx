'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import settingsService from '@/lib/services/settingsService';
import { TileConfig } from '@/lib/types/settings';
import Link from 'next/link';

export default function HomePage() {
	const { isAuthenticated, isLoading, logout } = useAuth();
	const router = useRouter();
	const [tiles, setTiles] = useState<TileConfig[]>([]);
	const [loadingTiles, setLoadingTiles] = useState(true);

	useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			router.push('/login');
		}
	}, [isAuthenticated, isLoading, router]);

	useEffect(() => {
		if (isAuthenticated) {
			loadTiles();
		}
	}, [isAuthenticated]);

	const loadTiles = async () => {
		try {
			const settings = await settingsService.getSettings();
			const enabledTiles = settings.tiles
				.filter(t => t.enabled)
				.sort((a, b) => a.order - b.order);
			setTiles(enabledTiles);
		} catch (error) {
			console.error('Fehler beim Laden der Tiles:', error);
			const defaultSettings = settingsService.getDefaultSettings();
			setTiles(defaultSettings.tiles.filter(t => t.enabled));
		} finally {
			setLoadingTiles(false);
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--gray-50)' }}>
				<div className="text-center">
					<div className="text-4xl animate-spin mb-4">⏳</div>
					<p style={{ color: 'var(--text-secondary)' }}>Lade...</p>
				</div>
			</div>
		);
	}

	if (!isAuthenticated) {
		return null;
	}

	return (
		<div className="min-h-screen" style={{ backgroundColor: 'var(--gray-50)' }}>
			{/* Header */}
			<header className="bg-white shadow-sm">
				<div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
					<h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
						📚 Planungstool
					</h1>
					<div className="flex items-center gap-4">
						<Link
							href="/einstellungen"
							className="px-4 py-2 rounded-lg"
							style={{ backgroundColor: 'var(--gray-100)', color: 'var(--text-primary)' }}
						>
							⚙️ Einstellungen
						</Link>
						<button
							onClick={logout}
							className="px-4 py-2 rounded-lg"
							style={{ backgroundColor: 'var(--gray-100)', color: 'var(--text-primary)' }}
						>
							🔒 Abmelden
						</button>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="max-w-6xl mx-auto px-4 py-8">
				{loadingTiles ? (
					<div className="text-center py-12">
						<div className="text-4xl animate-spin mb-4">⏳</div>
						<p style={{ color: 'var(--text-secondary)' }}>Lade Kacheln...</p>
					</div>
				) : (
					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
						{tiles.map((tile) => (
							<Link
								key={tile.id}
								href={tile.route}
								className="block p-6 rounded-2xl text-white transition-transform hover:scale-105 hover:shadow-lg"
								style={{ backgroundColor: tile.color }}
							>
								<div className="text-4xl mb-3">{tile.icon}</div>
								<h2 className="text-xl font-bold mb-1">{tile.title}</h2>
								<p className="text-sm opacity-90">{tile.description}</p>
							</Link>
						))}
					</div>
				)}

				{/* Info */}
				<div className="mt-12 text-center" style={{ color: 'var(--text-tertiary)' }}>
					<p className="text-sm">
						Teacher Planning Tool - Web Version
					</p>
				</div>
			</main>
		</div>
	);
}
