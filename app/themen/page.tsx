'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { storage } from '@/lib/services/storage';
import { Theme, Material, Lesson, Blockage } from '@/lib/types';
import { getCurrentWeek, getCurrentYear, timeToMinutes } from '@/lib/utils/dateUtils';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

export default function ThemenPage() {
	const { isAuthenticated, isLoading } = useAuth();
	const router = useRouter();

	const [themes, setThemes] = useState<Theme[]>([]);
	const [lessons, setLessons] = useState<Lesson[]>([]);
	const [blockages, setBlockages] = useState<Blockage[]>([]);
	const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
	const [showThemeModal, setShowThemeModal] = useState(false);
	const [showMaterialModal, setShowMaterialModal] = useState(false);
	const [showActivateModal, setShowActivateModal] = useState(false);
	const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
	const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
	const [activatingTheme, setActivatingTheme] = useState<Theme | null>(null);

	const [themeForm, setThemeForm] = useState({
		name: '',
		description: '',
		classLevel: '',
		targetClass: '',
		startWeek: getCurrentWeek(),
		endWeek: getCurrentWeek() + 4,
		year: getCurrentYear(),
		totalLessons: 10,
	});

	const [materialForm, setMaterialForm] = useState({
		title: '',
		type: 'document' as Material['type'],
		description: '',
		plannedLessons: 1,
		url: '',
	});

	useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			router.push('/login');
		}
	}, [isAuthenticated, isLoading, router]);

	useEffect(() => {
		if (isAuthenticated) {
			loadThemes();
		}
	}, [isAuthenticated]);

	const loadThemes = async () => {
		try {
			const savedThemes = await storage.getItem('themes');
			if (savedThemes) {
				setThemes(JSON.parse(savedThemes));
			}

			const savedLessons = await storage.getItem('lessons');
			if (savedLessons) {
				setLessons(JSON.parse(savedLessons));
			}

			const savedBlockages = await storage.getItem('blockages');
			if (savedBlockages) {
				const parsed = JSON.parse(savedBlockages);
				setBlockages(parsed.map((b: Blockage) => ({
					...b,
					startDate: new Date(b.startDate),
					endDate: new Date(b.endDate),
				})));
			}
		} catch (error) {
			console.error('Fehler beim Laden:', error);
		}
	};

	const saveThemes = async (updatedThemes: Theme[]) => {
		try {
			await storage.setItem('themes', JSON.stringify(updatedThemes));
			setThemes(updatedThemes);
		} catch (error) {
			console.error('Fehler beim Speichern:', error);
		}
	};

	const saveLessons = async (updatedLessons: Lesson[]) => {
		try {
			await storage.setItem('lessons', JSON.stringify(updatedLessons));
			setLessons(updatedLessons);
		} catch (error) {
			console.error('Fehler beim Speichern:', error);
		}
	};

	// Prüft ob ein Thema aktive Lektionen hat
	const hasActiveLessons = (themeId: string) => {
		return lessons.some(lesson => lesson.themeId === themeId);
	};

	// Berechnet Kalenderwoche aus Datum
	const getWeekFromDate = (date: Date): number => {
		const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
		const dayNum = d.getUTCDay() || 7;
		d.setUTCDate(d.getUTCDate() + 4 - dayNum);
		const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
		return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
	};

	// Prüft auf Blockierungen im Zeitraum
	const checkBlockages = (startWeek: number, endWeek: number, year: number): { week: number; title: string }[] => {
		const interferingBlockages: { week: number; title: string }[] = [];

		blockages.forEach(blockage => {
			const startBlockageWeek = getWeekFromDate(blockage.startDate);
			const endBlockageWeek = getWeekFromDate(blockage.endDate);

			for (let week = startBlockageWeek; week <= endBlockageWeek; week++) {
				if (week >= startWeek && week <= endWeek) {
					if (!interferingBlockages.find(b => b.week === week)) {
						interferingBlockages.push({ week, title: blockage.title });
					}
				}
			}
		});

		return interferingBlockages;
	};

	// Aktiviert ein Thema und verteilt Materialien auf Lektionen
	const activateTheme = async (theme: Theme) => {
		const targetClass = theme.targetClass || theme.classLevel;

		// Finde Basis-Lektionen für die Zielklasse (ohne bereits zugewiesenes Thema)
		const baseLessonsForClass = lessons.filter(
			lesson =>
				lesson.class === targetClass &&
				lesson.dayOfWeek >= 1 && lesson.dayOfWeek <= 5 &&
				!lesson.themeId
		);

		if (baseLessonsForClass.length === 0) {
			alert(`Keine Lektionen für Klasse "${targetClass}" gefunden. Bitte zuerst im Stundenplan Lektionen für diese Klasse anlegen.`);
			return;
		}

		// Sortiere Lektionen nach Tag und Zeit
		const sortedBaseLessons = [...baseLessonsForClass].sort((a, b) => {
			if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
			return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
		});

		// Berechne benötigte Lektionen
		const totalRequiredLessons = theme.materials.reduce((total, material) => {
			return total + (material.plannedLessons || 0);
		}, 0);

		// Berechne verfügbare Lektionen
		const weekCount = theme.endWeek - theme.startWeek + 1;
		const lessonsPerWeek = sortedBaseLessons.length;
		const totalAvailableLessons = lessonsPerWeek * weekCount;

		if (totalRequiredLessons > totalAvailableLessons) {
			const proceed = confirm(
				`Nicht genügend Lektionen verfügbar.\n\n` +
				`Benötigt: ${totalRequiredLessons} Lektionen\n` +
				`Verfügbar: ${totalAvailableLessons} Lektionen (${lessonsPerWeek} pro Woche × ${weekCount} Wochen)\n\n` +
				`Trotzdem fortfahren? Überschüssige Materialien werden nicht verteilt.`
			);
			if (!proceed) return;
		}

		// Erstelle Wochen-Array
		const weeksArray: number[] = [];
		for (let w = theme.startWeek; w <= theme.endWeek; w++) {
			weeksArray.push(w);
		}

		// Erstelle Lektions-Instanzen mit zugewiesenen Materialien
		const newLessonInstances: Lesson[] = [];
		const assignedLessonIds: string[] = [];
		let totalLessonsCreated = 0;
		let lessonInstanceId = 1;

		for (const material of theme.materials) {
			const plannedLessons = material.plannedLessons || 0;

			for (let lessonNum = 0; lessonNum < plannedLessons; lessonNum++) {
				if (totalLessonsCreated >= totalAvailableLessons) break;

				const weekIndex = Math.floor(totalLessonsCreated / sortedBaseLessons.length);
				const lessonIndexInWeek = totalLessonsCreated % sortedBaseLessons.length;

				if (weekIndex >= weeksArray.length) break;

				const currentWeek = weeksArray[weekIndex];
				const baseLesson = sortedBaseLessons[lessonIndexInWeek];

				const newLessonInstance: Lesson = {
					...baseLesson,
					id: `${baseLesson.id}_theme_${theme.id}_week_${currentWeek}_${lessonInstanceId++}`,
					themeId: theme.id,
					plannedWeek: currentWeek,
					assignedMaterialId: material.id,
				};

				newLessonInstances.push(newLessonInstance);
				assignedLessonIds.push(newLessonInstance.id);
				totalLessonsCreated++;
			}
		}

		// Speichere aktualisierte Lektionen
		const updatedLessons = [...lessons, ...newLessonInstances];
		await saveLessons(updatedLessons);

		// Aktualisiere Thema mit zugewiesenen Lektionen
		const updatedThemes = themes.map(t =>
			t.id === theme.id
				? { ...t, assignedLessons: assignedLessonIds }
				: t
		);
		await saveThemes(updatedThemes);

		alert(`Thema "${theme.name}" aktiviert!\n\n${totalLessonsCreated} Lektionen wurden erstellt und Materialien zugewiesen.`);
		setShowActivateModal(false);
		setActivatingTheme(null);
	};

	// Deaktiviert ein Thema und entfernt alle zugehörigen Lektionen
	const deactivateTheme = async (theme: Theme) => {
		if (!confirm(`Thema "${theme.name}" wirklich deaktivieren?\n\nAlle zugewiesenen Lektionen werden entfernt.`)) {
			return;
		}

		// Entferne alle Lektionen mit diesem Thema
		const updatedLessons = lessons.filter(lesson => lesson.themeId !== theme.id);
		await saveLessons(updatedLessons);

		// Aktualisiere Thema
		const updatedThemes = themes.map(t =>
			t.id === theme.id
				? { ...t, assignedLessons: [] }
				: t
		);
		await saveThemes(updatedThemes);

		alert(`Thema "${theme.name}" wurde deaktiviert.`);
	};

	const handleAddTheme = async () => {
		if (!themeForm.name || !themeForm.classLevel) {
			alert('Bitte Namen und Klassenstufe angeben');
			return;
		}

		const newTheme: Theme = {
			id: uuidv4(),
			name: themeForm.name,
			description: themeForm.description || undefined,
			classLevel: themeForm.classLevel,
			targetClass: themeForm.targetClass || undefined,
			startWeek: themeForm.startWeek,
			endWeek: themeForm.endWeek,
			year: themeForm.year,
			materials: [],
			totalLessons: themeForm.totalLessons,
			assignedLessons: [],
		};

		await saveThemes([...themes, newTheme]);
		setShowThemeModal(false);
		resetThemeForm();
	};

	const handleUpdateTheme = async () => {
		if (!editingTheme) return;

		// Check if this is a new theme (duplicate) or existing
		const isNewTheme = !themes.some(t => t.id === editingTheme.id);
		const isActive = !isNewTheme && hasActiveLessons(editingTheme.id);
		const oldTargetClass = editingTheme.targetClass || editingTheme.classLevel;
		const newTargetClass = themeForm.targetClass || themeForm.classLevel;
		const targetClassChanged = oldTargetClass !== newTargetClass;
		const timeRangeChanged =
			editingTheme.startWeek !== themeForm.startWeek ||
			editingTheme.endWeek !== themeForm.endWeek ||
			editingTheme.year !== themeForm.year;

		// Update the theme first
		const updatedTheme = {
			...editingTheme,
			name: themeForm.name,
			description: themeForm.description || undefined,
			classLevel: themeForm.classLevel,
			targetClass: themeForm.targetClass || undefined,
			startWeek: themeForm.startWeek,
			endWeek: themeForm.endWeek,
			year: themeForm.year,
			totalLessons: themeForm.totalLessons,
		};

		// If new theme (duplicate), add it; otherwise update existing
		const updatedThemes = isNewTheme
			? [...themes, updatedTheme]
			: themes.map(t => t.id === editingTheme.id ? updatedTheme : t);

		await saveThemes(updatedThemes);

		// If theme is active and target class or time range changed, redistribute lessons
		if (isActive && (targetClassChanged || timeRangeChanged)) {
			// Remove old lesson instances
			const lessonsWithoutTheme = lessons.filter(lesson => lesson.themeId !== editingTheme.id);
			await saveLessons(lessonsWithoutTheme);

			// Re-activate with new settings
			const themeToReactivate = { ...updatedTheme, assignedLessons: [] };

			// Update themes state to reflect cleared assignments before reactivating
			const themesBeforeReactivate = updatedThemes.map(t =>
				t.id === editingTheme.id ? themeToReactivate : t
			);
			setThemes(themesBeforeReactivate);

			// Small delay to ensure state is updated
			await new Promise(resolve => setTimeout(resolve, 100));

			// Reactivate - need to reload lessons since we just modified them
			const savedLessons = await storage.getItem('lessons');
			const currentLessons = savedLessons ? JSON.parse(savedLessons) : [];
			setLessons(currentLessons);

			// Now activate with fresh data
			await activateThemeWithData(themeToReactivate, currentLessons, themesBeforeReactivate);
		}

		setEditingTheme(null);
		resetThemeForm();
	};

	// Separate function to activate theme with provided data (avoids stale state issues)
	const activateThemeWithData = async (theme: Theme, currentLessons: Lesson[], currentThemes: Theme[]) => {
		const targetClass = theme.targetClass || theme.classLevel;

		// Find base lessons for the target class
		const baseLessonsForClass = currentLessons.filter(
			lesson =>
				lesson.class === targetClass &&
				lesson.dayOfWeek >= 1 && lesson.dayOfWeek <= 5 &&
				!lesson.themeId
		);

		if (baseLessonsForClass.length === 0) {
			alert(`Keine Lektionen für Klasse "${targetClass}" gefunden.`);
			return;
		}

		// Sort lessons by day and time
		const sortedBaseLessons = [...baseLessonsForClass].sort((a, b) => {
			if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
			return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
		});

		// Calculate required lessons
		const totalRequiredLessons = theme.materials.reduce((total, material) => {
			return total + (material.plannedLessons || 0);
		}, 0);

		// Calculate available lessons
		const weekCount = theme.endWeek - theme.startWeek + 1;
		const lessonsPerWeek = sortedBaseLessons.length;
		const totalAvailableLessons = lessonsPerWeek * weekCount;

		// Create weeks array
		const weeksArray: number[] = [];
		for (let w = theme.startWeek; w <= theme.endWeek; w++) {
			weeksArray.push(w);
		}

		// Create lesson instances with assigned materials
		const newLessonInstances: Lesson[] = [];
		const assignedLessonIds: string[] = [];
		let totalLessonsCreated = 0;
		let lessonInstanceId = 1;

		for (const material of theme.materials) {
			const plannedLessons = material.plannedLessons || 0;

			for (let lessonNum = 0; lessonNum < plannedLessons; lessonNum++) {
				if (totalLessonsCreated >= totalAvailableLessons) break;

				const weekIndex = Math.floor(totalLessonsCreated / sortedBaseLessons.length);
				const lessonIndexInWeek = totalLessonsCreated % sortedBaseLessons.length;

				if (weekIndex >= weeksArray.length) break;

				const currentWeek = weeksArray[weekIndex];
				const baseLesson = sortedBaseLessons[lessonIndexInWeek];

				const newLessonInstance: Lesson = {
					...baseLesson,
					id: `${baseLesson.id}_theme_${theme.id}_week_${currentWeek}_${lessonInstanceId++}`,
					themeId: theme.id,
					plannedWeek: currentWeek,
					assignedMaterialId: material.id,
				};

				newLessonInstances.push(newLessonInstance);
				assignedLessonIds.push(newLessonInstance.id);
				totalLessonsCreated++;
			}
		}

		// Save updated lessons
		const updatedLessons = [...currentLessons, ...newLessonInstances];
		await saveLessons(updatedLessons);

		// Update theme with assigned lessons
		const finalThemes = currentThemes.map(t =>
			t.id === theme.id
				? { ...t, assignedLessons: assignedLessonIds }
				: t
		);
		await saveThemes(finalThemes);
	};

	const handleDeleteTheme = async (id: string) => {
		if (confirm('Thema wirklich löschen? Alle Materialien werden ebenfalls gelöscht.')) {
			await saveThemes(themes.filter(t => t.id !== id));
			if (selectedTheme?.id === id) {
				setSelectedTheme(null);
			}
		}
	};

	// Duplicate theme for another class
	const handleDuplicateTheme = (theme: Theme) => {
		// Create a copy with new ID and cleared assignments
		const duplicatedTheme: Theme = {
			...theme,
			id: uuidv4(),
			name: `${theme.name} (Kopie)`,
			targetClass: '', // Clear so user must set new class
			assignedLessons: [],
			// Deep copy materials with new IDs
			materials: theme.materials.map(m => ({
				...m,
				id: uuidv4(),
			})),
		};

		// Open edit modal with duplicated theme (will be saved when user confirms)
		setEditingTheme(duplicatedTheme);
		setThemeForm({
			name: duplicatedTheme.name,
			description: duplicatedTheme.description || '',
			classLevel: duplicatedTheme.classLevel,
			targetClass: '',
			startWeek: duplicatedTheme.startWeek,
			endWeek: duplicatedTheme.endWeek,
			year: duplicatedTheme.year,
			totalLessons: duplicatedTheme.totalLessons,
		});
	};

	const resetThemeForm = () => {
		setThemeForm({
			name: '',
			description: '',
			classLevel: '',
			targetClass: '',
			startWeek: getCurrentWeek(),
			endWeek: getCurrentWeek() + 4,
			year: getCurrentYear(),
			totalLessons: 10,
		});
	};

	const openEditTheme = (theme: Theme) => {
		setEditingTheme(theme);
		setThemeForm({
			name: theme.name,
			description: theme.description || '',
			classLevel: theme.classLevel,
			targetClass: theme.targetClass || '',
			startWeek: theme.startWeek,
			endWeek: theme.endWeek,
			year: theme.year,
			totalLessons: theme.totalLessons,
		});
	};

	// Material handlers
	const handleAddMaterial = async () => {
		if (!selectedTheme || !materialForm.title) {
			alert('Bitte einen Titel angeben');
			return;
		}

		// URL normalisieren (https:// hinzufügen falls fehlt)
		const normalizeUrl = (url: string): string => {
			const trimmed = url.trim();
			if (!trimmed) return '';
			if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
				return trimmed;
			}
			return 'https://' + trimmed;
		};

		const normalizedUrl = normalizeUrl(materialForm.url);

		const newMaterial: Material = {
			id: uuidv4(),
			title: materialForm.title,
			type: materialForm.type,
			description: materialForm.description || undefined,
			plannedLessons: materialForm.plannedLessons,
			urls: normalizedUrl ? [normalizedUrl] : undefined,
		};

		const updatedThemes = themes.map(t =>
			t.id === selectedTheme.id
				? {
						...t,
						materials: [...(t.materials || []), newMaterial],
				  }
				: t
		);

		await saveThemes(updatedThemes);
		setSelectedTheme(updatedThemes.find(t => t.id === selectedTheme.id) || null);
		setShowMaterialModal(false);
		resetMaterialForm();
	};

	const handleUpdateMaterial = async () => {
		if (!selectedTheme || !editingMaterial) return;

		// URL normalisieren (https:// hinzufügen falls fehlt)
		const normalizeUrl = (url: string): string => {
			const trimmed = url.trim();
			if (!trimmed) return '';
			if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
				return trimmed;
			}
			return 'https://' + trimmed;
		};

		const normalizedUrl = normalizeUrl(materialForm.url);

		const updatedMaterials = (selectedTheme.materials || []).map(m =>
			m.id === editingMaterial.id
				? {
						...m,
						title: materialForm.title,
						type: materialForm.type,
						description: materialForm.description || undefined,
						plannedLessons: materialForm.plannedLessons,
						urls: normalizedUrl ? [normalizedUrl] : undefined,
				  }
				: m
		);

		const updatedThemes = themes.map(t =>
			t.id === selectedTheme.id
				? { ...t, materials: updatedMaterials }
				: t
		);

		await saveThemes(updatedThemes);
		setSelectedTheme(updatedThemes.find(t => t.id === selectedTheme.id) || null);
		setEditingMaterial(null);
		resetMaterialForm();
	};

	const handleDeleteMaterial = async (materialId: string) => {
		if (!selectedTheme) return;

		if (confirm('Material wirklich löschen?')) {
			const updatedMaterials = (selectedTheme.materials || []).filter(m => m.id !== materialId);
			const updatedThemes = themes.map(t =>
				t.id === selectedTheme.id
					? { ...t, materials: updatedMaterials }
					: t
			);

			await saveThemes(updatedThemes);
			setSelectedTheme(updatedThemes.find(t => t.id === selectedTheme.id) || null);
		}
	};

	const resetMaterialForm = () => {
		setMaterialForm({
			title: '',
			type: 'document',
			description: '',
			plannedLessons: 1,
			url: '',
		});
	};

	const openEditMaterial = (material: Material) => {
		setEditingMaterial(material);
		setMaterialForm({
			title: material.title,
			type: material.type,
			description: material.description || '',
			plannedLessons: material.plannedLessons ?? 1,
			url: material.urls?.[0] || '',
		});
	};

	const MATERIAL_TYPES: { value: Material['type']; label: string }[] = [
		{ value: 'document', label: 'Dokument' },
		{ value: 'exercise', label: 'Übung' },
		{ value: 'link', label: 'Link' },
		{ value: 'pdf', label: 'PDF' },
		{ value: 'video', label: 'Video' },
	];

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
				<div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
					<div className="flex items-center gap-4">
						<Link
							href="/"
							className="px-4 py-2 rounded-lg text-white"
							style={{ backgroundColor: 'var(--primary)' }}
						>
							Home
						</Link>
						<h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
							Oberthemen
						</h1>
					</div>
					<button
						onClick={() => {
							resetThemeForm();
							setShowThemeModal(true);
						}}
						className="px-4 py-2 rounded-lg text-white"
						style={{ backgroundColor: 'var(--secondary)' }}
					>
						+ Neues Thema
					</button>
				</div>
			</header>

			<main className="max-w-7xl mx-auto px-4 py-6">
				<div className="grid md:grid-cols-2 gap-6">
					{/* Theme List */}
					<div className="bg-white rounded-xl shadow-sm p-4">
						<h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
							Themen ({themes.length})
						</h2>

						{themes.length === 0 ? (
							<p className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
								Noch keine Themen erstellt
							</p>
						) : (
							<div className="space-y-2 max-h-[600px] overflow-y-auto">
								{themes.map(theme => (
									<div
										key={theme.id}
										onClick={() => setSelectedTheme(theme)}
										className={`p-4 rounded-lg cursor-pointer transition-all border-2 ${
											selectedTheme?.id === theme.id
												? 'border-blue-500'
												: 'border-transparent hover:bg-gray-50'
										}`}
									>
										<div className="flex items-start gap-3">
											<div className="flex-1">
												<h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
													{theme.name}
												</h3>
												<p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
													{theme.classLevel} {theme.targetClass && `(${theme.targetClass})`}
												</p>
												<p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
													KW {theme.startWeek}-{theme.endWeek} / {theme.year} • {theme.materials?.length || 0} Materialien
												</p>
												{hasActiveLessons(theme.id) && (
													<span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: 'var(--secondary)' }}>
														Aktiv
													</span>
												)}
											</div>
											<div className="flex gap-1 flex-wrap">
												{hasActiveLessons(theme.id) ? (
													<button
														onClick={e => { e.stopPropagation(); deactivateTheme(theme); }}
														className="px-2 py-1 rounded text-xs text-white"
														style={{ backgroundColor: 'var(--warning)' }}
													>
														Deaktivieren
													</button>
												) : (
													<button
														onClick={e => {
															e.stopPropagation();
															setActivatingTheme(theme);
															setShowActivateModal(true);
														}}
														className="px-2 py-1 rounded text-xs text-white"
														style={{ backgroundColor: 'var(--secondary)' }}
													>
														Aktivieren
													</button>
												)}
												<button
													onClick={e => { e.stopPropagation(); handleDuplicateTheme(theme); }}
													className="px-2 py-1 rounded text-xs"
													style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
													title="Für andere Klasse duplizieren"
												>
													Kopieren
												</button>
												<button
													onClick={e => { e.stopPropagation(); openEditTheme(theme); }}
													className="px-2 py-1 rounded text-xs"
													style={{ backgroundColor: 'var(--gray-200)' }}
												>
													Bearbeiten
												</button>
												<button
													onClick={e => { e.stopPropagation(); handleDeleteTheme(theme.id); }}
													className="px-2 py-1 rounded text-xs text-white"
													style={{ backgroundColor: 'var(--danger)' }}
												>
													X
												</button>
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>

					{/* Materials Panel */}
					<div className="bg-white rounded-xl shadow-sm p-4">
						{selectedTheme ? (
							<>
								<div className="flex justify-between items-start mb-4">
									<div>
										<h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
											{selectedTheme.name}
										</h2>
										{selectedTheme.description && (
											<p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
												{selectedTheme.description}
											</p>
										)}
									</div>
									<button
										onClick={() => {
											resetMaterialForm();
											setShowMaterialModal(true);
										}}
										className="px-3 py-1 rounded text-sm text-white"
										style={{ backgroundColor: 'var(--secondary)' }}
									>
										+ Material
									</button>
								</div>

								{(selectedTheme.materials?.length || 0) === 0 ? (
									<p className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
										Noch keine Materialien
									</p>
								) : (
									<div className="space-y-2 max-h-[500px] overflow-y-auto">
										{selectedTheme.materials?.map(material => (
											<div
												key={material.id}
												className="p-3 rounded-lg"
												style={{ backgroundColor: 'var(--gray-50)' }}
											>
												<div className="flex justify-between items-start">
													<div className="flex-1">
														<div className="flex items-center gap-2">
															<span className="font-medium">{material.title}</span>
															<span
																className="text-xs px-2 py-0.5 rounded"
																style={{ backgroundColor: 'var(--gray-200)' }}
															>
																{MATERIAL_TYPES.find(t => t.value === material.type)?.label}
															</span>
														</div>
														{material.description && (
															<p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
																{material.description}
															</p>
														)}
														{material.urls && material.urls.length > 0 && (
															<a
																href={material.urls[0]}
																target="_blank"
																rel="noopener noreferrer"
																className="text-sm mt-1 block underline truncate"
																style={{ color: 'var(--primary)' }}
															>
																{material.urls[0]}
															</a>
														)}
														{material.plannedLessons && (
														<p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
															{material.plannedLessons} Lektionen geplant
														</p>
													)}
													</div>
													<div className="flex gap-1">
														<button
															onClick={() => openEditMaterial(material)}
															className="px-2 py-1 rounded text-xs"
															style={{ backgroundColor: 'var(--gray-200)' }}
														>
															Bearbeiten
														</button>
														<button
															onClick={() => handleDeleteMaterial(material.id)}
															className="px-2 py-1 rounded text-xs text-white"
															style={{ backgroundColor: 'var(--danger)' }}
														>
															X
														</button>
													</div>
												</div>
											</div>
										))}
									</div>
								)}
							</>
						) : (
							<div className="flex items-center justify-center h-64">
								<p style={{ color: 'var(--text-secondary)' }}>
									Wähle ein Thema aus der Liste
								</p>
							</div>
						)}
					</div>
				</div>
			</main>

			{/* Theme Modal */}
			{(showThemeModal || editingTheme) && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-2xl p-6 w-full max-w-md">
						<h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
							{editingTheme
								? (themes.some(t => t.id === editingTheme.id)
									? 'Thema bearbeiten'
									: 'Thema duplizieren')
								: 'Neues Thema'}
						</h2>

						{/* Hint for duplicating */}
						{editingTheme && !themes.some(t => t.id === editingTheme.id) && (
							<div className="p-3 rounded-lg mb-4 text-sm" style={{ backgroundColor: 'var(--secondary-light)', color: 'var(--secondary)' }}>
								Passe Zielklasse und Zeitraum für die neue Kopie an. Alle Materialien werden übernommen.
							</div>
						)}

						{/* Hint for active themes */}
						{editingTheme && themes.some(t => t.id === editingTheme.id) && hasActiveLessons(editingTheme.id) && (
							<div className="p-3 rounded-lg mb-4 text-sm" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-dark)' }}>
								Dieses Thema ist aktiv. Änderungen an Zielklasse oder Zeitraum werden automatisch im Wochenplan übernommen.
							</div>
						)}

						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
									Name *
								</label>
								<input
									type="text"
									value={themeForm.name}
									onChange={e => setThemeForm({ ...themeForm, name: e.target.value })}
									className="w-full px-4 py-3 rounded-lg border-2"
									style={{ borderColor: 'var(--border)' }}
									placeholder="z.B. Algebra Grundlagen"
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
										Klassenstufe *
									</label>
									<input
										type="text"
										value={themeForm.classLevel}
										onChange={e => setThemeForm({ ...themeForm, classLevel: e.target.value })}
										className="w-full px-4 py-3 rounded-lg border-2"
										style={{ borderColor: 'var(--border)' }}
										placeholder="z.B. 5. Klasse"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
										Zielklasse
									</label>
									<input
										type="text"
										value={themeForm.targetClass}
										onChange={e => setThemeForm({ ...themeForm, targetClass: e.target.value })}
										className="w-full px-4 py-3 rounded-lg border-2"
										style={{ borderColor: 'var(--border)' }}
										placeholder="z.B. 5a"
									/>
								</div>
							</div>

							<div className="grid grid-cols-3 gap-4">
								<div>
									<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
										Start-KW
									</label>
									<input
										type="number"
										min="1"
										max="52"
										value={themeForm.startWeek}
										onChange={e => setThemeForm({ ...themeForm, startWeek: parseInt(e.target.value) || 1 })}
										className="w-full px-4 py-3 rounded-lg border-2"
										style={{ borderColor: 'var(--border)' }}
									/>
								</div>
								<div>
									<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
										End-KW
									</label>
									<input
										type="number"
										min="1"
										max="52"
										value={themeForm.endWeek}
										onChange={e => setThemeForm({ ...themeForm, endWeek: parseInt(e.target.value) || 1 })}
										className="w-full px-4 py-3 rounded-lg border-2"
										style={{ borderColor: 'var(--border)' }}
									/>
								</div>
								<div>
									<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
										Jahr
									</label>
									<input
										type="number"
										min="2024"
										max="2030"
										value={themeForm.year}
										onChange={e => setThemeForm({ ...themeForm, year: parseInt(e.target.value) || getCurrentYear() })}
										className="w-full px-4 py-3 rounded-lg border-2"
										style={{ borderColor: 'var(--border)' }}
									/>
								</div>
							</div>

							<div>
								<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
									Geplante Lektionen
								</label>
								<input
									type="number"
									min="1"
									value={themeForm.totalLessons}
									onChange={e => setThemeForm({ ...themeForm, totalLessons: parseInt(e.target.value) || 1 })}
									className="w-full px-4 py-3 rounded-lg border-2"
									style={{ borderColor: 'var(--border)' }}
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
									Beschreibung
								</label>
								<textarea
									value={themeForm.description}
									onChange={e => setThemeForm({ ...themeForm, description: e.target.value })}
									className="w-full px-4 py-3 rounded-lg border-2"
									style={{ borderColor: 'var(--border)' }}
									rows={3}
								/>
							</div>
						</div>

						<div className="flex gap-3 mt-6">
							<button
								onClick={() => {
									setShowThemeModal(false);
									setEditingTheme(null);
									resetThemeForm();
								}}
								className="flex-1 py-3 rounded-lg font-semibold"
								style={{ backgroundColor: 'var(--gray-200)', color: 'var(--text-primary)' }}
							>
								Abbrechen
							</button>
							<button
								onClick={editingTheme ? handleUpdateTheme : handleAddTheme}
								className="flex-1 py-3 rounded-lg font-semibold text-white"
								style={{ backgroundColor: 'var(--primary)' }}
							>
								{editingTheme ? 'Speichern' : 'Erstellen'}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Material Modal */}
			{(showMaterialModal || editingMaterial) && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-2xl p-6 w-full max-w-md">
						<h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
							{editingMaterial ? 'Material bearbeiten' : 'Neues Material'}
						</h2>

						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
									Titel *
								</label>
								<input
									type="text"
									value={materialForm.title}
									onChange={e => setMaterialForm({ ...materialForm, title: e.target.value })}
									className="w-full px-4 py-3 rounded-lg border-2"
									style={{ borderColor: 'var(--border)' }}
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
									Typ
								</label>
								<select
									value={materialForm.type}
									onChange={e => setMaterialForm({ ...materialForm, type: e.target.value as Material['type'] })}
									className="w-full px-4 py-3 rounded-lg border-2"
									style={{ borderColor: 'var(--border)' }}
								>
									{MATERIAL_TYPES.map(type => (
										<option key={type.value} value={type.value}>{type.label}</option>
									))}
								</select>
							</div>

							<div>
								<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
									Geplante Lektionen
								</label>
								<input
									type="number"
									min="1"
									value={materialForm.plannedLessons}
									onChange={e => setMaterialForm({ ...materialForm, plannedLessons: parseInt(e.target.value) || 1 })}
									className="w-full px-4 py-3 rounded-lg border-2"
									style={{ borderColor: 'var(--border)' }}
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
									Link / URL
								</label>
								<input
									type="url"
									value={materialForm.url}
									onChange={e => setMaterialForm({ ...materialForm, url: e.target.value })}
									className="w-full px-4 py-3 rounded-lg border-2"
									style={{ borderColor: 'var(--border)' }}
									placeholder="https://..."
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
									Beschreibung
								</label>
								<textarea
									value={materialForm.description}
									onChange={e => setMaterialForm({ ...materialForm, description: e.target.value })}
									className="w-full px-4 py-3 rounded-lg border-2"
									style={{ borderColor: 'var(--border)' }}
									rows={3}
								/>
							</div>
						</div>

						<div className="flex gap-3 mt-6">
							<button
								onClick={() => {
									setShowMaterialModal(false);
									setEditingMaterial(null);
									resetMaterialForm();
								}}
								className="flex-1 py-3 rounded-lg font-semibold"
								style={{ backgroundColor: 'var(--gray-200)', color: 'var(--text-primary)' }}
							>
								Abbrechen
							</button>
							<button
								onClick={editingMaterial ? handleUpdateMaterial : handleAddMaterial}
								className="flex-1 py-3 rounded-lg font-semibold text-white"
								style={{ backgroundColor: 'var(--primary)' }}
							>
								{editingMaterial ? 'Speichern' : 'Erstellen'}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Activate Theme Modal */}
			{showActivateModal && activatingTheme && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-2xl p-6 w-full max-w-lg">
						<h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
							Thema aktivieren
						</h2>

						<div className="space-y-4">
							<div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--gray-50)' }}>
								<h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
									{activatingTheme.name}
								</h3>
								<p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
									Klasse: {activatingTheme.targetClass || activatingTheme.classLevel}
								</p>
								<p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
									Zeitraum: KW {activatingTheme.startWeek} - {activatingTheme.endWeek} / {activatingTheme.year}
								</p>
								<p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
									Materialien: {activatingTheme.materials?.length || 0} (
									{activatingTheme.materials?.reduce((sum, m) => sum + (m.plannedLessons || 0), 0) || 0} Lektionen geplant)
								</p>
							</div>

							{/* Blockierungs-Warnung */}
							{(() => {
								const interferingBlockages = checkBlockages(
									activatingTheme.startWeek,
									activatingTheme.endWeek,
									activatingTheme.year
								);
								if (interferingBlockages.length > 0) {
									return (
										<div className="p-4 rounded-lg border-2" style={{ backgroundColor: '#fff3cd', borderColor: 'var(--warning)' }}>
											<p className="font-semibold" style={{ color: 'var(--warning)' }}>
												Achtung: Blockierungen im Zeitraum
											</p>
											<ul className="mt-2 text-sm" style={{ color: 'var(--text-primary)' }}>
												{interferingBlockages.map((b, i) => (
													<li key={i}>KW {b.week}: {b.title}</li>
												))}
											</ul>
											<p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
												Die Materialien werden trotzdem auf die verfügbaren Lektionen verteilt.
											</p>
										</div>
									);
								}
								return null;
							})()}

							<div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--primary-light)' }}>
								<p className="text-sm" style={{ color: 'var(--text-primary)' }}>
									Beim Aktivieren werden automatisch Lektionen für die Klasse{' '}
									<strong>{activatingTheme.targetClass || activatingTheme.classLevel}</strong> erstellt
									und die Materialien darauf verteilt.
								</p>
							</div>
						</div>

						<div className="flex gap-3 mt-6">
							<button
								onClick={() => {
									setShowActivateModal(false);
									setActivatingTheme(null);
								}}
								className="flex-1 py-3 rounded-lg font-semibold"
								style={{ backgroundColor: 'var(--gray-200)', color: 'var(--text-primary)' }}
							>
								Abbrechen
							</button>
							<button
								onClick={() => activateTheme(activatingTheme)}
								className="flex-1 py-3 rounded-lg font-semibold text-white"
								style={{ backgroundColor: 'var(--secondary)' }}
							>
								Aktivieren
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
