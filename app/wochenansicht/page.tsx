'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { storage } from '@/lib/services/storage';
import settingsService from '@/lib/services/settingsService';
import { Lesson, Theme, WeekPlan } from '@/lib/types';
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

	const getLessonForSlot = (dayIndex: number, timeSlot: string) => {
		const [slotStart] = timeSlot.split('-');
		return lessons.find(
			l => l.dayOfWeek === dayIndex && l.startTime === slotStart
		);
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

			{/* Print Header (hidden on screen) */}
			<div className="print-header hidden">
				<h1>Wochenansicht - KW {currentWeek} / {currentYear}</h1>
				<p>Gedruckt am {new Date().toLocaleDateString('de-DE')}</p>
			</div>

			<main className="max-w-7xl mx-auto px-4 py-6">
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
												<div>{day.name}</div>
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
											const lesson = getLessonForSlot(day.index, timeSlot);
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
															className="p-2 rounded-lg text-white min-h-[80px] cursor-pointer hover:opacity-90"
															style={{ backgroundColor: bgColor }}
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
