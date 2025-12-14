'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { storage } from '@/lib/services/storage';
import examService from '@/lib/services/examService';
import settingsService from '@/lib/services/settingsService';
import classService from '@/lib/services/classService';
import { Lesson, Exam, Class, Blockage } from '@/lib/types';
import { DayOfWeek } from '@/lib/types/settings';
import { getWeek } from 'date-fns';
import Link from 'next/link';

const MONTH_NAMES = [
	'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
	'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const WEEKDAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export default function MonatsansichtPage() {
	const { isAuthenticated, isLoading } = useAuth();
	const router = useRouter();

	const [currentDate, setCurrentDate] = useState(new Date());
	const [lessons, setLessons] = useState<Lesson[]>([]);
	const [exams, setExams] = useState<Exam[]>([]);
	const [classes, setClasses] = useState<Class[]>([]);
	const [blockages, setBlockages] = useState<Blockage[]>([]);
	const [visibleDays, setVisibleDays] = useState<number[]>([1, 2, 3, 4, 5]);
	const [selectedDate, setSelectedDate] = useState<Date | null>(null);

	const currentMonth = currentDate.getMonth();
	const currentYear = currentDate.getFullYear();

	useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			router.push('/login');
		}
	}, [isAuthenticated, isLoading, router]);

	useEffect(() => {
		if (isAuthenticated) {
			loadData();
		}
	}, [isAuthenticated, currentMonth, currentYear]);

	const loadData = async () => {
		try {
			// Load settings for visible days
			const settings = await settingsService.getSettings();
			const days = settings.visibleWeekdays.map(d => d === 0 ? 7 : d); // Convert Sunday from 0 to 7
			setVisibleDays(days);

			// Load lessons
			const savedLessons = await storage.getItem('lessons');
			if (savedLessons) {
				setLessons(JSON.parse(savedLessons));
			}

			// Load exams
			const loadedExams = await examService.getAllExams();
			setExams(loadedExams);

			// Load classes
			const loadedClasses = await classService.getAllClasses();
			setClasses(loadedClasses);

			// Load blockages
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

	const navigateMonth = (direction: number) => {
		const newDate = new Date(currentYear, currentMonth + direction, 1);
		setCurrentDate(newDate);
	};

	const goToToday = () => {
		setCurrentDate(new Date());
	};

	const getDaysInMonth = () => {
		const firstDay = new Date(currentYear, currentMonth, 1);
		const lastDay = new Date(currentYear, currentMonth + 1, 0);
		const daysInMonth = lastDay.getDate();
		const startingDay = firstDay.getDay() || 7; // Convert Sunday (0) to 7

		const days: (Date | null)[] = [];

		// Add empty slots for days before the first of the month
		for (let i = 1; i < startingDay; i++) {
			days.push(null);
		}

		// Add all days of the month
		for (let i = 1; i <= daysInMonth; i++) {
			days.push(new Date(currentYear, currentMonth, i));
		}

		return days;
	};

	const getLessonsForDate = (date: Date) => {
		const dayOfWeek = date.getDay(); // 0 = Sunday
		return lessons.filter(l => l.dayOfWeek === dayOfWeek);
	};

	const getExamsForDate = (date: Date) => {
		const dateStr = date.toISOString().split('T')[0];
		return exams.filter(e => e.date === dateStr);
	};

	const getBlockagesForDate = (date: Date) => {
		return blockages.filter(b => {
			const blockStart = new Date(b.startDate);
			const blockEnd = new Date(b.endDate);
			blockStart.setHours(0, 0, 0, 0);
			blockEnd.setHours(23, 59, 59, 999);
			return date >= blockStart && date <= blockEnd;
		});
	};

	const getClassName = (classId: string) => {
		return classes.find(c => c.id === classId)?.name || '';
	};

	const isToday = (date: Date) => {
		const today = new Date();
		return date.toDateString() === today.toDateString();
	};

	const isWeekend = (date: Date) => {
		const day = date.getDay();
		return day === 0 || day === 6;
	};

	const isVisibleDay = (date: Date) => {
		const day = date.getDay() || 7; // Convert Sunday (0) to 7
		return visibleDays.includes(day);
	};

	const days = getDaysInMonth();

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
				<div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
					<div className="flex items-center gap-4">
						<Link
							href="/"
							className="px-4 py-2 rounded-lg text-white"
							style={{ backgroundColor: 'var(--primary)' }}
						>
							Home
						</Link>
						<h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
							Monatsansicht
						</h1>
					</div>

					{/* Month Navigation */}
					<div className="flex items-center gap-4">
						<button
							onClick={() => navigateMonth(-1)}
							className="px-3 py-2 rounded-lg"
							style={{ backgroundColor: 'var(--gray-200)' }}
						>
							&#8592;
						</button>
						<div className="text-center min-w-[180px]">
							<div className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
								{MONTH_NAMES[currentMonth]} {currentYear}
							</div>
							<button
								onClick={goToToday}
								className="text-xs underline"
								style={{ color: 'var(--primary)' }}
							>
								Heute
							</button>
						</div>
						<button
							onClick={() => navigateMonth(1)}
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
				<h1>Monatsansicht - {MONTH_NAMES[currentMonth]} {currentYear}</h1>
				<p>Gedruckt am {new Date().toLocaleDateString('de-DE')}</p>
			</div>

			<main className="max-w-6xl mx-auto px-4 py-6">
				{/* Calendar Grid */}
				<div className="bg-white rounded-xl shadow-sm p-4">
					{/* Weekday Headers */}
					<div className="grid grid-cols-7 gap-1 mb-2">
						{WEEKDAY_NAMES.map((day, idx) => (
							<div
								key={day}
								className="text-center font-semibold py-2"
								style={{
									color: idx >= 5 ? 'var(--text-secondary)' : 'var(--text-primary)',
								}}
							>
								{day}
							</div>
						))}
					</div>

					{/* Calendar Days */}
					<div className="grid grid-cols-7 gap-1">
						{days.map((date, index) => {
							if (!date) {
								return <div key={`empty-${index}`} className="min-h-[100px]" />;
							}

							const dayExams = getExamsForDate(date);
							const dayBlockages = getBlockagesForDate(date);
							const dayLessons = getLessonsForDate(date);
							const weekNumber = getWeek(date, { weekStartsOn: 1 });
							const visible = isVisibleDay(date);

							return (
								<div
									key={date.toISOString()}
									onClick={() => setSelectedDate(date)}
									className={`min-h-[100px] p-1 rounded-lg cursor-pointer transition-all border ${
										isToday(date)
											? 'border-2 border-blue-500'
											: selectedDate?.toDateString() === date.toDateString()
											? 'border-2 border-blue-300'
											: 'border-transparent'
									} ${!visible ? 'opacity-50' : ''}`}
									style={{
										backgroundColor: isWeekend(date) ? 'var(--gray-100)' : 'var(--gray-50)',
									}}
								>
									<div className="flex justify-between items-start mb-1">
										<span
											className={`text-sm font-medium ${isToday(date) ? 'text-white bg-blue-500 rounded-full w-6 h-6 flex items-center justify-center' : ''}`}
											style={{ color: isToday(date) ? undefined : 'var(--text-primary)' }}
										>
											{date.getDate()}
										</span>
										{date.getDate() === 1 || index === 0 ? (
											<span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
												KW{weekNumber}
											</span>
										) : null}
									</div>

									{/* Events */}
									<div className="space-y-0.5">
										{dayBlockages.slice(0, 1).map(blockage => (
											<div
												key={blockage.id}
												className="text-xs px-1 py-0.5 rounded truncate"
												style={{ backgroundColor: 'var(--warning)', color: 'white' }}
												title={blockage.title}
											>
												{blockage.title}
											</div>
										))}
										{dayExams.slice(0, 2).map(exam => (
											<div
												key={exam.id}
												className="text-xs px-1 py-0.5 rounded truncate"
												style={{ backgroundColor: 'var(--danger)', color: 'white' }}
												title={`${exam.title} (${getClassName(exam.classId)})`}
											>
												{exam.title}
											</div>
										))}
										{dayLessons.length > 0 && dayExams.length < 2 && (
											<div
												className="text-xs px-1 py-0.5 rounded"
												style={{ backgroundColor: 'var(--primary)', color: 'white' }}
											>
												{dayLessons.length} Lektionen
											</div>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>

				{/* Legend */}
				<div className="mt-6 p-4 bg-white rounded-xl shadow-sm">
					<h3 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
						Legende
					</h3>
					<div className="flex flex-wrap gap-4">
						<div className="flex items-center gap-2">
							<div className="w-4 h-4 rounded" style={{ backgroundColor: 'var(--danger)' }} />
							<span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Prüfung</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-4 h-4 rounded" style={{ backgroundColor: 'var(--warning)' }} />
							<span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Blockierung</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-4 h-4 rounded" style={{ backgroundColor: 'var(--primary)' }} />
							<span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Lektionen</span>
						</div>
					</div>
				</div>

				{/* Selected Day Details */}
				{selectedDate && (
					<div className="mt-6 p-4 bg-white rounded-xl shadow-sm">
						<div className="flex justify-between items-center mb-4">
							<h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
								{selectedDate.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
							</h3>
							<button
								onClick={() => {
									const week = getWeek(selectedDate, { weekStartsOn: 1 });
									router.push(`/wochenansicht?week=${week}&year=${selectedDate.getFullYear()}`);
								}}
								className="text-sm px-3 py-1 rounded"
								style={{ backgroundColor: 'var(--gray-200)', color: 'var(--text-primary)' }}
							>
								Zur Wochenansicht
							</button>
						</div>

						<div className="space-y-4">
							{/* Exams */}
							{getExamsForDate(selectedDate).length > 0 && (
								<div>
									<h4 className="text-sm font-medium mb-2" style={{ color: 'var(--danger)' }}>Prüfungen</h4>
									{getExamsForDate(selectedDate).map(exam => (
										<div key={exam.id} className="p-2 rounded" style={{ backgroundColor: 'var(--gray-50)' }}>
											<span className="font-medium">{exam.title}</span>
											<span className="text-sm ml-2" style={{ color: 'var(--text-secondary)' }}>
												({getClassName(exam.classId)})
											</span>
										</div>
									))}
								</div>
							)}

							{/* Blockages */}
							{getBlockagesForDate(selectedDate).length > 0 && (
								<div>
									<h4 className="text-sm font-medium mb-2" style={{ color: 'var(--warning)' }}>Blockierungen</h4>
									{getBlockagesForDate(selectedDate).map(blockage => (
										<div key={blockage.id} className="p-2 rounded" style={{ backgroundColor: 'var(--gray-50)' }}>
											<span className="font-medium">{blockage.title}</span>
											{blockage.description && (
												<p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{blockage.description}</p>
											)}
										</div>
									))}
								</div>
							)}

							{/* Lessons */}
							{getLessonsForDate(selectedDate).length > 0 && (
								<div>
									<h4 className="text-sm font-medium mb-2" style={{ color: 'var(--primary)' }}>Lektionen</h4>
									<div className="grid grid-cols-2 gap-2">
										{getLessonsForDate(selectedDate).map(lesson => (
											<div key={lesson.id} className="p-2 rounded" style={{ backgroundColor: 'var(--gray-50)' }}>
												<span className="font-medium">{lesson.subject}</span>
												{lesson.class && (
													<span className="text-sm ml-2" style={{ color: 'var(--text-secondary)' }}>
														{lesson.class}
													</span>
												)}
												<div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
													{lesson.startTime} - {lesson.endTime}
												</div>
											</div>
										))}
									</div>
								</div>
							)}

							{getLessonsForDate(selectedDate).length === 0 &&
							 getExamsForDate(selectedDate).length === 0 &&
							 getBlockagesForDate(selectedDate).length === 0 && (
								<p className="text-center py-4" style={{ color: 'var(--text-secondary)' }}>
									Keine Einträge für diesen Tag
								</p>
							)}
						</div>
					</div>
				)}
			</main>
		</div>
	);
}
