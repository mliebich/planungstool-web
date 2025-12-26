'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { storage } from '@/lib/services/storage';
import { Theme, Material, Lesson, Blockage, ThemeAssignment } from '@/lib/types';
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

	// Modals
	const [showThemeModal, setShowThemeModal] = useState(false);
	const [showMaterialModal, setShowMaterialModal] = useState(false);
	const [showAssignmentModal, setShowAssignmentModal] = useState(false);

	// Editing states
	const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
	const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
	const [editingAssignment, setEditingAssignment] = useState<ThemeAssignment | null>(null);

	// Forms
	const [themeForm, setThemeForm] = useState({
		name: '',
		description: '',
		classLevel: '',
		totalLessons: 10,
	});

	const [materialForm, setMaterialForm] = useState({
		title: '',
		type: 'document' as Material['type'],
		description: '',
		plannedLessons: 1,
		url: '',
	});

	const [assignmentForm, setAssignmentForm] = useState({
		targetClass: '',
		startWeek: getCurrentWeek(),
		endWeek: getCurrentWeek() + 4,
		year: getCurrentYear(),
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
				const parsed = JSON.parse(savedThemes);
				// Migrate old themes to new format
				const migrated = parsed.map(migrateTheme);
				setThemes(migrated);
				// Save migrated themes
				await storage.setItem('themes', JSON.stringify(migrated));
			}

			const savedLessons = await storage.getItem('lessons');
			if (savedLessons) {
				setLessons(JSON.parse(savedLessons));
			}

			const savedBlockages = await storage.getItem('blockages');
			if (savedBlockages) {
				const parsedBlockages = JSON.parse(savedBlockages);
				setBlockages(parsedBlockages.map((b: Blockage) => ({
					...b,
					startDate: new Date(b.startDate),
					endDate: new Date(b.endDate),
				})));
			}
		} catch (error) {
			console.error('Fehler beim Laden:', error);
		}
	};

	// Migrate old theme format to new format with assignments
	const migrateTheme = (theme: Theme): Theme => {
		if (theme.assignments && theme.assignments.length > 0) {
			return theme; // Already migrated
		}

		// Create assignment from old fields if they exist
		const assignments: ThemeAssignment[] = [];
		if (theme.targetClass || theme.startWeek) {
			assignments.push({
				id: uuidv4(),
				targetClass: theme.targetClass || theme.classLevel,
				startWeek: theme.startWeek || getCurrentWeek(),
				endWeek: theme.endWeek || getCurrentWeek() + 4,
				year: theme.year || getCurrentYear(),
				assignedLessons: theme.assignedLessons || [],
			});
		}

		return {
			...theme,
			assignments,
		};
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

	// Check if an assignment has active lessons
	const hasActiveLessons = (assignmentId: string) => {
		return lessons.some(lesson => lesson.assignmentId === assignmentId);
	};

	// Get active assignments count for a theme
	const getActiveAssignmentsCount = (theme: Theme) => {
		return theme.assignments?.filter(a => hasActiveLessons(a.id)).length || 0;
	};

	// Calculate week from date
	const getWeekFromDate = (date: Date): number => {
		const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
		const dayNum = d.getUTCDay() || 7;
		d.setUTCDate(d.getUTCDate() + 4 - dayNum);
		const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
		return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
	};

	// Check for blockages in time range
	const checkBlockages = (startWeek: number, endWeek: number): { week: number; title: string }[] => {
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

	// Activate an assignment
	const activateAssignment = async (theme: Theme, assignment: ThemeAssignment) => {
		const targetClass = assignment.targetClass;

		// Find base lessons for the target class
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

		// Sort lessons by day and time
		const sortedBaseLessons = [...baseLessonsForClass].sort((a, b) => {
			if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
			return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
		});

		// Calculate required lessons from materials
		const totalRequiredLessons = theme.materials.reduce((total, material) => {
			return total + (material.plannedLessons || 0);
		}, 0);

		// Calculate available lessons
		const weekCount = assignment.endWeek - assignment.startWeek + 1;
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

		// Create weeks array
		const weeksArray: number[] = [];
		for (let w = assignment.startWeek; w <= assignment.endWeek; w++) {
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
					id: `${baseLesson.id}_theme_${theme.id}_assign_${assignment.id}_week_${currentWeek}_${lessonInstanceId++}`,
					themeId: theme.id,
					assignmentId: assignment.id,
					plannedWeek: currentWeek,
					assignedMaterialId: material.id,
				};

				newLessonInstances.push(newLessonInstance);
				assignedLessonIds.push(newLessonInstance.id);
				totalLessonsCreated++;
			}
		}

		// Save updated lessons
		const updatedLessons = [...lessons, ...newLessonInstances];
		await saveLessons(updatedLessons);

		// Update assignment with assigned lessons
		const updatedThemes = themes.map(t =>
			t.id === theme.id
				? {
					...t,
					assignments: t.assignments.map(a =>
						a.id === assignment.id
							? { ...a, assignedLessons: assignedLessonIds }
							: a
					)
				}
				: t
		);
		await saveThemes(updatedThemes);

		// Update selected theme
		setSelectedTheme(updatedThemes.find(t => t.id === theme.id) || null);

		alert(`Zuweisung für "${targetClass}" aktiviert!\n\n${totalLessonsCreated} Lektionen wurden erstellt.`);
	};

	// Deactivate an assignment
	const deactivateAssignment = async (theme: Theme, assignment: ThemeAssignment) => {
		if (!confirm(`Zuweisung für "${assignment.targetClass}" wirklich deaktivieren?\n\nAlle zugewiesenen Lektionen werden entfernt.`)) {
			return;
		}

		// Remove all lessons for this assignment
		const updatedLessons = lessons.filter(lesson => lesson.assignmentId !== assignment.id);
		await saveLessons(updatedLessons);

		// Update assignment
		const updatedThemes = themes.map(t =>
			t.id === theme.id
				? {
					...t,
					assignments: t.assignments.map(a =>
						a.id === assignment.id
							? { ...a, assignedLessons: [] }
							: a
					)
				}
				: t
		);
		await saveThemes(updatedThemes);

		// Update selected theme
		setSelectedTheme(updatedThemes.find(t => t.id === theme.id) || null);
	};

	// Theme handlers
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
			materials: [],
			totalLessons: themeForm.totalLessons,
			assignments: [],
		};

		await saveThemes([...themes, newTheme]);
		setShowThemeModal(false);
		resetThemeForm();
	};

	const handleUpdateTheme = async () => {
		if (!editingTheme) return;

		const updatedThemes = themes.map(t =>
			t.id === editingTheme.id
				? {
					...t,
					name: themeForm.name,
					description: themeForm.description || undefined,
					classLevel: themeForm.classLevel,
					totalLessons: themeForm.totalLessons,
				}
				: t
		);

		await saveThemes(updatedThemes);
		setSelectedTheme(updatedThemes.find(t => t.id === editingTheme.id) || null);
		setEditingTheme(null);
		resetThemeForm();
	};

	const handleDeleteTheme = async (id: string) => {
		const theme = themes.find(t => t.id === id);
		const activeCount = theme ? getActiveAssignmentsCount(theme) : 0;

		if (activeCount > 0) {
			alert('Bitte zuerst alle Zuweisungen deaktivieren.');
			return;
		}

		if (confirm('Thema wirklich löschen? Alle Materialien und Zuweisungen werden ebenfalls gelöscht.')) {
			await saveThemes(themes.filter(t => t.id !== id));
			if (selectedTheme?.id === id) {
				setSelectedTheme(null);
			}
		}
	};

	const resetThemeForm = () => {
		setThemeForm({
			name: '',
			description: '',
			classLevel: '',
			totalLessons: 10,
		});
	};

	const openEditTheme = (theme: Theme) => {
		setEditingTheme(theme);
		setThemeForm({
			name: theme.name,
			description: theme.description || '',
			classLevel: theme.classLevel,
			totalLessons: theme.totalLessons,
		});
	};

	// Assignment handlers
	const handleAddAssignment = async () => {
		if (!selectedTheme || !assignmentForm.targetClass) {
			alert('Bitte Zielklasse angeben');
			return;
		}

		const newAssignment: ThemeAssignment = {
			id: uuidv4(),
			targetClass: assignmentForm.targetClass,
			startWeek: assignmentForm.startWeek,
			endWeek: assignmentForm.endWeek,
			year: assignmentForm.year,
			assignedLessons: [],
		};

		const updatedThemes = themes.map(t =>
			t.id === selectedTheme.id
				? { ...t, assignments: [...(t.assignments || []), newAssignment] }
				: t
		);

		await saveThemes(updatedThemes);
		setSelectedTheme(updatedThemes.find(t => t.id === selectedTheme.id) || null);
		setShowAssignmentModal(false);
		resetAssignmentForm();
	};

	const handleUpdateAssignment = async () => {
		if (!selectedTheme || !editingAssignment) return;

		const isActive = hasActiveLessons(editingAssignment.id);
		const classChanged = editingAssignment.targetClass !== assignmentForm.targetClass;
		const timeChanged =
			editingAssignment.startWeek !== assignmentForm.startWeek ||
			editingAssignment.endWeek !== assignmentForm.endWeek ||
			editingAssignment.year !== assignmentForm.year;

		// If active and class/time changed, need to reactivate
		if (isActive && (classChanged || timeChanged)) {
			// Deactivate first
			const lessonsWithoutAssignment = lessons.filter(l => l.assignmentId !== editingAssignment.id);
			await saveLessons(lessonsWithoutAssignment);
		}

		const updatedAssignment: ThemeAssignment = {
			...editingAssignment,
			targetClass: assignmentForm.targetClass,
			startWeek: assignmentForm.startWeek,
			endWeek: assignmentForm.endWeek,
			year: assignmentForm.year,
			assignedLessons: (isActive && (classChanged || timeChanged)) ? [] : editingAssignment.assignedLessons,
		};

		const updatedThemes = themes.map(t =>
			t.id === selectedTheme.id
				? {
					...t,
					assignments: t.assignments.map(a =>
						a.id === editingAssignment.id ? updatedAssignment : a
					)
				}
				: t
		);

		await saveThemes(updatedThemes);
		const updatedTheme = updatedThemes.find(t => t.id === selectedTheme.id);
		setSelectedTheme(updatedTheme || null);

		// Reactivate if was active
		if (isActive && (classChanged || timeChanged) && updatedTheme) {
			await activateAssignment(updatedTheme, updatedAssignment);
		}

		setEditingAssignment(null);
		resetAssignmentForm();
	};

	const handleDeleteAssignment = async (assignmentId: string) => {
		if (!selectedTheme) return;

		const assignment = selectedTheme.assignments.find(a => a.id === assignmentId);
		if (!assignment) return;

		if (hasActiveLessons(assignmentId)) {
			alert('Bitte zuerst die Zuweisung deaktivieren.');
			return;
		}

		if (confirm(`Zuweisung für "${assignment.targetClass}" wirklich löschen?`)) {
			const updatedThemes = themes.map(t =>
				t.id === selectedTheme.id
					? { ...t, assignments: t.assignments.filter(a => a.id !== assignmentId) }
					: t
			);
			await saveThemes(updatedThemes);
			setSelectedTheme(updatedThemes.find(t => t.id === selectedTheme.id) || null);
		}
	};

	const resetAssignmentForm = () => {
		setAssignmentForm({
			targetClass: '',
			startWeek: getCurrentWeek(),
			endWeek: getCurrentWeek() + 4,
			year: getCurrentYear(),
		});
	};

	const openEditAssignment = (assignment: ThemeAssignment) => {
		setEditingAssignment(assignment);
		setAssignmentForm({
			targetClass: assignment.targetClass,
			startWeek: assignment.startWeek,
			endWeek: assignment.endWeek,
			year: assignment.year,
		});
	};

	// Material handlers
	const handleAddMaterial = async () => {
		if (!selectedTheme || !materialForm.title) {
			alert('Bitte einen Titel angeben');
			return;
		}

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
				? { ...t, materials: [...(t.materials || []), newMaterial] }
				: t
		);

		await saveThemes(updatedThemes);
		setSelectedTheme(updatedThemes.find(t => t.id === selectedTheme.id) || null);
		setShowMaterialModal(false);
		resetMaterialForm();
	};

	const handleUpdateMaterial = async () => {
		if (!selectedTheme || !editingMaterial) return;

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

	// Calculate total planned lessons for theme
	const getTotalPlannedLessons = (theme: Theme) => {
		return theme.materials?.reduce((sum, m) => sum + (m.plannedLessons || 0), 0) || 0;
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
								{themes.map(theme => {
									const activeCount = getActiveAssignmentsCount(theme);
									const totalAssignments = theme.assignments?.length || 0;

									return (
										<div
											key={theme.id}
											onClick={() => setSelectedTheme(theme)}
											className={`p-4 rounded-lg cursor-pointer transition-all border-2 ${selectedTheme?.id === theme.id
												? 'border-blue-500'
												: 'border-transparent hover:bg-gray-50'
												}`}
										>
											<div className="flex items-start justify-between">
												<div className="flex-1">
													<h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
														{theme.name}
													</h3>
													<p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
														{theme.classLevel} • {theme.materials?.length || 0} Materialien ({getTotalPlannedLessons(theme)} Lektionen)
													</p>
													<div className="flex items-center gap-2 mt-1">
														{totalAssignments > 0 ? (
															<span className="text-xs px-2 py-0.5 rounded-full" style={{
																backgroundColor: activeCount > 0 ? 'var(--secondary)' : 'var(--gray-200)',
																color: activeCount > 0 ? 'white' : 'var(--text-secondary)'
															}}>
																{activeCount}/{totalAssignments} Zuweisungen aktiv
															</span>
														) : (
															<span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
																Keine Zuweisungen
															</span>
														)}
													</div>
												</div>
												<div className="flex gap-1">
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
									);
								})}
							</div>
						)}
					</div>

					{/* Detail Panel */}
					<div className="space-y-4">
						{selectedTheme ? (
							<>
								{/* Assignments Section */}
								<div className="bg-white rounded-xl shadow-sm p-4">
									<div className="flex justify-between items-center mb-4">
										<h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
											Zuweisungen
										</h2>
										<button
											onClick={() => {
												resetAssignmentForm();
												setShowAssignmentModal(true);
											}}
											className="px-3 py-1 rounded text-sm text-white"
											style={{ backgroundColor: 'var(--primary)' }}
										>
											+ Zuweisung
										</button>
									</div>

									{(selectedTheme.assignments?.length || 0) === 0 ? (
										<div className="text-center py-6" style={{ backgroundColor: 'var(--gray-50)', borderRadius: '8px' }}>
											<p style={{ color: 'var(--text-secondary)' }}>
												Noch keine Klassen zugewiesen
											</p>
											<p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
												Füge eine Zuweisung hinzu, um das Thema einer Klasse zuzuordnen
											</p>
										</div>
									) : (
										<div className="space-y-2">
											{selectedTheme.assignments.map(assignment => {
												const isActive = hasActiveLessons(assignment.id);
												const blockageWarnings = checkBlockages(assignment.startWeek, assignment.endWeek);

												return (
													<div
														key={assignment.id}
														className="p-3 rounded-lg border"
														style={{
															borderColor: isActive ? 'var(--secondary)' : 'var(--border)',
															backgroundColor: isActive ? 'var(--secondary-light)' : 'var(--gray-50)'
														}}
													>
														<div className="flex items-start justify-between">
															<div>
																<div className="flex items-center gap-2">
																	<span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
																		{assignment.targetClass}
																	</span>
																	{isActive && (
																		<span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: 'var(--secondary)' }}>
																			Aktiv
																		</span>
																	)}
																</div>
																<p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
																	KW {assignment.startWeek}-{assignment.endWeek} / {assignment.year}
																</p>
																{blockageWarnings.length > 0 && (
																	<p className="text-xs mt-1" style={{ color: 'var(--warning)' }}>
																		⚠️ {blockageWarnings.length} Sperrzeit(en) im Zeitraum
																	</p>
																)}
															</div>
															<div className="flex gap-1">
																{isActive ? (
																	<button
																		onClick={() => deactivateAssignment(selectedTheme, assignment)}
																		className="px-2 py-1 rounded text-xs text-white"
																		style={{ backgroundColor: 'var(--warning)' }}
																	>
																		Deaktivieren
																	</button>
																) : (
																	<button
																		onClick={() => activateAssignment(selectedTheme, assignment)}
																		className="px-2 py-1 rounded text-xs text-white"
																		style={{ backgroundColor: 'var(--secondary)' }}
																	>
																		Aktivieren
																	</button>
																)}
																<button
																	onClick={() => openEditAssignment(assignment)}
																	className="px-2 py-1 rounded text-xs"
																	style={{ backgroundColor: 'var(--gray-200)' }}
																>
																	✏️
																</button>
																<button
																	onClick={() => handleDeleteAssignment(assignment.id)}
																	className="px-2 py-1 rounded text-xs text-white"
																	style={{ backgroundColor: 'var(--danger)' }}
																>
																	X
																</button>
															</div>
														</div>
													</div>
												);
											})}
										</div>
									)}
								</div>

								{/* Materials Section */}
								<div className="bg-white rounded-xl shadow-sm p-4">
									<div className="flex justify-between items-center mb-4">
										<div>
											<h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
												Materialien
											</h2>
											<p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
												{selectedTheme.name}
											</p>
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
										<p className="text-center py-6" style={{ color: 'var(--text-secondary)' }}>
											Noch keine Materialien
										</p>
									) : (
										<div className="space-y-2 max-h-[400px] overflow-y-auto">
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
																<p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
																	{material.plannedLessons} Lektion(en)
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
								</div>
							</>
						) : (
							<div className="bg-white rounded-xl shadow-sm p-4">
								<div className="flex items-center justify-center h-64">
									<p style={{ color: 'var(--text-secondary)' }}>
										Wähle ein Thema aus der Liste
									</p>
								</div>
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
							{editingTheme ? 'Thema bearbeiten' : 'Neues Thema'}
						</h2>

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
									placeholder="z.B. Bruchrechnen"
								/>
							</div>

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

			{/* Assignment Modal */}
			{(showAssignmentModal || editingAssignment) && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-2xl p-6 w-full max-w-md">
						<h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
							{editingAssignment ? 'Zuweisung bearbeiten' : 'Neue Zuweisung'}
						</h2>

						{editingAssignment && hasActiveLessons(editingAssignment.id) && (
							<div className="p-3 rounded-lg mb-4 text-sm" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-dark)' }}>
								Diese Zuweisung ist aktiv. Änderungen werden automatisch im Wochenplan übernommen.
							</div>
						)}

						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
									Zielklasse *
								</label>
								<input
									type="text"
									value={assignmentForm.targetClass}
									onChange={e => setAssignmentForm({ ...assignmentForm, targetClass: e.target.value })}
									className="w-full px-4 py-3 rounded-lg border-2"
									style={{ borderColor: 'var(--border)' }}
									placeholder="z.B. 5a"
								/>
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
										value={assignmentForm.startWeek}
										onChange={e => setAssignmentForm({ ...assignmentForm, startWeek: parseInt(e.target.value) || 1 })}
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
										value={assignmentForm.endWeek}
										onChange={e => setAssignmentForm({ ...assignmentForm, endWeek: parseInt(e.target.value) || 1 })}
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
										value={assignmentForm.year}
										onChange={e => setAssignmentForm({ ...assignmentForm, year: parseInt(e.target.value) || getCurrentYear() })}
										className="w-full px-4 py-3 rounded-lg border-2"
										style={{ borderColor: 'var(--border)' }}
									/>
								</div>
							</div>

							{/* Blockage warnings */}
							{(() => {
								const warnings = checkBlockages(assignmentForm.startWeek, assignmentForm.endWeek);
								if (warnings.length > 0) {
									return (
										<div className="p-3 rounded-lg" style={{ backgroundColor: '#fff3cd', borderColor: 'var(--warning)' }}>
											<p className="text-sm font-medium" style={{ color: 'var(--warning)' }}>
												Sperrzeiten im Zeitraum:
											</p>
											<ul className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
												{warnings.map((w, i) => (
													<li key={i}>KW {w.week}: {w.title}</li>
												))}
											</ul>
										</div>
									);
								}
								return null;
							})()}
						</div>

						<div className="flex gap-3 mt-6">
							<button
								onClick={() => {
									setShowAssignmentModal(false);
									setEditingAssignment(null);
									resetAssignmentForm();
								}}
								className="flex-1 py-3 rounded-lg font-semibold"
								style={{ backgroundColor: 'var(--gray-200)', color: 'var(--text-primary)' }}
							>
								Abbrechen
							</button>
							<button
								onClick={editingAssignment ? handleUpdateAssignment : handleAddAssignment}
								className="flex-1 py-3 rounded-lg font-semibold text-white"
								style={{ backgroundColor: 'var(--primary)' }}
							>
								{editingAssignment ? 'Speichern' : 'Hinzufügen'}
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
		</div>
	);
}
