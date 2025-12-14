'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import settingsService from '@/lib/services/settingsService';
import classService from '@/lib/services/classService';
import examService from '@/lib/services/examService';
import coachingService from '@/lib/services/coachingService';
import { storage } from '@/lib/services/storage';
import { TileConfig, DayOfWeek } from '@/lib/types/settings';
import Link from 'next/link';

const WEEKDAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export default function EinstellungenPage() {
	const { isAuthenticated, isLoading, resetAllData } = useAuth();
	const router = useRouter();

	const [tiles, setTiles] = useState<TileConfig[]>([]);
	const [weekdays, setWeekdays] = useState<DayOfWeek[]>([]);
	const [editingTileId, setEditingTileId] = useState<string | null>(null);
	const [colorInput, setColorInput] = useState('');

	// Coaching Tags State
	const [coachingTags, setCoachingTags] = useState<Record<string, string>>({});
	const [editingTagKey, setEditingTagKey] = useState<string | null>(null);
	const [tagLabelInput, setTagLabelInput] = useState('');
	const [newTagKey, setNewTagKey] = useState('');
	const [newTagLabel, setNewTagLabel] = useState('');
	const [showAddTag, setShowAddTag] = useState(false);

	useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			router.push('/login');
		}
	}, [isAuthenticated, isLoading, router]);

	useEffect(() => {
		if (isAuthenticated) {
			loadSettings();
		}
	}, [isAuthenticated]);

	const loadSettings = async () => {
		try {
			const settings = await settingsService.getSettings();
			setTiles(settings.tiles.sort((a, b) => a.order - b.order));
			setWeekdays(settings.visibleWeekdays);

			// Load coaching tags
			const tags = await coachingService.getCoachingTags();
			setCoachingTags(tags);
		} catch (error) {
			console.error('Fehler beim Laden der Einstellungen:', error);
		}
	};

	const toggleWeekday = async (day: DayOfWeek) => {
		const newWeekdays = weekdays.includes(day)
			? weekdays.filter(d => d !== day)
			: [...weekdays, day].sort((a, b) => a - b);

		setWeekdays(newWeekdays);
		await settingsService.updateVisibleWeekdays(newWeekdays);
	};

	const toggleTile = async (tileId: string, enabled: boolean) => {
		await settingsService.toggleTile(tileId, enabled);
		loadSettings();
	};

	const moveTileUp = async (index: number) => {
		if (index === 0) return;
		const newTiles = [...tiles];
		[newTiles[index - 1], newTiles[index]] = [newTiles[index], newTiles[index - 1]];
		newTiles.forEach((tile, i) => tile.order = i + 1);
		setTiles(newTiles);
		await settingsService.reorderTiles(newTiles);
	};

	const moveTileDown = async (index: number) => {
		if (index === tiles.length - 1) return;
		const newTiles = [...tiles];
		[newTiles[index], newTiles[index + 1]] = [newTiles[index + 1], newTiles[index]];
		newTiles.forEach((tile, i) => tile.order = i + 1);
		setTiles(newTiles);
		await settingsService.reorderTiles(newTiles);
	};

	const startEditingColor = (tile: TileConfig) => {
		setEditingTileId(tile.id);
		setColorInput(tile.color);
	};

	const saveColor = async (tileId: string) => {
		if (colorInput.match(/^#[0-9A-Fa-f]{6}$/)) {
			await settingsService.updateTileColor(tileId, colorInput);
			setEditingTileId(null);
			loadSettings();
		} else {
			alert('Ungültige Farbe! Format: #RRGGBB');
		}
	};

	const handleResetSettings = async () => {
		if (confirm('Alle Einstellungen auf Standard zurücksetzen?')) {
			await settingsService.resetToDefaults();
			loadSettings();
		}
	};

	const handleResetAllData = async () => {
		if (confirm('WARNUNG: Alle Daten werden gelöscht! Dies kann nicht rückgängig gemacht werden. Fortfahren?')) {
			if (confirm('Bist du wirklich sicher? Alle Klassen, Prüfungen und Einstellungen werden gelöscht.')) {
				await resetAllData();
				router.push('/login');
			}
		}
	};

	const handleExportData = async () => {
		try {
			const [classes, exams, results, settings, lessons] = await Promise.all([
				classService.getAllClasses(),
				examService.getAllExams(),
				examService.getAllResults(),
				settingsService.getSettings(),
				storage.getItem('lessons'),
			]);

			const backup = {
				version: 1,
				exportDate: new Date().toISOString(),
				data: {
					classes,
					exams,
					examResults: results,
					settings,
					lessons: lessons ? JSON.parse(lessons) : [],
				}
			};

			const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `planungstool-backup-${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Export-Fehler:', error);
			alert('Fehler beim Exportieren der Daten');
		}
	};

	const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		try {
			const text = await file.text();
			const backup = JSON.parse(text);

			if (!backup.version || !backup.data) {
				throw new Error('Ungültiges Backup-Format');
			}

			if (confirm('Bestehende Daten werden überschrieben. Fortfahren?')) {
				const { classes, exams, examResults, settings, lessons } = backup.data;

				if (classes) await classService.replaceAllClasses(classes);
				if (exams) await examService.replaceAllExams(exams);
				if (examResults) await examService.replaceAllResults(examResults);
				if (settings) {
					await settingsService.updateVisibleWeekdays(settings.visibleWeekdays);
					await settingsService.reorderTiles(settings.tiles);
				}
				if (lessons) await storage.setItem('lessons', JSON.stringify(lessons));

				alert('Daten erfolgreich importiert!');
				loadSettings();
			}
		} catch (error) {
			console.error('Import-Fehler:', error);
			alert('Fehler beim Importieren: Ungültiges Dateiformat');
		}

		// Reset file input
		event.target.value = '';
	};

	// ========== Coaching Tag Functions ==========

	const startEditingTag = (key: string) => {
		setEditingTagKey(key);
		setTagLabelInput(coachingTags[key]);
	};

	const saveTagLabel = async (key: string) => {
		if (tagLabelInput.trim()) {
			const updatedTags = { ...coachingTags, [key]: tagLabelInput.trim() };
			await coachingService.updateCoachingTags(updatedTags);
			setEditingTagKey(null);
			loadSettings();
		}
	};

	const deleteTag = async (key: string) => {
		if (confirm(`Tag "${coachingTags[key]}" löschen?`)) {
			await coachingService.deleteCoachingTag(key);
			loadSettings();
		}
	};

	const addNewTag = async () => {
		if (newTagKey.trim() && newTagLabel.trim()) {
			const key = newTagKey.trim().toLowerCase().replace(/\s+/g, '_');
			if (coachingTags[key]) {
				alert('Dieser Schlüssel existiert bereits!');
				return;
			}
			await coachingService.addCoachingTag(key, newTagLabel.trim());
			setNewTagKey('');
			setNewTagLabel('');
			setShowAddTag(false);
			loadSettings();
		}
	};

	const resetTags = async () => {
		if (confirm('Coaching-Tags auf Standard zurücksetzen?')) {
			await coachingService.resetTagsToDefault();
			loadSettings();
		}
	};

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
							Einstellungen
						</h1>
					</div>
				</div>
			</header>

			<main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
				{/* Weekday Settings */}
				<section className="bg-white rounded-xl shadow-sm p-6">
					<h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
						Sichtbare Wochentage
					</h2>
					<p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
						Wähle aus, welche Wochentage in der Wochen- und Monatsansicht angezeigt werden.
					</p>
					<div className="flex flex-wrap gap-2">
						{([0, 1, 2, 3, 4, 5, 6] as DayOfWeek[]).map(day => (
							<button
								key={day}
								onClick={() => toggleWeekday(day)}
								className={`px-4 py-2 rounded-lg font-medium transition-colors ${
									weekdays.includes(day)
										? 'text-white'
										: 'text-gray-600'
								}`}
								style={{
									backgroundColor: weekdays.includes(day) ? 'var(--primary)' : 'var(--gray-200)'
								}}
							>
								{WEEKDAY_NAMES[day]}
							</button>
						))}
					</div>
				</section>

				{/* Tile Settings */}
				<section className="bg-white rounded-xl shadow-sm p-6">
					<h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
						Dashboard-Kacheln
					</h2>
					<p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
						Aktiviere/deaktiviere Kacheln und ändere ihre Reihenfolge und Farbe.
					</p>
					<div className="space-y-2">
						{tiles.map((tile, index) => (
							<div
								key={tile.id}
								className="flex items-center gap-3 p-3 rounded-lg"
								style={{ backgroundColor: 'var(--gray-50)' }}
							>
								<div className="flex flex-col gap-1">
									<button
										onClick={() => moveTileUp(index)}
										disabled={index === 0}
										className="text-xs px-2 py-0.5 rounded disabled:opacity-30"
										style={{ backgroundColor: 'var(--gray-200)' }}
									>
										&#x25B2;
									</button>
									<button
										onClick={() => moveTileDown(index)}
										disabled={index === tiles.length - 1}
										className="text-xs px-2 py-0.5 rounded disabled:opacity-30"
										style={{ backgroundColor: 'var(--gray-200)' }}
									>
										&#x25BC;
									</button>
								</div>

								<div
									className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
									style={{ backgroundColor: tile.color }}
								>
									{tile.icon}
								</div>

								<div className="flex-1">
									<div className="font-medium" style={{ color: 'var(--text-primary)' }}>
										{tile.title}
									</div>
									<div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
										{tile.description}
									</div>
								</div>

								{editingTileId === tile.id ? (
									<div className="flex items-center gap-2">
										<input
											type="text"
											value={colorInput}
											onChange={e => setColorInput(e.target.value)}
											className="w-24 px-2 py-1 rounded border text-sm"
											style={{ borderColor: 'var(--border)' }}
											placeholder="#RRGGBB"
										/>
										<button
											onClick={() => saveColor(tile.id)}
											className="px-2 py-1 rounded text-sm text-white"
											style={{ backgroundColor: 'var(--secondary)' }}
										>
											OK
										</button>
										<button
											onClick={() => setEditingTileId(null)}
											className="px-2 py-1 rounded text-sm"
											style={{ backgroundColor: 'var(--gray-200)' }}
										>
											X
										</button>
									</div>
								) : (
									<button
										onClick={() => startEditingColor(tile)}
										className="w-8 h-8 rounded-lg border-2"
										style={{ backgroundColor: tile.color, borderColor: 'var(--border)' }}
										title="Farbe ändern"
									/>
								)}

								<label className="flex items-center cursor-pointer">
									<input
										type="checkbox"
										checked={tile.enabled}
										onChange={e => toggleTile(tile.id, e.target.checked)}
										className="sr-only peer"
									/>
									<div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 relative"></div>
								</label>
							</div>
						))}
					</div>
				</section>

				{/* Coaching Tags */}
				<section className="bg-white rounded-xl shadow-sm p-6">
					<h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
						Coaching-Gespräche Tags
					</h2>
					<p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
						Definiere die Themen-Tags für Coaching-Gespräche.
					</p>
					<div className="space-y-2">
						{Object.entries(coachingTags).map(([key, label]) => (
							<div
								key={key}
								className="flex items-center justify-between p-3 rounded-lg"
								style={{ backgroundColor: 'var(--gray-50)' }}
							>
								<div className="flex-1">
									<div className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
										{key}
									</div>
									{editingTagKey === key ? (
										<div className="flex items-center gap-2 mt-1">
											<input
												type="text"
												value={tagLabelInput}
												onChange={e => setTagLabelInput(e.target.value)}
												className="flex-1 px-2 py-1 rounded border text-sm"
												style={{ borderColor: 'var(--primary)' }}
												placeholder="Tag-Bezeichnung"
											/>
											<button
												onClick={() => saveTagLabel(key)}
												className="px-2 py-1 rounded text-white text-sm"
												style={{ backgroundColor: 'var(--secondary)' }}
											>
												OK
											</button>
											<button
												onClick={() => setEditingTagKey(null)}
												className="px-2 py-1 rounded text-sm"
												style={{ backgroundColor: 'var(--gray-200)' }}
											>
												X
											</button>
										</div>
									) : (
										<div className="font-medium" style={{ color: 'var(--text-primary)' }}>
											{label}
										</div>
									)}
								</div>
								{editingTagKey !== key && (
									<div className="flex items-center gap-2">
										<button
											onClick={() => startEditingTag(key)}
											className="px-2 py-1 text-lg"
											title="Bearbeiten"
										>
											✏️
										</button>
										<button
											onClick={() => deleteTag(key)}
											className="px-2 py-1 text-lg"
											title="Löschen"
										>
											🗑️
										</button>
									</div>
								)}
							</div>
						))}
					</div>

					{/* Add new tag */}
					{showAddTag ? (
						<div className="mt-4 p-4 rounded-lg space-y-3" style={{ backgroundColor: 'var(--gray-50)' }}>
							<input
								type="text"
								value={newTagKey}
								onChange={e => setNewTagKey(e.target.value)}
								className="w-full px-3 py-2 rounded border text-sm"
								style={{ borderColor: 'var(--border)' }}
								placeholder="Schlüssel (z.B. teamwork)"
							/>
							<input
								type="text"
								value={newTagLabel}
								onChange={e => setNewTagLabel(e.target.value)}
								className="w-full px-3 py-2 rounded border text-sm"
								style={{ borderColor: 'var(--border)' }}
								placeholder="Bezeichnung (z.B. Teamarbeit)"
							/>
							<div className="flex gap-2">
								<button
									onClick={addNewTag}
									className="flex-1 px-4 py-2 rounded-lg text-white font-medium"
									style={{ backgroundColor: 'var(--secondary)' }}
								>
									Hinzufügen
								</button>
								<button
									onClick={() => {
										setShowAddTag(false);
										setNewTagKey('');
										setNewTagLabel('');
									}}
									className="flex-1 px-4 py-2 rounded-lg font-medium"
									style={{ backgroundColor: 'var(--gray-200)' }}
								>
									Abbrechen
								</button>
							</div>
						</div>
					) : (
						<button
							onClick={() => setShowAddTag(true)}
							className="mt-4 w-full px-4 py-3 rounded-lg font-medium"
							style={{ backgroundColor: 'var(--gray-200)', color: 'var(--text-primary)' }}
						>
							+ Neuer Tag
						</button>
					)}

					<button
						onClick={resetTags}
						className="mt-4 w-full px-4 py-3 rounded-lg text-white font-medium"
						style={{ backgroundColor: 'var(--warning)' }}
					>
						Standard-Tags wiederherstellen
					</button>
				</section>

				{/* Backup & Restore */}
				<section className="bg-white rounded-xl shadow-sm p-6">
					<h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
						Datensicherung
					</h2>
					<p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
						Exportiere deine Daten als JSON-Datei oder importiere eine vorhandene Sicherung.
					</p>
					<div className="flex flex-wrap gap-4">
						<button
							onClick={handleExportData}
							className="px-6 py-3 rounded-lg text-white font-medium"
							style={{ backgroundColor: 'var(--secondary)' }}
						>
							Daten exportieren
						</button>
						<label className="px-6 py-3 rounded-lg font-medium cursor-pointer" style={{ backgroundColor: 'var(--gray-200)', color: 'var(--text-primary)' }}>
							Daten importieren
							<input
								type="file"
								accept=".json"
								onChange={handleImportData}
								className="hidden"
							/>
						</label>
					</div>
				</section>

				{/* Reset Options */}
				<section className="bg-white rounded-xl shadow-sm p-6">
					<h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--danger)' }}>
						Gefahrenzone
					</h2>
					<div className="space-y-4">
						<div className="flex items-center justify-between p-4 rounded-lg border-2" style={{ borderColor: 'var(--warning)' }}>
							<div>
								<div className="font-medium" style={{ color: 'var(--text-primary)' }}>
									Einstellungen zurücksetzen
								</div>
								<div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
									Setzt Dashboard-Kacheln und Wochentage auf Standard zurück
								</div>
							</div>
							<button
								onClick={handleResetSettings}
								className="px-4 py-2 rounded-lg font-medium"
								style={{ backgroundColor: 'var(--warning)', color: 'white' }}
							>
								Zurücksetzen
							</button>
						</div>

						<div className="flex items-center justify-between p-4 rounded-lg border-2" style={{ borderColor: 'var(--danger)' }}>
							<div>
								<div className="font-medium" style={{ color: 'var(--text-primary)' }}>
									Alle Daten löschen
								</div>
								<div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
									Löscht alle Daten unwiderruflich (Klassen, Prüfungen, etc.)
								</div>
							</div>
							<button
								onClick={handleResetAllData}
								className="px-4 py-2 rounded-lg font-medium text-white"
								style={{ backgroundColor: 'var(--danger)' }}
							>
								Alles löschen
							</button>
						</div>
					</div>
				</section>

				{/* App Info */}
				<section className="text-center py-8">
					<p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
						Planungstool Web v1.0
					</p>
					<p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
						Daten werden lokal im Browser gespeichert
					</p>
				</section>
			</main>
		</div>
	);
}
