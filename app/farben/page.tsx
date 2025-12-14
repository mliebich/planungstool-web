'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { storage } from '@/lib/services/storage';
import classService from '@/lib/services/classService';
import { Class, Lesson } from '@/lib/types';
import { getClassColor, DEFAULT_CLASS_COLORS, ClassColorConfig } from '@/lib/utils/colorUtils';
import Link from 'next/link';

export default function FarbenPage() {
	const { isAuthenticated, isLoading } = useAuth();
	const router = useRouter();

	const [classes, setClasses] = useState<Class[]>([]);
	const [lessons, setLessons] = useState<Lesson[]>([]);
	const [customColors, setCustomColors] = useState<ClassColorConfig>({});
	const [editingClass, setEditingClass] = useState<string | null>(null);
	const [colorInput, setColorInput] = useState('');

	useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			router.push('/login');
		}
	}, [isAuthenticated, isLoading, router]);

	useEffect(() => {
		if (isAuthenticated) {
			loadData();
		}
	}, [isAuthenticated]);

	const loadData = async () => {
		try {
			const [loadedClasses, savedLessons, savedColors] = await Promise.all([
				classService.getAllClasses(),
				storage.getItem('lessons'),
				storage.getItem('customClassColors'),
			]);

			setClasses(loadedClasses);
			setLessons(savedLessons ? JSON.parse(savedLessons) : []);
			setCustomColors(savedColors ? JSON.parse(savedColors) : {});
		} catch (error) {
			console.error('Fehler beim Laden:', error);
		}
	};

	const saveCustomColors = async (colors: ClassColorConfig) => {
		try {
			await storage.setItem('customClassColors', JSON.stringify(colors));
			setCustomColors(colors);
		} catch (error) {
			console.error('Fehler beim Speichern:', error);
		}
	};

	const startEditing = (className: string) => {
		setEditingClass(className);
		setColorInput(getClassColor(className, customColors));
	};

	const saveColor = async () => {
		if (!editingClass) return;

		if (colorInput.match(/^#[0-9A-Fa-f]{6}$/)) {
			const newColors = { ...customColors, [editingClass]: colorInput };
			await saveCustomColors(newColors);
			setEditingClass(null);
			setColorInput('');
		} else {
			alert('Ungültige Farbe! Format: #RRGGBB');
		}
	};

	const resetColor = async (className: string) => {
		const newColors = { ...customColors };
		delete newColors[className];
		await saveCustomColors(newColors);
	};

	const resetAllColors = async () => {
		if (confirm('Alle Farben auf Standard zurücksetzen?')) {
			await saveCustomColors({});
		}
	};

	// Get all unique class names from both classes and lessons
	const allClassNames = [
		...new Set([
			...classes.map(c => c.name),
			...lessons.map(l => l.class).filter(Boolean) as string[],
		]),
	].sort();

	if (isLoading || !isAuthenticated) {
		return (
			<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--gray-50)' }}>
				<div className="text-4xl animate-spin">...</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen" style={{ backgroundColor: 'var(--gray-50)' }}>
			{/* Header */}
			<header className="bg-white shadow-sm">
				<div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
					<div className="flex items-center gap-4">
						<Link
							href="/"
							className="px-4 py-2 rounded-lg text-white"
							style={{ backgroundColor: 'var(--primary)' }}
						>
							Home
						</Link>
						<h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
							Klassenfarben
						</h1>
					</div>
					<button
						onClick={resetAllColors}
						className="px-4 py-2 rounded-lg"
						style={{ backgroundColor: 'var(--gray-200)', color: 'var(--text-primary)' }}
					>
						Alle zurücksetzen
					</button>
				</div>
			</header>

			<main className="max-w-4xl mx-auto px-4 py-6">
				{allClassNames.length === 0 ? (
					<div className="bg-white rounded-xl p-8 text-center shadow-sm">
						<p className="mb-4" style={{ color: 'var(--text-secondary)' }}>
							Keine Klassen gefunden. Erstelle zuerst Klassen oder füge Lektionen hinzu.
						</p>
						<div className="flex justify-center gap-4">
							<Link
								href="/klassen"
								className="px-4 py-2 rounded-lg text-white"
								style={{ backgroundColor: 'var(--primary)' }}
							>
								Zur Klassenverwaltung
							</Link>
							<Link
								href="/stundenplan"
								className="px-4 py-2 rounded-lg text-white"
								style={{ backgroundColor: 'var(--secondary)' }}
							>
								Zum Stundenplan
							</Link>
						</div>
					</div>
				) : (
					<>
						{/* Color Grid */}
						<div className="bg-white rounded-xl shadow-sm p-6">
							<h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
								Klassen ({allClassNames.length})
							</h2>

							<div className="grid gap-3">
								{allClassNames.map(className => {
									const currentColor = getClassColor(className, customColors);
									const isCustom = customColors[className] !== undefined;

									return (
										<div
											key={className}
											className="flex items-center gap-4 p-4 rounded-lg"
											style={{ backgroundColor: 'var(--gray-50)' }}
										>
											<div
												className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
												style={{ backgroundColor: currentColor }}
											>
												{className.substring(0, 2)}
											</div>

											<div className="flex-1">
												<div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
													{className}
												</div>
												<div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
													{currentColor}
													{isCustom && ' (angepasst)'}
												</div>
											</div>

											{editingClass === className ? (
												<div className="flex items-center gap-2">
													<input
														type="color"
														value={colorInput}
														onChange={e => setColorInput(e.target.value)}
														className="w-10 h-10 rounded cursor-pointer"
													/>
													<input
														type="text"
														value={colorInput}
														onChange={e => setColorInput(e.target.value)}
														className="w-24 px-2 py-1 rounded border text-sm"
														style={{ borderColor: 'var(--border)' }}
														placeholder="#RRGGBB"
													/>
													<button
														onClick={saveColor}
														className="px-3 py-1 rounded text-white text-sm"
														style={{ backgroundColor: 'var(--secondary)' }}
													>
														OK
													</button>
													<button
														onClick={() => setEditingClass(null)}
														className="px-3 py-1 rounded text-sm"
														style={{ backgroundColor: 'var(--gray-200)' }}
													>
														X
													</button>
												</div>
											) : (
												<div className="flex items-center gap-2">
													{isCustom && (
														<button
															onClick={() => resetColor(className)}
															className="px-3 py-1 rounded text-sm"
															style={{ backgroundColor: 'var(--gray-200)' }}
														>
															Standard
														</button>
													)}
													<button
														onClick={() => startEditing(className)}
														className="px-3 py-1 rounded text-white text-sm"
														style={{ backgroundColor: 'var(--primary)' }}
													>
														Ändern
													</button>
												</div>
											)}
										</div>
									);
								})}
							</div>
						</div>

						{/* Default Colors Reference */}
						<div className="mt-6 bg-white rounded-xl shadow-sm p-6">
							<h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
								Standard-Farbpalette
							</h2>
							<p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
								Diese Farben werden automatisch den Klassen zugewiesen, wenn keine benutzerdefinierte Farbe gesetzt ist.
							</p>
							<div className="flex flex-wrap gap-2">
								{Object.entries(DEFAULT_CLASS_COLORS).map(([className, color]) => (
									<div
										key={className}
										className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xs font-bold"
										style={{ backgroundColor: color }}
										title={`${className}: ${color}`}
									>
										{className}
									</div>
								))}
							</div>
						</div>
					</>
				)}
			</main>
		</div>
	);
}
