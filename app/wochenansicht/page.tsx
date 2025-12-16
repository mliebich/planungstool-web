'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { storage } from '@/lib/services/storage';
import settingsService from '@/lib/services/settingsService';
import { Lesson, Theme, WeekPlan, Material } from '@/lib/types';
import { DayOfWeek } from '@/lib/types/settings';
import { getCurrentWeek, getCurrentYear, getWeekDays, formatDate } from '@/lib/utils/dateUtils';
import { getClassColor, ClassColorConfig } from '@/lib/utils/colorUtils';
import Link from 'next/link';

const ALL_DAYS_OF_WEEK = [
	{ index: 1, name: 'Montag' },
	{ index: 2, name: 'Dienstag' },
	{ index: 3, name: 'Mittwoch' },
	{ index: 4, name: 'Donnerstag' },
	{ index: 5, name: 'Freitag' },
	{ index: 6, name: 'Samstag' },
	{ index: 0, name: 'Sonntag' },
];

const TIME_SLOTS = [
	'08:00-08:45',
	'08:55-09:40',
	'10:00-10:45',
	'10:55-11:40',
	'11:45-12:30',
	'13:30-14:15',
	'14:25-15:10',
	'15:20-16:05',
];

function WochenansichtContent() {
	const { isAuthenticated, isLoading } = useAuth();
	const router = useRouter();
	const searchParams = useSearchParams();

	const [currentWeek, setCurrentWeek] = useState(getCurrentWeek());
	const [currentYear, setCurrentYear] = useState(getCurrentYear());
	const [lessons, setLessons] = useState<Lesson[]>([]);
	const [themes, setThemes] = useState<Theme[]>([]);
	const [weekPlan, setWeekPlan] = useState<WeekPlan | null>(null);
	const [visibleDays, setVisibleDays] = useState<Array<{ index: number; name: string }>>([]);
	const [customColors, setCustomColors] = useState<ClassColorConfig>({});
	const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
	const [printDay, setPrintDay] = useState<{ index: number; name: string; date: Date } | null>(null);

	useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			router.push('/login');
		}
	}, [isAuthenticated, isLoading, router]);

	useEffect(() => {
		const week = searchParams.get('week');
		const year = searchParams.get('year');
		if (week) setCurrentWeek(parseInt(week));
		if (year) setCurrentYear(parseInt(year));
	}, [searchParams]);

	useEffect(() => {
		if (isAuthenticated) {
			loadData();
		}
	}, [isAuthenticated, currentWeek, currentYear]);

	const loadData = async () => {
		try {
			// Load settings for visible days
			const settings = await settingsService.getSettings();
			const days = ALL_DAYS_OF_WEEK.filter(day =>
				settings.visibleWeekdays.includes(day.index as DayOfWeek)
			);
			setVisibleDays(days);

			// Load lessons
			const savedLessons = await storage.getItem('lessons');
			if (savedLessons) {
				setLessons(JSON.parse(savedLessons));
			}

			// Load themes
			const savedThemes = await storage.getItem('themes');
			if (savedThemes) {
				setThemes(JSON.parse(savedThemes));
			}

			// Load week plan
			const savedWeekPlans = await storage.getItem('weekPlans');
			if (savedWeekPlans) {
				const plans = JSON.parse(savedWeekPlans);
				const currentPlan = plans.find(
					(p: WeekPlan) => p.weekNumber === currentWeek && p.year === currentYear
				);
				setWeekPlan(currentPlan || null);
			}

			// Load custom colors
			const savedColors = await storage.getItem('customClassColors');
			if (savedColors) {
				setCustomColors(JSON.parse(savedColors));
			}
		} catch (error) {
			console.error('Fehler beim Laden:', error);
		}
	};

	const navigateWeek = (direction: number) => {
		let newWeek = currentWeek + direction;
		let newYear = currentYear;

		if (newWeek < 1) {
			newWeek = 52;
			newYear--;
		} else if (newWeek > 52) {
			newWeek = 1;
			newYear++;
		}

		setCurrentWeek(newWeek);
		setCurrentYear(newYear);
	};

	const goToCurrentWeek = () => {
		setCurrentWeek(getCurrentWeek());
		setCurrentYear(getCurrentYear());
	};

	const getLessonsForSlot = (dayIndex: number, timeSlot: string) => {
		const [slotStart] = timeSlot.split('-');

		// Finde alle Lektionen für diesen Slot
		const slotLessons = lessons.filter(l => l.dayOfWeek === dayIndex && l.startTime === slotStart);

		// Priorisiere Theme-Lektionen mit passender plannedWeek
		const themeLessonsForWeek = slotLessons.filter(l =>
			l.themeId && l.plannedWeek === currentWeek
		);

		// Falls Theme-Lektionen für diese Woche existieren, zeige diese
		if (themeLessonsForWeek.length > 0) {
			return themeLessonsForWeek[0];
		}

		// Ansonsten zeige normale Lektionen (ohne Thema)
		const normalLessons = slotLessons.filter(l => !l.themeId);
		return normalLessons.length > 0 ? normalLessons[0] : null;
	};

	const getThemeForLesson = (lesson: Lesson) => {
		if (!lesson.themeId) return null;
		return themes.find(t => t.id === lesson.themeId);
	};

	const getMaterialForLesson = (lesson: Lesson) => {
		if (!lesson.assignedMaterialId) return null;
		const theme = getThemeForLesson(lesson);
		if (!theme) return null;
		return theme.materials?.find(m => m.id === lesson.assignedMaterialId);
	};

	// Alle Lektionen für einen Tag (sortiert nach Zeit)
	const getLessonsForDay = (dayIndex: number) => {
		return lessons
			.filter(l => {
				if (l.dayOfWeek !== dayIndex) return false;
				// Theme-Lektionen nur für die aktuelle Woche
				if (l.themeId && l.plannedWeek !== currentWeek) return false;
				// Normale Lektionen ohne Thema immer anzeigen, aber nicht wenn es eine Theme-Lektion gibt
				if (!l.themeId) {
					const hasThemeLesson = lessons.some(
						tl => tl.dayOfWeek === dayIndex &&
						      tl.startTime === l.startTime &&
						      tl.themeId &&
						      tl.plannedWeek === currentWeek
					);
					if (hasThemeLesson) return false;
				}
				return true;
			})
			.sort((a, b) => {
				const aMinutes = parseInt(a.startTime.split(':')[0]) * 60 + parseInt(a.startTime.split(':')[1]);
				const bMinutes = parseInt(b.startTime.split(':')[0]) * 60 + parseInt(b.startTime.split(':')[1]);
				return aMinutes - bMinutes;
			});
	};

	// Druckt die Tagesübersicht direkt
	useEffect(() => {
		if (printDay) {
			// Kurze Verzögerung damit das DOM aktualisiert wird
			const timer = setTimeout(() => {
				window.print();
			}, 100);
			return () => clearTimeout(timer);
		}
	}, [printDay]);

	const weekDays = getWeekDays(currentWeek, currentYear);

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
							Wochenansicht
						</h1>
					</div>

					{/* Week Navigation */}
					<div className="flex items-center gap-4">
						<button
							onClick={() => navigateWeek(-1)}
							className="px-3 py-2 rounded-lg"
							style={{ backgroundColor: 'var(--gray-200)' }}
						>
							&#8592;
						</button>
						<div className="text-center">
							<div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
								KW {currentWeek} / {currentYear}
							</div>
							<button
								onClick={goToCurrentWeek}
								className="text-xs underline"
								style={{ color: 'var(--primary)' }}
							>
								Heute
							</button>
						</div>
						<button
							onClick={() => navigateWeek(1)}
							className="px-3 py-2 rounded-lg"
							style={{ backgroundColor: 'var(--gray-200)' }}
						>
							&#8594;
						</button>
						<button
							onClick={() => window.print()}
							className="px-4 py-2 rounded-lg ml-2"
							style={{ backgroundColor: 'var(--gray-200)', color: 'var(--text-primary)' }}
						>
							🖨️
						</button>
					</div>
				</div>
			</header>

			{/* Print Header for week view (hidden on screen, hidden when printing day) */}
			<div className={`print-header hidden ${printDay ? 'no-print' : ''}`}>
				<h1>Wochenansicht - KW {currentWeek} / {currentYear}</h1>
				<p>Gedruckt am {new Date().toLocaleDateString('de-DE')}</p>
			</div>

			<main className={`max-w-7xl mx-auto px-4 py-6 ${printDay ? 'no-print' : ''}`}>
				{visibleDays.length === 0 ? (
					<div className="bg-white rounded-xl p-8 text-center shadow-sm">
						<p style={{ color: 'var(--text-secondary)' }}>
							Keine Wochentage ausgewählt. Gehe zu den Einstellungen, um sichtbare Tage zu konfigurieren.
						</p>
						<Link
							href="/einstellungen"
							className="mt-4 inline-block px-4 py-2 rounded-lg text-white"
							style={{ backgroundColor: 'var(--primary)' }}
						>
							Zu den Einstellungen
						</Link>
					</div>
				) : (
					<div className="bg-white rounded-xl shadow-sm overflow-x-auto">
						<table className="w-full border-collapse">
							<thead>
								<tr>
									<th
										className="p-3 border-b text-left sticky left-0 bg-white"
										style={{ width: '100px' }}
									>
										Zeit
									</th>
									{visibleDays.map((day) => {
										const dayDate = weekDays[day.index === 0 ? 6 : day.index - 1];
										return (
											<th
												key={day.index}
												className="p-3 border-b text-center font-semibold"
												style={{ backgroundColor: 'var(--gray-50)', minWidth: '150px' }}
											>
												<div className="flex items-center justify-center gap-2">
													<span>{day.name}</span>
													{dayDate && (
														<button
															onClick={() => setPrintDay({ index: day.index, name: day.name, date: dayDate })}
															className="text-xs px-1.5 py-0.5 rounded opacity-60 hover:opacity-100 transition-opacity"
															style={{ backgroundColor: 'var(--gray-200)' }}
															title="Tag drucken"
														>
															🖨️
														</button>
													)}
												</div>
												{dayDate && (
													<div className="text-xs font-normal" style={{ color: 'var(--text-secondary)' }}>
														{formatDate(dayDate)}
													</div>
												)}
											</th>
										);
									})}
								</tr>
							</thead>
							<tbody>
								{TIME_SLOTS.map(timeSlot => (
									<tr key={timeSlot}>
										<td
											className="p-2 border-b text-sm font-medium sticky left-0 bg-white"
											style={{ color: 'var(--text-secondary)' }}
										>
											{timeSlot}
										</td>
										{visibleDays.map(day => {
											const lesson = getLessonsForSlot(day.index, timeSlot);
											const theme = lesson ? getThemeForLesson(lesson) : null;
											const material = lesson ? getMaterialForLesson(lesson) : null;
											const bgColor = lesson?.class
												? getClassColor(lesson.class, customColors)
												: 'var(--gray-100)';

											return (
												<td
													key={day.index}
													className="p-1 border-b border-r"
												>
													{lesson ? (
														<div
															className="p-2 rounded-lg text-white min-h-[80px] cursor-pointer hover:opacity-90 transition-opacity"
															style={{ backgroundColor: bgColor }}
															onClick={() => setSelectedLesson(lesson)}
														>
															<div className="font-semibold text-sm">{lesson.subject}</div>
															{lesson.class && (
																<div className="text-xs opacity-90">{lesson.class}</div>
															)}
															{lesson.room && (
																<div className="text-xs opacity-75">{lesson.room}</div>
															)}
															{theme && (
																<div
																	className="mt-1 text-xs px-1 py-0.5 rounded bg-white/20"
																	title={theme.name}
																>
																	{theme.name.substring(0, 15)}...
																</div>
															)}
															{material && (
																<div
																	className="text-xs opacity-75 truncate"
																	title={material.title}
																>
																	{material.title}
																</div>
															)}
														</div>
													) : (
														<div
															className="min-h-[80px] rounded-lg"
															style={{ backgroundColor: 'var(--gray-50)' }}
														/>
													)}
												</td>
											);
										})}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{/* Legend */}
				<div className="mt-6 p-4 bg-white rounded-xl shadow-sm">
					<h3 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
						Legende
					</h3>
					<div className="flex flex-wrap gap-2">
						{[...new Set(lessons.map(l => l.class).filter(Boolean))].map(className => (
							<div
								key={className}
								className="px-3 py-1 rounded-full text-white text-sm"
								style={{ backgroundColor: getClassColor(className!, customColors) }}
							>
								{className}
							</div>
						))}
					</div>
				</div>

				{/* Week Notes */}
				{weekPlan?.notes && (
					<div className="mt-6 p-4 bg-white rounded-xl shadow-sm">
						<h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
							Notizen für KW {currentWeek}
						</h3>
						<p style={{ color: 'var(--text-secondary)' }}>{weekPlan.notes}</p>
					</div>
				)}

				{/* Print Button */}
				<div className="mt-6 flex justify-center">
					<button
						onClick={() => window.print()}
						className="px-6 py-3 rounded-lg text-white font-medium"
						style={{ backgroundColor: 'var(--secondary)' }}
					>
						Wochenplan drucken
					</button>
				</div>
			</main>

			{/* Lesson Detail Modal */}
			{selectedLesson && (
				<div
					className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
					onClick={() => setSelectedLesson(null)}
				>
					<div
						className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
						onClick={e => e.stopPropagation()}
					>
						{(() => {
							const theme = getThemeForLesson(selectedLesson);
							const material = getMaterialForLesson(selectedLesson);
							const bgColor = selectedLesson.class
								? getClassColor(selectedLesson.class, customColors)
								: 'var(--primary)';

							return (
								<>
									{/* Header */}
									<div
										className="p-4 rounded-xl text-white mb-4"
										style={{ backgroundColor: bgColor }}
									>
										<h2 className="text-xl font-bold">{selectedLesson.subject}</h2>
										<div className="flex flex-wrap gap-2 mt-2 text-sm opacity-90">
											{selectedLesson.class && <span>{selectedLesson.class}</span>}
											{selectedLesson.room && <span>• {selectedLesson.room}</span>}
											<span>• {selectedLesson.startTime} - {selectedLesson.endTime}</span>
										</div>
									</div>

									{/* Theme Info */}
									{theme && (
										<div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--primary-light)' }}>
											<h3 className="font-semibold mb-1" style={{ color: 'var(--primary)' }}>
												Thema
											</h3>
											<p className="font-medium" style={{ color: 'var(--text-primary)' }}>
												{theme.name}
											</p>
											{theme.description && (
												<p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
													{theme.description}
												</p>
											)}
											<p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
												KW {theme.startWeek} - {theme.endWeek} / {theme.year}
											</p>
										</div>
									)}

									{/* Material Info */}
									{material && (
										<div className="mb-4 p-4 rounded-lg border-2" style={{ borderColor: 'var(--secondary)', backgroundColor: 'var(--secondary-light)' }}>
											<h3 className="font-semibold mb-2" style={{ color: 'var(--secondary)' }}>
												Material für diese Lektion
											</h3>
											<div className="space-y-2">
												<div className="flex items-center gap-2">
													<span className="text-lg">
														{material.type === 'link' ? '🔗' :
														 material.type === 'pdf' ? '📄' :
														 material.type === 'video' ? '🎬' :
														 material.type === 'exercise' ? '✏️' : '📝'}
													</span>
													<span className="font-medium" style={{ color: 'var(--text-primary)' }}>
														{material.title}
													</span>
												</div>
												{material.description && (
													<p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
														{material.description}
													</p>
												)}
												{material.urls && material.urls.length > 0 && (
													<div className="mt-2 space-y-1">
														{material.urls.map((url, i) => (
															<a
																key={i}
																href={url}
																target="_blank"
																rel="noopener noreferrer"
																className="block text-sm underline"
																style={{ color: 'var(--primary)' }}
															>
																{url}
															</a>
														))}
													</div>
												)}
												{material.plannedLessons && (
													<p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
														Geplant für {material.plannedLessons} Lektion(en)
													</p>
												)}
											</div>
										</div>
									)}

									{/* No Material */}
									{!material && !theme && (
										<div className="mb-4 p-4 rounded-lg text-center" style={{ backgroundColor: 'var(--gray-50)' }}>
											<p style={{ color: 'var(--text-secondary)' }}>
												Keine Materialien zugewiesen
											</p>
										</div>
									)}

									{/* Close Button */}
									<button
										onClick={() => setSelectedLesson(null)}
										className="w-full py-3 rounded-lg font-semibold"
										style={{ backgroundColor: 'var(--gray-200)', color: 'var(--text-primary)' }}
									>
										Schliessen
									</button>
								</>
							);
						})()}
					</div>
				</div>
			)}

			{/* Print Day Modal */}
			{printDay && (
				<>
					{/* Screen version with close button */}
					<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 no-print">
						<div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
							<div className="flex justify-between items-start mb-4">
								<div>
									<h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
										{printDay.name}, {formatDate(printDay.date)}
									</h2>
									<p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
										KW {currentWeek} / {currentYear}
									</p>
								</div>
								<button
									onClick={() => setPrintDay(null)}
									className="text-2xl px-2"
									style={{ color: 'var(--text-secondary)' }}
								>
									×
								</button>
							</div>

							{/* Lessons List */}
							<div className="space-y-4">
								{getLessonsForDay(printDay.index).length === 0 ? (
									<p className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
										Keine Lektionen an diesem Tag
									</p>
								) : (
									getLessonsForDay(printDay.index).map(lesson => {
										const theme = getThemeForLesson(lesson);
										const material = getMaterialForLesson(lesson);
										const bgColor = lesson.class
											? getClassColor(lesson.class, customColors)
											: 'var(--primary)';

										return (
											<div key={lesson.id} className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
												{/* Lesson Header */}
												<div className="p-3 text-white" style={{ backgroundColor: bgColor }}>
													<div className="flex justify-between items-center">
														<span className="font-bold">{lesson.startTime} - {lesson.endTime}</span>
														<span className="text-sm opacity-90">{lesson.room}</span>
													</div>
													<div className="font-semibold text-lg">{lesson.subject}</div>
													{lesson.class && <div className="text-sm opacity-90">{lesson.class}</div>}
												</div>

												{/* Theme & Material */}
												{(theme || material) && (
													<div className="p-3" style={{ backgroundColor: 'var(--gray-50)' }}>
														{theme && (
															<div className="mb-2">
																<span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>THEMA:</span>
																<span className="ml-2" style={{ color: 'var(--text-primary)' }}>{theme.name}</span>
															</div>
														)}
														{material && (
															<div className="p-2 rounded-lg" style={{ backgroundColor: 'white', border: '1px solid var(--border)' }}>
																<div className="flex items-center gap-2">
																	<span>
																		{material.type === 'link' ? '🔗' :
																		 material.type === 'pdf' ? '📄' :
																		 material.type === 'video' ? '🎬' :
																		 material.type === 'exercise' ? '✏️' : '📝'}
																	</span>
																	<span className="font-medium" style={{ color: 'var(--text-primary)' }}>
																		{material.title}
																	</span>
																</div>
																{material.description && (
																	<p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
																		{material.description}
																	</p>
																)}
															</div>
														)}
													</div>
												)}
											</div>
										);
									})
								)}
							</div>

							{/* Button */}
							<div className="mt-6">
								<button
									onClick={() => setPrintDay(null)}
									className="w-full py-3 rounded-lg font-semibold"
									style={{ backgroundColor: 'var(--gray-200)', color: 'var(--text-primary)' }}
								>
									Schliessen
								</button>
							</div>
						</div>
					</div>

					{/* Print-only version */}
					<div className="print-only print-day-overview">
						<div className="print-day-header">
							<h1>{printDay.name}, {formatDate(printDay.date)}</h1>
							<p>KW {currentWeek} / {currentYear}</p>
						</div>

						<div className="print-day-lessons">
							{getLessonsForDay(printDay.index).map(lesson => {
								const theme = getThemeForLesson(lesson);
								const material = getMaterialForLesson(lesson);

								return (
									<div key={lesson.id} className="print-lesson-card">
										<div className="print-lesson-time">
											{lesson.startTime}
										</div>
										<div className="print-lesson-content">
											<div className="print-lesson-subject">
												{lesson.subject}
												{lesson.class && <span className="print-lesson-class"> ({lesson.class})</span>}
												{lesson.room && <span className="print-lesson-room"> • {lesson.room}</span>}
											</div>
											{theme && (
												<div className="print-lesson-theme">
													{theme.name}
												</div>
											)}
											{material && (
												<div className="print-lesson-material">
													<strong>{material.title}</strong>
													{material.description && <p>{material.description}</p>}
													{material.urls && material.urls.length > 0 && (
														<>
															{material.urls.map((url, i) => (
																<a key={i} href={url}>{url}</a>
															))}
														</>
													)}
												</div>
											)}
										</div>
									</div>
								);
							})}
						</div>

						<div className="print-day-footer">
							{new Date().toLocaleDateString('de-DE')}
						</div>
					</div>
				</>
			)}
		</div>
	);
}

export default function WochenansichtPage() {
	return (
		<Suspense fallback={
			<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--gray-50)' }}>
				<div className="text-4xl animate-spin">...</div>
			</div>
		}>
			<WochenansichtContent />
		</Suspense>
	);
}
