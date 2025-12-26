'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { storage } from '@/lib/services/storage';
import { Blockage } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

type BlockageType = 'full-day' | 'multiple-days' | 'morning' | 'afternoon' | 'single-lesson';

export default function SperrzeitenPage() {
	const { isAuthenticated, isLoading } = useAuth();
	const router = useRouter();

	const [blockages, setBlockages] = useState<Blockage[]>([]);
	const [showModal, setShowModal] = useState(false);
	const [editingBlockage, setEditingBlockage] = useState<Blockage | null>(null);

	// Form state
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [blockageType, setBlockageType] = useState<BlockageType>('full-day');
	const [startDate, setStartDate] = useState('');
	const [endDate, setEndDate] = useState('');
	const [specificStartTime, setSpecificStartTime] = useState('08:00');
	const [specificEndTime, setSpecificEndTime] = useState('09:00');
	const [affectedClasses, setAffectedClasses] = useState('');

	useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			router.push('/login');
		}
	}, [isAuthenticated, isLoading, router]);

	useEffect(() => {
		if (isAuthenticated) {
			loadBlockages();
		}
	}, [isAuthenticated]);

	const loadBlockages = async () => {
		try {
			const saved = await storage.getItem('blockages');
			if (saved) {
				const parsed = JSON.parse(saved);
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

	const saveBlockages = async (updated: Blockage[]) => {
		await storage.setItem('blockages', JSON.stringify(updated));
		setBlockages(updated);
	};

	const resetForm = () => {
		setTitle('');
		setDescription('');
		setBlockageType('full-day');
		setStartDate('');
		setEndDate('');
		setSpecificStartTime('08:00');
		setSpecificEndTime('09:00');
		setAffectedClasses('');
		setEditingBlockage(null);
	};

	const openAddModal = () => {
		resetForm();
		// Set default date to today
		const today = new Date().toISOString().split('T')[0];
		setStartDate(today);
		setEndDate(today);
		setShowModal(true);
	};

	const openEditModal = (blockage: Blockage) => {
		setEditingBlockage(blockage);
		setTitle(blockage.title);
		setDescription(blockage.description || '');
		setBlockageType(blockage.type);
		setStartDate(new Date(blockage.startDate).toISOString().split('T')[0]);
		setEndDate(new Date(blockage.endDate).toISOString().split('T')[0]);
		if (blockage.specificTime) {
			setSpecificStartTime(blockage.specificTime.startTime);
			setSpecificEndTime(blockage.specificTime.endTime);
		}
		setAffectedClasses(blockage.affectedClasses?.join(', ') || '');
		setShowModal(true);
	};

	const handleSave = async () => {
		if (!title.trim() || !startDate || !endDate) {
			alert('Bitte Titel und Datum eingeben');
			return;
		}

		const start = new Date(startDate);
		const end = new Date(endDate);

		if (end < start) {
			alert('Enddatum muss nach Startdatum liegen');
			return;
		}

		const blockage: Blockage = {
			id: editingBlockage?.id || uuidv4(),
			title: title.trim(),
			description: description.trim() || undefined,
			type: blockageType,
			startDate: start,
			endDate: end,
			affectedClasses: affectedClasses.trim()
				? affectedClasses.split(',').map(c => c.trim()).filter(c => c)
				: undefined,
		};

		// Add specific time for single-lesson type
		if (blockageType === 'single-lesson') {
			blockage.specificTime = {
				dayOfWeek: start.getDay(),
				startTime: specificStartTime,
				endTime: specificEndTime,
			};
		}

		// Add time range for morning/afternoon
		if (blockageType === 'morning' || blockageType === 'afternoon') {
			blockage.timeRange = blockageType;
		}

		let updated: Blockage[];
		if (editingBlockage) {
			updated = blockages.map(b => b.id === editingBlockage.id ? blockage : b);
		} else {
			updated = [...blockages, blockage];
		}

		await saveBlockages(updated);
		setShowModal(false);
		resetForm();
	};

	const handleDelete = async (id: string) => {
		if (confirm('Sperrzeit wirklich löschen?')) {
			const updated = blockages.filter(b => b.id !== id);
			await saveBlockages(updated);
		}
	};

	const formatDate = (date: Date) => {
		return new Date(date).toLocaleDateString('de-CH', {
			weekday: 'short',
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
		});
	};

	const formatDateRange = (start: Date, end: Date) => {
		const startStr = formatDate(start);
		const endStr = formatDate(end);
		if (startStr === endStr) {
			return startStr;
		}
		return `${startStr} - ${endStr}`;
	};

	const getTypeLabel = (type: BlockageType) => {
		const labels: Record<BlockageType, string> = {
			'full-day': 'Ganzer Tag',
			'multiple-days': 'Mehrere Tage',
			'morning': 'Vormittag',
			'afternoon': 'Nachmittag',
			'single-lesson': 'Einzelne Lektion',
		};
		return labels[type];
	};

	const getTypeColor = (type: BlockageType) => {
		const colors: Record<BlockageType, string> = {
			'full-day': 'var(--danger)',
			'multiple-days': 'var(--danger)',
			'morning': 'var(--warning)',
			'afternoon': 'var(--warning)',
			'single-lesson': 'var(--primary)',
		};
		return colors[type];
	};

	// Sort blockages by start date (upcoming first)
	const sortedBlockages = [...blockages].sort((a, b) =>
		new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
	);

	const upcomingBlockages = sortedBlockages.filter(b => new Date(b.endDate) >= new Date());
	const pastBlockages = sortedBlockages.filter(b => new Date(b.endDate) < new Date());

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--gray-50)' }}>
				<div className="text-4xl animate-spin">⏳</div>
			</div>
		);
	}

	if (!isAuthenticated) {
		return null;
	}

	return (
		<div className="min-h-screen" style={{ backgroundColor: 'var(--gray-50)' }}>
			{/* Header */}
			<header className="bg-white shadow-sm sticky top-0 z-10">
				<div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
					<div className="flex items-center gap-4">
						<Link
							href="/"
							className="text-2xl"
							style={{ color: 'var(--text-secondary)' }}
						>
							←
						</Link>
						<h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
							Sperrzeiten
						</h1>
					</div>
					<button
						onClick={openAddModal}
						className="px-4 py-2 rounded-lg font-medium text-white"
						style={{ backgroundColor: 'var(--primary)' }}
					>
						+ Neu
					</button>
				</div>
			</header>

			{/* Content */}
			<main className="max-w-4xl mx-auto px-4 py-6">
				{/* Info */}
				<div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--primary-light)' }}>
					<p className="text-sm" style={{ color: 'var(--primary-dark)' }}>
						Sperrzeiten blockieren Lektionen für die Materialverteilung.
						Ferien, Weiterbildungen oder Klassenfahrten werden bei der Planung berücksichtigt.
					</p>
				</div>

				{blockages.length === 0 ? (
					<div className="text-center py-12">
						<div className="text-6xl mb-4">🚫</div>
						<p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
							Keine Sperrzeiten vorhanden
						</p>
						<button
							onClick={openAddModal}
							className="mt-4 px-6 py-3 rounded-xl font-medium text-white"
							style={{ backgroundColor: 'var(--primary)' }}
						>
							Erste Sperrzeit hinzufügen
						</button>
					</div>
				) : (
					<>
						{/* Upcoming */}
						{upcomingBlockages.length > 0 && (
							<section className="mb-8">
								<h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
									Aktuelle & Kommende ({upcomingBlockages.length})
								</h2>
								<div className="space-y-3">
									{upcomingBlockages.map(blockage => (
										<div
											key={blockage.id}
											className="bg-white rounded-xl p-4 shadow-sm"
										>
											<div className="flex justify-between items-start">
												<div className="flex-1">
													<div className="flex items-center gap-2 mb-1">
														<span
															className="px-2 py-0.5 rounded text-xs font-medium text-white"
															style={{ backgroundColor: getTypeColor(blockage.type) }}
														>
															{getTypeLabel(blockage.type)}
														</span>
														{blockage.affectedClasses && blockage.affectedClasses.length > 0 && (
															<span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
																{blockage.affectedClasses.join(', ')}
															</span>
														)}
													</div>
													<h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
														{blockage.title}
													</h3>
													<p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
														{formatDateRange(blockage.startDate, blockage.endDate)}
														{blockage.specificTime && (
															<span> • {blockage.specificTime.startTime} - {blockage.specificTime.endTime}</span>
														)}
													</p>
													{blockage.description && (
														<p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
															{blockage.description}
														</p>
													)}
												</div>
												<div className="flex gap-2">
													<button
														onClick={() => openEditModal(blockage)}
														className="p-2 rounded-lg"
														style={{ backgroundColor: 'var(--gray-100)' }}
													>
														✏️
													</button>
													<button
														onClick={() => handleDelete(blockage.id)}
														className="p-2 rounded-lg"
														style={{ backgroundColor: 'var(--gray-100)' }}
													>
														🗑️
													</button>
												</div>
											</div>
										</div>
									))}
								</div>
							</section>
						)}

						{/* Past */}
						{pastBlockages.length > 0 && (
							<section>
								<h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-tertiary)' }}>
									Vergangene ({pastBlockages.length})
								</h2>
								<div className="space-y-2">
									{pastBlockages.map(blockage => (
										<div
											key={blockage.id}
											className="rounded-xl p-3 flex justify-between items-center"
											style={{ backgroundColor: 'var(--gray-100)' }}
										>
											<div>
												<span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
													{blockage.title}
												</span>
												<span className="text-sm ml-2" style={{ color: 'var(--text-tertiary)' }}>
													{formatDateRange(blockage.startDate, blockage.endDate)}
												</span>
											</div>
											<button
												onClick={() => handleDelete(blockage.id)}
												className="p-2 rounded-lg hover:bg-white"
											>
												🗑️
											</button>
										</div>
									))}
								</div>
							</section>
						)}
					</>
				)}
			</main>

			{/* Modal */}
			{showModal && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
						<div className="p-6">
							<h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
								{editingBlockage ? 'Sperrzeit bearbeiten' : 'Neue Sperrzeit'}
							</h2>

							<div className="space-y-4">
								{/* Title */}
								<div>
									<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
										Titel *
									</label>
									<input
										type="text"
										value={title}
										onChange={(e) => setTitle(e.target.value)}
										placeholder="z.B. Herbstferien, Weiterbildung..."
										className="w-full px-4 py-3 rounded-xl border-2"
										style={{ borderColor: 'var(--border)' }}
									/>
								</div>

								{/* Type */}
								<div>
									<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
										Art der Sperrung
									</label>
									<select
										value={blockageType}
										onChange={(e) => setBlockageType(e.target.value as BlockageType)}
										className="w-full px-4 py-3 rounded-xl border-2"
										style={{ borderColor: 'var(--border)' }}
									>
										<option value="full-day">Ganzer Tag</option>
										<option value="multiple-days">Mehrere Tage</option>
										<option value="morning">Nur Vormittag (08:00-12:00)</option>
										<option value="afternoon">Nur Nachmittag (13:00-17:00)</option>
										<option value="single-lesson">Einzelne Lektion</option>
									</select>
								</div>

								{/* Dates */}
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
											{blockageType === 'multiple-days' ? 'Von *' : 'Datum *'}
										</label>
										<input
											type="date"
											value={startDate}
											onChange={(e) => {
												setStartDate(e.target.value);
												if (blockageType !== 'multiple-days') {
													setEndDate(e.target.value);
												}
											}}
											className="w-full px-4 py-3 rounded-xl border-2"
											style={{ borderColor: 'var(--border)' }}
										/>
									</div>
									{blockageType === 'multiple-days' && (
										<div>
											<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
												Bis *
											</label>
											<input
												type="date"
												value={endDate}
												onChange={(e) => setEndDate(e.target.value)}
												min={startDate}
												className="w-full px-4 py-3 rounded-xl border-2"
												style={{ borderColor: 'var(--border)' }}
											/>
										</div>
									)}
								</div>

								{/* Time for single lesson */}
								{blockageType === 'single-lesson' && (
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
												Von
											</label>
											<input
												type="time"
												value={specificStartTime}
												onChange={(e) => setSpecificStartTime(e.target.value)}
												className="w-full px-4 py-3 rounded-xl border-2"
												style={{ borderColor: 'var(--border)' }}
											/>
										</div>
										<div>
											<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
												Bis
											</label>
											<input
												type="time"
												value={specificEndTime}
												onChange={(e) => setSpecificEndTime(e.target.value)}
												className="w-full px-4 py-3 rounded-xl border-2"
												style={{ borderColor: 'var(--border)' }}
											/>
										</div>
									</div>
								)}

								{/* Affected Classes */}
								<div>
									<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
										Betroffene Klassen (optional)
									</label>
									<input
										type="text"
										value={affectedClasses}
										onChange={(e) => setAffectedClasses(e.target.value)}
										placeholder="z.B. 5a, 5b (leer = alle)"
										className="w-full px-4 py-3 rounded-xl border-2"
										style={{ borderColor: 'var(--border)' }}
									/>
									<p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
										Kommagetrennt eingeben, leer lassen für alle Klassen
									</p>
								</div>

								{/* Description */}
								<div>
									<label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
										Beschreibung (optional)
									</label>
									<textarea
										value={description}
										onChange={(e) => setDescription(e.target.value)}
										placeholder="Zusätzliche Informationen..."
										rows={2}
										className="w-full px-4 py-3 rounded-xl border-2 resize-none"
										style={{ borderColor: 'var(--border)' }}
									/>
								</div>
							</div>

							{/* Buttons */}
							<div className="flex gap-3 mt-6">
								<button
									onClick={() => {
										setShowModal(false);
										resetForm();
									}}
									className="flex-1 py-3 rounded-xl font-medium"
									style={{ backgroundColor: 'var(--gray-100)', color: 'var(--text-primary)' }}
								>
									Abbrechen
								</button>
								<button
									onClick={handleSave}
									className="flex-1 py-3 rounded-xl font-medium text-white"
									style={{ backgroundColor: 'var(--primary)' }}
								>
									{editingBlockage ? 'Speichern' : 'Hinzufügen'}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
