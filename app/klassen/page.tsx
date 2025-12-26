'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import classService from '@/lib/services/classService';
import photoService from '@/lib/services/photoService';
import { Class, Student } from '@/lib/types';
import { parseStudentsFromClipboard, getExampleTemplate } from '@/lib/utils/excelParser';
import Link from 'next/link';

export default function KlassenPage() {
	const { isAuthenticated, isLoading } = useAuth();
	const router = useRouter();

	const [classes, setClasses] = useState<Class[]>([]);
	const [selectedClass, setSelectedClass] = useState<Class | null>(null);
	const [showAddClassModal, setShowAddClassModal] = useState(false);
	const [showAddStudentModal, setShowAddStudentModal] = useState(false);
	const [showImportModal, setShowImportModal] = useState(false);
	const [importText, setImportText] = useState('');
	const [classForm, setClassForm] = useState({ name: '', grade: '', schoolYear: '', description: '' });
	const [studentForm, setStudentForm] = useState({ firstName: '', lastName: '', email: '', gender: '' as 'm' | 'f' | 'd' | '' });
	const [studentPhotos, setStudentPhotos] = useState<Record<string, string>>({});
	const [uploadingPhotoFor, setUploadingPhotoFor] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			router.push('/login');
		}
	}, [isAuthenticated, isLoading, router]);

	useEffect(() => {
		if (isAuthenticated) {
			loadClasses();
		}
	}, [isAuthenticated]);

	useEffect(() => {
		if (selectedClass) {
			loadPhotosForClass(selectedClass);
		}
	}, [selectedClass?.id]);

	const loadPhotosForClass = async (cls: Class) => {
		const photos: Record<string, string> = {};
		for (const student of cls.students) {
			if (student.photoId) {
				const photo = await photoService.getPhoto(student.photoId);
				if (photo) {
					photos[student.id] = photo;
				}
			}
		}
		setStudentPhotos(photos);
	};

	const loadClasses = async () => {
		try {
			const data = await classService.getAllClasses();
			setClasses(data);
			if (data.length > 0 && !selectedClass) {
				setSelectedClass(data[0]);
			}
		} catch (error) {
			console.error('Fehler beim Laden:', error);
		}
	};

	const handleAddClass = async () => {
		if (!classForm.name || !classForm.grade) {
			alert('Bitte Name und Stufe angeben');
			return;
		}

		try {
			const newClass = await classService.createClass({
				name: classForm.name,
				grade: classForm.grade,
				schoolYear: classForm.schoolYear || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
				description: classForm.description || undefined,
			});
			setClasses([...classes, newClass]);
			setSelectedClass(newClass);
			setShowAddClassModal(false);
			setClassForm({ name: '', grade: '', schoolYear: '', description: '' });
		} catch (error) {
			console.error('Fehler:', error);
			alert('Fehler beim Erstellen der Klasse');
		}
	};

	const handleDeleteClass = async (id: string) => {
		if (confirm('Klasse wirklich löschen? Alle Schüler:innen werden ebenfalls gelöscht.')) {
			try {
				await classService.deleteClass(id);
				const updated = classes.filter(c => c.id !== id);
				setClasses(updated);
				setSelectedClass(updated[0] || null);
			} catch (error) {
				console.error('Fehler:', error);
			}
		}
	};

	const handleAddStudent = async () => {
		if (!selectedClass || !studentForm.firstName || !studentForm.lastName) {
			alert('Bitte Vor- und Nachname angeben');
			return;
		}

		try {
			const updated = await classService.addStudentsToClass(selectedClass.id, [{
				firstName: studentForm.firstName,
				lastName: studentForm.lastName,
				email: studentForm.email || undefined,
				gender: studentForm.gender as 'm' | 'f' | 'd' || undefined,
			}]);
			setSelectedClass(updated);
			setClasses(classes.map(c => c.id === updated.id ? updated : c));
			setShowAddStudentModal(false);
			setStudentForm({ firstName: '', lastName: '', email: '', gender: '' });
		} catch (error) {
			console.error('Fehler:', error);
		}
	};

	const handleDeleteStudent = async (studentId: string) => {
		if (!selectedClass || !confirm('Schüler:in wirklich entfernen?')) return;

		try {
			// Delete photo if exists
			const student = selectedClass.students.find(s => s.id === studentId);
			if (student?.photoId) {
				await photoService.deletePhoto(student.photoId);
			}
			const updated = await classService.removeStudent(selectedClass.id, studentId);
			setSelectedClass(updated);
			setClasses(classes.map(c => c.id === updated.id ? updated : c));
			// Remove from local state
			setStudentPhotos(prev => {
				const newPhotos = { ...prev };
				delete newPhotos[studentId];
				return newPhotos;
			});
		} catch (error) {
			console.error('Fehler:', error);
		}
	};

	const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file || !uploadingPhotoFor || !selectedClass) return;

		try {
			const photoId = `photo-${uploadingPhotoFor}`;
			await photoService.savePhoto(photoId, file);

			// Update student with photoId
			const updated = await classService.updateStudent(selectedClass.id, uploadingPhotoFor, { photoId });
			setSelectedClass(updated);
			setClasses(classes.map(c => c.id === updated.id ? updated : c));

			// Load the photo into state
			const photo = await photoService.getPhoto(photoId);
			if (photo) {
				setStudentPhotos(prev => ({ ...prev, [uploadingPhotoFor]: photo }));
			}
		} catch (error) {
			console.error('Fehler beim Hochladen:', error);
			alert('Fehler beim Hochladen des Fotos');
		} finally {
			setUploadingPhotoFor(null);
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		}
	};

	const handleDeletePhoto = async (studentId: string) => {
		if (!selectedClass) return;

		const student = selectedClass.students.find(s => s.id === studentId);
		if (!student?.photoId) return;

		try {
			await photoService.deletePhoto(student.photoId);
			const updated = await classService.updateStudent(selectedClass.id, studentId, { photoId: undefined });
			setSelectedClass(updated);
			setClasses(classes.map(c => c.id === updated.id ? updated : c));
			setStudentPhotos(prev => {
				const newPhotos = { ...prev };
				delete newPhotos[studentId];
				return newPhotos;
			});
		} catch (error) {
			console.error('Fehler:', error);
		}
	};

	const triggerPhotoUpload = (studentId: string) => {
		setUploadingPhotoFor(studentId);
		fileInputRef.current?.click();
	};

	const handleImport = async () => {
		if (!selectedClass || !importText.trim()) {
			alert('Bitte Daten einfügen');
			return;
		}

		const result = parseStudentsFromClipboard(importText);

		if (!result.success) {
			alert(`Fehler: ${result.errors.join('\n')}`);
			return;
		}

		if (result.warnings.length > 0) {
			console.warn('Import Warnungen:', result.warnings);
		}

		try {
			const updated = await classService.addStudentsToClass(selectedClass.id, result.data);
			setSelectedClass(updated);
			setClasses(classes.map(c => c.id === updated.id ? updated : c));
			setShowImportModal(false);
			setImportText('');
			alert(`${result.data.length} Schüler:innen importiert!`);
		} catch (error) {
			console.error('Fehler:', error);
		}
	};

	if (isLoading || !isAuthenticated) {
		return (
			<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--gray-50)' }}>
				<div className="text-4xl animate-spin">⏳</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen" style={{ backgroundColor: 'var(--gray-50)' }}>
			{/* Header */}
			<header className="bg-white shadow-sm">
				<div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
					<div className="flex items-center gap-4">
						<Link href="/" className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--primary)' }}>
							🏠 Home
						</Link>
						<h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
							👥 Klassenverwaltung
						</h1>
					</div>
					<div className="flex items-center gap-2">
						<button
							onClick={() => window.print()}
							className="px-4 py-2 rounded-lg"
							style={{ backgroundColor: 'var(--gray-200)', color: 'var(--text-primary)' }}
						>
							🖨️ Drucken
						</button>
						<button
							onClick={() => setShowAddClassModal(true)}
							className="px-4 py-2 rounded-lg text-white"
							style={{ backgroundColor: 'var(--secondary)' }}
						>
							+ Neue Klasse
						</button>
					</div>
				</div>
			</header>

			{/* Print Header (hidden on screen) */}
			<div className="print-header hidden">
				<h1>Klassenverwaltung{selectedClass ? ` - ${selectedClass.name}` : ''}</h1>
				<p>Gedruckt am {new Date().toLocaleDateString('de-DE')}</p>
			</div>

			<main className="max-w-7xl mx-auto px-4 py-6">
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Classes List */}
					<div className="bg-white rounded-xl shadow-sm p-4">
						<h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Klassen</h2>
						{classes.length === 0 ? (
							<p className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
								Noch keine Klassen vorhanden
							</p>
						) : (
							<div className="space-y-2">
								{classes.map(cls => (
									<div
										key={cls.id}
										onClick={() => setSelectedClass(cls)}
										className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedClass?.id === cls.id ? 'ring-2' : ''}`}
										style={{
											backgroundColor: selectedClass?.id === cls.id ? 'var(--primary-light)' : 'var(--gray-50)',
											borderColor: 'var(--primary)',
										}}
									>
										<div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{cls.name}</div>
										<div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
											{cls.grade} • {cls.students.length} Schüler:innen
										</div>
									</div>
								))}
							</div>
						)}
					</div>

					{/* Class Details */}
					<div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-4">
						{selectedClass ? (
							<>
								<div className="flex justify-between items-start mb-4">
									<div>
										<h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
											{selectedClass.name}
										</h2>
										<p style={{ color: 'var(--text-secondary)' }}>
											{selectedClass.grade} • {selectedClass.schoolYear}
										</p>
									</div>
									<div className="flex gap-2">
										<button
											onClick={() => setShowImportModal(true)}
											className="px-3 py-2 rounded-lg text-sm"
											style={{ backgroundColor: 'var(--gray-100)', color: 'var(--text-primary)' }}
										>
											📋 Import
										</button>
										<button
											onClick={() => setShowAddStudentModal(true)}
											className="px-3 py-2 rounded-lg text-sm text-white"
											style={{ backgroundColor: 'var(--secondary)' }}
										>
											+ Schüler:in
										</button>
										<button
											onClick={() => handleDeleteClass(selectedClass.id)}
											className="px-3 py-2 rounded-lg text-sm text-white"
											style={{ backgroundColor: 'var(--danger)' }}
										>
											🗑️
										</button>
									</div>
								</div>

								{/* Hidden file input for photo upload */}
								<input
									type="file"
									ref={fileInputRef}
									onChange={handlePhotoUpload}
									accept="image/jpeg,image/png,image/gif,image/webp"
									className="hidden"
								/>

								{/* Students Table */}
								<div className="overflow-x-auto">
									<table className="w-full">
										<thead>
											<tr style={{ backgroundColor: 'var(--gray-50)' }}>
												<th className="text-left p-3 font-semibold w-16">Foto</th>
												<th className="text-left p-3 font-semibold">Name</th>
												<th className="text-left p-3 font-semibold">Email</th>
												<th className="text-left p-3 font-semibold">Geschlecht</th>
												<th className="text-right p-3"></th>
											</tr>
										</thead>
										<tbody>
											{selectedClass.students.length === 0 ? (
												<tr>
													<td colSpan={5} className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
														Noch keine Schüler:innen
													</td>
												</tr>
											) : (
												selectedClass.students.map(student => (
													<tr key={student.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
														<td className="p-3">
															<div className="relative w-10 h-10 group">
																{studentPhotos[student.id] ? (
																	<>
																		<img
																			src={studentPhotos[student.id]}
																			alt={`${student.firstName} ${student.lastName}`}
																			className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
																			onClick={() => triggerPhotoUpload(student.id)}
																			title="Foto ändern"
																		/>
																		<button
																			onClick={(e) => { e.stopPropagation(); handleDeletePhoto(student.id); }}
																			className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
																			title="Foto entfernen"
																		>
																			×
																		</button>
																	</>
																) : (
																	<button
																		onClick={() => triggerPhotoUpload(student.id)}
																		className="w-10 h-10 rounded-full flex items-center justify-center text-lg hover:opacity-80 transition-opacity"
																		style={{ backgroundColor: 'var(--gray-200)', color: 'var(--text-tertiary)' }}
																		title="Foto hinzufügen"
																	>
																		📷
																	</button>
																)}
															</div>
														</td>
														<td className="p-3">
															<span className="font-medium">{student.lastName}</span>, {student.firstName}
														</td>
														<td className="p-3" style={{ color: 'var(--text-secondary)' }}>
															{student.email || '-'}
														</td>
														<td className="p-3">
															{student.gender === 'm' ? '♂️' : student.gender === 'f' ? '♀️' : student.gender === 'd' ? '⚧️' : '-'}
														</td>
														<td className="p-3 text-right">
															<button
																onClick={() => handleDeleteStudent(student.id)}
																className="text-sm px-2 py-1 rounded"
																style={{ color: 'var(--danger)' }}
															>
																Entfernen
															</button>
														</td>
													</tr>
												))
											)}
										</tbody>
									</table>
								</div>
							</>
						) : (
							<p className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>
								Wähle eine Klasse aus oder erstelle eine neue
							</p>
						)}
					</div>
				</div>
			</main>

			{/* Add Class Modal */}
			{showAddClassModal && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-2xl p-6 w-full max-w-md">
						<h2 className="text-xl font-bold mb-4">Neue Klasse</h2>
						<div className="space-y-4">
							<input
								type="text"
								placeholder="Name (z.B. 5a)"
								value={classForm.name}
								onChange={e => setClassForm({ ...classForm, name: e.target.value })}
								className="w-full px-4 py-3 rounded-lg border-2"
								style={{ borderColor: 'var(--border)' }}
							/>
							<input
								type="text"
								placeholder="Stufe (z.B. 5. Klasse)"
								value={classForm.grade}
								onChange={e => setClassForm({ ...classForm, grade: e.target.value })}
								className="w-full px-4 py-3 rounded-lg border-2"
								style={{ borderColor: 'var(--border)' }}
							/>
							<input
								type="text"
								placeholder="Schuljahr (z.B. 2024/2025)"
								value={classForm.schoolYear}
								onChange={e => setClassForm({ ...classForm, schoolYear: e.target.value })}
								className="w-full px-4 py-3 rounded-lg border-2"
								style={{ borderColor: 'var(--border)' }}
							/>
						</div>
						<div className="flex gap-3 mt-6">
							<button
								onClick={() => setShowAddClassModal(false)}
								className="flex-1 py-3 rounded-lg font-semibold"
								style={{ backgroundColor: 'var(--gray-200)' }}
							>
								Abbrechen
							</button>
							<button
								onClick={handleAddClass}
								className="flex-1 py-3 rounded-lg font-semibold text-white"
								style={{ backgroundColor: 'var(--primary)' }}
							>
								Erstellen
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Add Student Modal */}
			{showAddStudentModal && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-2xl p-6 w-full max-w-md">
						<h2 className="text-xl font-bold mb-4">Schüler:in hinzufügen</h2>
						<div className="space-y-4">
							<input
								type="text"
								placeholder="Vorname"
								value={studentForm.firstName}
								onChange={e => setStudentForm({ ...studentForm, firstName: e.target.value })}
								className="w-full px-4 py-3 rounded-lg border-2"
								style={{ borderColor: 'var(--border)' }}
							/>
							<input
								type="text"
								placeholder="Nachname"
								value={studentForm.lastName}
								onChange={e => setStudentForm({ ...studentForm, lastName: e.target.value })}
								className="w-full px-4 py-3 rounded-lg border-2"
								style={{ borderColor: 'var(--border)' }}
							/>
							<input
								type="email"
								placeholder="Email (optional)"
								value={studentForm.email}
								onChange={e => setStudentForm({ ...studentForm, email: e.target.value })}
								className="w-full px-4 py-3 rounded-lg border-2"
								style={{ borderColor: 'var(--border)' }}
							/>
							<select
								value={studentForm.gender}
								onChange={e => setStudentForm({ ...studentForm, gender: e.target.value as 'm' | 'f' | 'd' | '' })}
								className="w-full px-4 py-3 rounded-lg border-2"
								style={{ borderColor: 'var(--border)' }}
							>
								<option value="">Geschlecht wählen</option>
								<option value="m">Männlich</option>
								<option value="f">Weiblich</option>
								<option value="d">Divers</option>
							</select>
						</div>
						<div className="flex gap-3 mt-6">
							<button
								onClick={() => setShowAddStudentModal(false)}
								className="flex-1 py-3 rounded-lg font-semibold"
								style={{ backgroundColor: 'var(--gray-200)' }}
							>
								Abbrechen
							</button>
							<button
								onClick={handleAddStudent}
								className="flex-1 py-3 rounded-lg font-semibold text-white"
								style={{ backgroundColor: 'var(--primary)' }}
							>
								Hinzufügen
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Import Modal */}
			{showImportModal && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-2xl p-6 w-full max-w-lg">
						<h2 className="text-xl font-bold mb-4">Schüler:innen importieren</h2>
						<p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
							Füge Tab-getrennte Daten aus Excel ein. Erste Zeile muss Überschriften enthalten.
						</p>
						<textarea
							value={importText}
							onChange={e => setImportText(e.target.value)}
							placeholder={getExampleTemplate()}
							className="w-full h-48 px-4 py-3 rounded-lg border-2 font-mono text-sm"
							style={{ borderColor: 'var(--border)' }}
						/>
						<div className="flex gap-3 mt-6">
							<button
								onClick={() => setShowImportModal(false)}
								className="flex-1 py-3 rounded-lg font-semibold"
								style={{ backgroundColor: 'var(--gray-200)' }}
							>
								Abbrechen
							</button>
							<button
								onClick={handleImport}
								className="flex-1 py-3 rounded-lg font-semibold text-white"
								style={{ backgroundColor: 'var(--primary)' }}
							>
								Importieren
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
