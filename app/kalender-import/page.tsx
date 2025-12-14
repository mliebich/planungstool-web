'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { storage } from '@/lib/services/storage';
import { Blockage } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

interface ParsedEvent {
	uid: string;
	summary: string;
	description?: string;
	startDate: Date;
	endDate: Date;
	location?: string;
}

export default function KalenderImportPage() {
	const { isAuthenticated, isLoading } = useAuth();
	const router = useRouter();

	const [parsedEvents, setParsedEvents] = useState<ParsedEvent[]>([]);
	const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
	const [importStatus, setImportStatus] = useState<string>('');
	const [existingBlockages, setExistingBlockages] = useState<Blockage[]>([]);
	const [icsUrl, setIcsUrl] = useState<string>('');
	const [isLoadingUrl, setIsLoadingUrl] = useState<boolean>(false);

	useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			router.push('/login');
		}
	}, [isAuthenticated, isLoading, router]);

	useEffect(() => {
		if (isAuthenticated) {
			loadExistingBlockages();
		}
	}, [isAuthenticated]);

	const loadExistingBlockages = async () => {
		try {
			const savedBlockages = await storage.getItem('blockages');
			if (savedBlockages) {
				setExistingBlockages(JSON.parse(savedBlockages));
			}
		} catch (error) {
			console.error('Fehler beim Laden:', error);
		}
	};

	const parseICSDate = (dateStr: string): Date => {
		// Handle both formats: YYYYMMDD and YYYYMMDDTHHmmss
		if (dateStr.includes('T')) {
			const year = parseInt(dateStr.substring(0, 4));
			const month = parseInt(dateStr.substring(4, 6)) - 1;
			const day = parseInt(dateStr.substring(6, 8));
			const hour = parseInt(dateStr.substring(9, 11));
			const minute = parseInt(dateStr.substring(11, 13));
			return new Date(year, month, day, hour, minute);
		} else {
			const year = parseInt(dateStr.substring(0, 4));
			const month = parseInt(dateStr.substring(4, 6)) - 1;
			const day = parseInt(dateStr.substring(6, 8));
			return new Date(year, month, day);
		}
	};

	const parseICS = (content: string): ParsedEvent[] => {
		const events: ParsedEvent[] = [];
		const lines = content.split(/\r?\n/);

		let currentEvent: Partial<ParsedEvent> | null = null;
		let currentKey = '';
		let currentValue = '';

		for (let i = 0; i < lines.length; i++) {
			let line = lines[i];

			// Handle line continuations (lines starting with space or tab)
			while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
				i++;
				line += lines[i].substring(1);
			}

			if (line === 'BEGIN:VEVENT') {
				currentEvent = { uid: uuidv4() };
			} else if (line === 'END:VEVENT' && currentEvent) {
				if (currentEvent.summary && currentEvent.startDate && currentEvent.endDate) {
					events.push(currentEvent as ParsedEvent);
				}
				currentEvent = null;
			} else if (currentEvent) {
				const colonIndex = line.indexOf(':');
				if (colonIndex > 0) {
					const keyPart = line.substring(0, colonIndex);
					const key = keyPart.split(';')[0]; // Remove parameters like TZID
					const value = line.substring(colonIndex + 1);

					switch (key) {
						case 'UID':
							currentEvent.uid = value;
							break;
						case 'SUMMARY':
							currentEvent.summary = value;
							break;
						case 'DESCRIPTION':
							currentEvent.description = value.replace(/\\n/g, '\n').replace(/\\,/g, ',');
							break;
						case 'DTSTART':
							currentEvent.startDate = parseICSDate(value);
							break;
						case 'DTEND':
							currentEvent.endDate = parseICSDate(value);
							break;
						case 'LOCATION':
							currentEvent.location = value;
							break;
					}
				}
			}
		}

		return events;
	};

	const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		try {
			const content = await file.text();
			const events = parseICS(content);

			// Filter out past events
			const now = new Date();
			now.setHours(0, 0, 0, 0);
			const futureEvents = events.filter(e => e.endDate >= now);

			setParsedEvents(futureEvents);
			setSelectedEvents(new Set(futureEvents.map(e => e.uid)));
			setImportStatus(`${futureEvents.length} Termine gefunden (${events.length - futureEvents.length} vergangene ausgeblendet)`);
		} catch (error) {
			console.error('Fehler beim Parsen:', error);
			setImportStatus('Fehler beim Lesen der Datei');
		}

		// Reset file input
		event.target.value = '';
	};

	const handleUrlImport = async () => {
		if (!icsUrl.trim()) {
			setImportStatus('Bitte eine URL eingeben');
			return;
		}

		setIsLoadingUrl(true);
		setImportStatus('Lade Kalender von URL...');

		try {
			// Use a CORS proxy or direct fetch
			const response = await fetch(icsUrl);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const content = await response.text();

			if (!content.includes('BEGIN:VCALENDAR')) {
				throw new Error('Ungültiges ICS-Format');
			}

			const events = parseICS(content);

			// Filter out past events
			const now = new Date();
			now.setHours(0, 0, 0, 0);
			const futureEvents = events.filter(e => e.endDate >= now);

			setParsedEvents(futureEvents);
			setSelectedEvents(new Set(futureEvents.map(e => e.uid)));
			setImportStatus(`${futureEvents.length} Termine gefunden (${events.length - futureEvents.length} vergangene ausgeblendet)`);
		} catch (error) {
			console.error('URL-Import Fehler:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
			setImportStatus(`Fehler beim Laden: ${errorMessage}`);
		} finally {
			setIsLoadingUrl(false);
		}
	};

	const toggleEvent = (uid: string) => {
		setSelectedEvents(prev => {
			const newSet = new Set(prev);
			if (newSet.has(uid)) {
				newSet.delete(uid);
			} else {
				newSet.add(uid);
			}
			return newSet;
		});
	};

	const selectAll = () => {
		setSelectedEvents(new Set(parsedEvents.map(e => e.uid)));
	};

	const selectNone = () => {
		setSelectedEvents(new Set());
	};

	const handleImport = async () => {
		const eventsToImport = parsedEvents.filter(e => selectedEvents.has(e.uid));

		if (eventsToImport.length === 0) {
			alert('Keine Termine ausgewählt');
			return;
		}

		try {
			const newBlockages: Blockage[] = eventsToImport.map(event => ({
				id: uuidv4(),
				title: event.summary,
				description: event.description,
				type: 'full-day' as const,
				startDate: event.startDate,
				endDate: event.endDate,
			}));

			const allBlockages = [...existingBlockages, ...newBlockages];
			await storage.setItem('blockages', JSON.stringify(allBlockages));

			setImportStatus(`${eventsToImport.length} Termine erfolgreich importiert!`);
			setParsedEvents([]);
			setSelectedEvents(new Set());
			loadExistingBlockages();
		} catch (error) {
			console.error('Import-Fehler:', error);
			setImportStatus('Fehler beim Importieren');
		}
	};

	const formatEventDate = (start: Date, end: Date) => {
		const options: Intl.DateTimeFormatOptions = {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
		};

		const startStr = start.toLocaleDateString('de-DE', options);
		const endStr = end.toLocaleDateString('de-DE', options);

		if (startStr === endStr) {
			return startStr;
		}
		return `${startStr} - ${endStr}`;
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
							Kalender-Import
						</h1>
					</div>
				</div>
			</header>

			<main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
				{/* Upload Section */}
				<section className="bg-white rounded-xl shadow-sm p-6">
					<h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
						ICS-Kalender importieren
					</h2>
					<p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
						Importiere Kalendereinträge aus einer ICS-Datei oder URL (z.B. aus Outlook, Google Calendar, Apple Kalender).
						Die Termine werden als Blockierungen in der Monats- und Wochenansicht angezeigt.
					</p>

					{/* URL Import */}
					<div className="mb-6">
						<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
							Von URL laden
						</label>
						<div className="flex gap-2">
							<input
								type="url"
								value={icsUrl}
								onChange={e => setIcsUrl(e.target.value)}
								placeholder="https://example.com/calendar.ics"
								className="flex-1 px-4 py-2 rounded-lg border"
								style={{ borderColor: 'var(--border)' }}
							/>
							<button
								onClick={handleUrlImport}
								disabled={isLoadingUrl || !icsUrl.trim()}
								className="px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50"
								style={{ backgroundColor: 'var(--primary)' }}
							>
								{isLoadingUrl ? 'Lädt...' : 'Laden'}
							</button>
						</div>
						<p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
							Gib die direkte URL zu einer .ics Datei ein (z.B. von Google Calendar, Outlook, etc.)
						</p>
					</div>

					<div className="relative my-6">
						<div className="absolute inset-0 flex items-center">
							<div className="w-full border-t" style={{ borderColor: 'var(--border)' }}></div>
						</div>
						<div className="relative flex justify-center">
							<span className="px-3 bg-white text-sm" style={{ color: 'var(--text-secondary)' }}>oder</span>
						</div>
					</div>

					{/* File Upload */}
					<label
						className="block w-full px-6 py-8 border-2 border-dashed rounded-xl text-center cursor-pointer hover:bg-gray-50 transition-colors"
						style={{ borderColor: 'var(--border)' }}
					>
						<div className="text-4xl mb-2">📁</div>
						<div className="font-medium" style={{ color: 'var(--text-primary)' }}>
							ICS-Datei auswählen
						</div>
						<div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
							oder Datei hierher ziehen
						</div>
						<input
							type="file"
							accept=".ics"
							onChange={handleFileUpload}
							className="hidden"
						/>
					</label>

					{importStatus && (
						<div
							className="mt-4 p-3 rounded-lg text-center"
							style={{
								backgroundColor: importStatus.includes('Fehler') ? 'var(--danger)' : 'var(--secondary)',
								color: 'white',
							}}
						>
							{importStatus}
						</div>
					)}
				</section>

				{/* Parsed Events */}
				{parsedEvents.length > 0 && (
					<section className="bg-white rounded-xl shadow-sm p-6">
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
								Gefundene Termine ({parsedEvents.length})
							</h2>
							<div className="flex gap-2">
								<button
									onClick={selectAll}
									className="px-3 py-1 rounded text-sm"
									style={{ backgroundColor: 'var(--gray-200)' }}
								>
									Alle
								</button>
								<button
									onClick={selectNone}
									className="px-3 py-1 rounded text-sm"
									style={{ backgroundColor: 'var(--gray-200)' }}
								>
									Keine
								</button>
							</div>
						</div>

						<div className="space-y-2 max-h-[400px] overflow-y-auto">
							{parsedEvents.map(event => (
								<div
									key={event.uid}
									onClick={() => toggleEvent(event.uid)}
									className={`p-3 rounded-lg cursor-pointer transition-all border-2 ${
										selectedEvents.has(event.uid)
											? 'border-blue-500 bg-blue-50'
											: 'border-transparent'
									}`}
									style={{ backgroundColor: selectedEvents.has(event.uid) ? undefined : 'var(--gray-50)' }}
								>
									<div className="flex items-start gap-3">
										<input
											type="checkbox"
											checked={selectedEvents.has(event.uid)}
											onChange={() => toggleEvent(event.uid)}
											className="mt-1"
										/>
										<div className="flex-1">
											<div className="font-medium" style={{ color: 'var(--text-primary)' }}>
												{event.summary}
											</div>
											<div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
												{formatEventDate(event.startDate, event.endDate)}
											</div>
											{event.description && (
												<div className="text-xs mt-1 truncate" style={{ color: 'var(--text-secondary)' }}>
													{event.description.substring(0, 100)}
													{event.description.length > 100 ? '...' : ''}
												</div>
											)}
										</div>
									</div>
								</div>
							))}
						</div>

						<div className="mt-4 flex justify-end">
							<button
								onClick={handleImport}
								disabled={selectedEvents.size === 0}
								className="px-6 py-3 rounded-lg text-white font-medium disabled:opacity-50"
								style={{ backgroundColor: 'var(--primary)' }}
							>
								{selectedEvents.size} Termine importieren
							</button>
						</div>
					</section>
				)}

				{/* Existing Blockages */}
				<section className="bg-white rounded-xl shadow-sm p-6">
					<h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
						Bestehende Blockierungen ({existingBlockages.length})
					</h2>

					{existingBlockages.length === 0 ? (
						<p className="text-center py-4" style={{ color: 'var(--text-secondary)' }}>
							Noch keine Blockierungen vorhanden
						</p>
					) : (
						<div className="space-y-2 max-h-[300px] overflow-y-auto">
							{existingBlockages
								.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
								.map(blockage => (
									<div
										key={blockage.id}
										className="p-3 rounded-lg flex justify-between items-center"
										style={{ backgroundColor: 'var(--gray-50)' }}
									>
										<div>
											<div className="font-medium" style={{ color: 'var(--text-primary)' }}>
												{blockage.title}
											</div>
											<div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
												{formatEventDate(new Date(blockage.startDate), new Date(blockage.endDate))}
											</div>
										</div>
										<button
											onClick={async () => {
												if (confirm('Blockierung löschen?')) {
													const updated = existingBlockages.filter(b => b.id !== blockage.id);
													await storage.setItem('blockages', JSON.stringify(updated));
													setExistingBlockages(updated);
												}
											}}
											className="px-2 py-1 rounded text-xs text-white"
											style={{ backgroundColor: 'var(--danger)' }}
										>
											Löschen
										</button>
									</div>
								))}
						</div>
					)}
				</section>
			</main>
		</div>
	);
}
