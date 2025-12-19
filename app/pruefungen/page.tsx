"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import examService from "@/lib/services/examService";
import classService from "@/lib/services/classService";
import { Exam, ExamResult, Class, Student } from "@/lib/types";
import { calculateGrade } from "@/lib/utils/gradeCalculator";
import { formatDate } from "@/lib/utils/dateUtils";
import Link from "next/link";

export default function PruefungenPage() {
	const { isAuthenticated, isLoading } = useAuth();
	const router = useRouter();

	const [exams, setExams] = useState<Exam[]>([]);
	const [classes, setClasses] = useState<Class[]>([]);
	const [results, setResults] = useState<ExamResult[]>([]);
	const [showAddModal, setShowAddModal] = useState(false);
	const [editingExam, setEditingExam] = useState<Exam | null>(null);
	const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
	const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");
	const [studentSort, setStudentSort] = useState<"lastName" | "firstName">("lastName");
	const [printExam, setPrintExam] = useState<Exam | null>(null);
	const [maxPointsInput, setMaxPointsInput] = useState("100");
	const [bonusPointsInput, setBonusPointsInput] = useState("0");

	const [formData, setFormData] = useState({
		title: "",
		subject: "",
		classId: "",
		date: "",
		maxPoints: 100,
		bonusPoints: 0,
		weight: 1,
		description: "",
	});

	useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			router.push("/login");
		}
	}, [isAuthenticated, isLoading, router]);

	useEffect(() => {
		if (isAuthenticated) {
			loadData();
		}
	}, [isAuthenticated]);

	const loadData = async () => {
		try {
			const [loadedExams, loadedClasses, loadedResults] = await Promise.all([
				examService.getAllExams(),
				classService.getAllClasses(),
				examService.getAllResults(),
			]);
			setExams(
				loadedExams.sort(
					(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
				),
			);
			setClasses(loadedClasses);
			setResults(loadedResults);
		} catch (error) {
			console.error("Fehler beim Laden:", error);
		}
	};

	const handleAddExam = async () => {
		if (!formData.title || !formData.classId || !formData.date) {
			alert("Bitte Titel, Klasse und Datum angeben");
			return;
		}

		try {
			await examService.createExam({
				title: formData.title,
				subject: formData.subject || formData.title,
				classId: formData.classId,
				date: formData.date,
				maxPoints: formData.maxPoints,
				bonusPoints: formData.bonusPoints,
				weight: formData.weight,
				description: formData.description || undefined,
			});
			await loadData();
			setShowAddModal(false);
			resetForm();
		} catch (error) {
			console.error("Fehler beim Erstellen:", error);
		}
	};

	const handleUpdateExam = async () => {
		if (!editingExam) return;

		try {
			const updatedExam = await examService.updateExam(editingExam.id, {
				title: formData.title,
				subject: formData.subject || formData.title,
				classId: formData.classId,
				date: formData.date,
				maxPoints: formData.maxPoints,
				bonusPoints: formData.bonusPoints,
				weight: formData.weight,
				description: formData.description || undefined,
			});
			await loadData();
			// Update selectedExam mit den neuen Daten
			if (selectedExam?.id === editingExam.id && updatedExam) {
				setSelectedExam(updatedExam);
			}
			setEditingExam(null);
			resetForm();
		} catch (error) {
			console.error("Fehler beim Aktualisieren:", error);
		}
	};

	const handleDeleteExam = async (id: string) => {
		if (
			confirm(
				"Prüfung wirklich löschen? Alle Resultate werden ebenfalls gelöscht.",
			)
		) {
			await examService.deleteExam(id);
			await loadData();
			setSelectedExam(null);
		}
	};

	const resetForm = () => {
		setFormData({
			title: "",
			subject: "",
			classId: classes.length > 0 ? classes[0].id : "",
			date: new Date().toISOString().split("T")[0],
			maxPoints: 100,
			bonusPoints: 0,
			weight: 1,
			description: "",
		});
		setMaxPointsInput("100");
		setBonusPointsInput("0");
	};

	const openEditModal = (exam: Exam) => {
		setEditingExam(exam);
		setFormData({
			title: exam.title,
			subject: exam.subject || "",
			classId: exam.classId,
			date: exam.date,
			maxPoints: exam.maxPoints,
			bonusPoints: exam.bonusPoints || 0,
			weight: exam.weight || 1,
			description: exam.description || "",
		});
		setMaxPointsInput(String(exam.maxPoints));
		setBonusPointsInput(String(exam.bonusPoints || 0));
	};

	const handleSaveResult = async (studentId: string, points: number) => {
		if (!selectedExam) return;

		try {
			await examService.saveResult(selectedExam.id, studentId, points);
			await loadData();
		} catch (error) {
			console.error("Fehler beim Speichern:", error);
		}
	};

	const getClassName = (classId: string) => {
		return classes.find((c) => c.id === classId)?.name || "Unbekannt";
	};

	const getExamResults = (examId: string) => {
		return results.filter((r) => r.examId === examId);
	};

	const getStudentResult = (examId: string, studentId: string) => {
		return results.find(
			(r) => r.examId === examId && r.studentId === studentId,
		);
	};

	const getExamClass = (classId: string) => {
		return classes.find((c) => c.id === classId);
	};

	const filteredExams =
		selectedClassFilter === "all"
			? exams
			: exams.filter((e) => e.classId === selectedClassFilter);

	const getGradeColor = (grade: number) => {
		if (grade >= 5.5) return "#22c55e";
		if (grade >= 4.5) return "#84cc16";
		if (grade >= 4) return "#eab308";
		if (grade >= 3) return "#f97316";
		return "#ef4444";
	};

	// Print exam results
	useEffect(() => {
		if (printExam) {
			const timer = setTimeout(() => {
				window.print();
			}, 100);

			const handleAfterPrint = () => {
				setPrintExam(null);
			};
			window.addEventListener('afterprint', handleAfterPrint);

			return () => {
				clearTimeout(timer);
				window.removeEventListener('afterprint', handleAfterPrint);
			};
		}
	}, [printExam]);

	const getExamPrintData = (exam: Exam) => {
		const examClass = getExamClass(exam.classId);
		if (!examClass) return { students: [], average: 0 };

		const sortedStudents = [...examClass.students].sort((a, b) => {
			if (studentSort === "lastName") {
				return a.lastName.localeCompare(b.lastName, "de");
			}
			return a.firstName.localeCompare(b.firstName, "de");
		});

		const studentsWithGrades = sortedStudents.map(student => {
			const result = getStudentResult(exam.id, student.id);
			const gradeInfo = result
				? calculateGrade(
					Math.min(result.points + (exam.bonusPoints || 0), exam.maxPoints),
					exam.maxPoints
				)
				: null;
			return {
				...student,
				points: result?.points ?? null,
				grade: gradeInfo?.grade ?? null,
			};
		});

		const gradesOnly = studentsWithGrades.filter(s => s.grade !== null).map(s => s.grade!);
		const average = gradesOnly.length > 0
			? gradesOnly.reduce((a, b) => a + b, 0) / gradesOnly.length
			: 0;

		return { students: studentsWithGrades, average };
	};

	if (isLoading || !isAuthenticated) {
		return (
			<div
				className="min-h-screen flex items-center justify-center"
				style={{ backgroundColor: "var(--gray-50)" }}
			>
				<div className="text-4xl animate-spin">...</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen" style={{ backgroundColor: "var(--gray-50)" }}>
			{/* Header */}
			<header className="bg-white shadow-sm">
				<div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
					<div className="flex items-center gap-4">
						<Link
							href="/"
							className="px-4 py-2 rounded-lg text-white"
							style={{ backgroundColor: "var(--primary)" }}
						>
							Home
						</Link>
						<h1
							className="text-2xl font-bold"
							style={{ color: "var(--text-primary)" }}
						>
							Prüfungen
						</h1>
					</div>
					<div className="flex items-center gap-2">
						<button
							onClick={() => window.print()}
							className="px-4 py-2 rounded-lg"
							style={{
								backgroundColor: "var(--gray-200)",
								color: "var(--text-primary)",
							}}
						>
							🖨️ Drucken
						</button>
						<button
							onClick={() => {
								resetForm();
								setShowAddModal(true);
							}}
							className="px-4 py-2 rounded-lg text-white"
							style={{ backgroundColor: "var(--secondary)" }}
						>
							+ Neue Prüfung
						</button>
					</div>
				</div>
			</header>

			{/* Print Header (hidden on screen) */}
			<div className="print-header hidden">
				<h1>Prüfungen</h1>
				<p>Gedruckt am {new Date().toLocaleDateString("de-DE")}</p>
			</div>

			<main className="max-w-7xl mx-auto px-4 py-6">
				{/* Filter */}
				<div className="mb-6 flex gap-4 items-center">
					<label
						className="font-medium"
						style={{ color: "var(--text-secondary)" }}
					>
						Filter:
					</label>
					<select
						value={selectedClassFilter}
						onChange={(e) => setSelectedClassFilter(e.target.value)}
						className="px-4 py-2 rounded-lg border-2"
						style={{ borderColor: "var(--border)" }}
					>
						<option value="all">Alle Klassen</option>
						{classes.map((cls) => (
							<option key={cls.id} value={cls.id}>
								{cls.name}
							</option>
						))}
					</select>
				</div>

				{classes.length === 0 ? (
					<div className="bg-white rounded-xl p-8 text-center shadow-sm">
						<p
							className="text-lg mb-4"
							style={{ color: "var(--text-secondary)" }}
						>
							Erstelle zuerst eine Klasse, bevor du Prüfungen hinzufügen kannst.
						</p>
						<Link
							href="/klassen"
							className="px-6 py-3 rounded-lg text-white inline-block"
							style={{ backgroundColor: "var(--primary)" }}
						>
							Zur Klassenverwaltung
						</Link>
					</div>
				) : (
					<div className="grid md:grid-cols-2 gap-6">
						{/* Exam List */}
						<div className="bg-white rounded-xl shadow-sm p-4">
							<h2
								className="text-lg font-semibold mb-4"
								style={{ color: "var(--text-primary)" }}
							>
								Prüfungsliste ({filteredExams.length})
							</h2>

							{filteredExams.length === 0 ? (
								<p
									className="text-center py-8"
									style={{ color: "var(--text-secondary)" }}
								>
									Keine Prüfungen vorhanden
								</p>
							) : (
								<div className="space-y-2 max-h-[600px] overflow-y-auto">
									{filteredExams.map((exam) => {
										const examResults = getExamResults(exam.id);
										const examClass = getExamClass(exam.classId);
										const avgGrade =
											examResults.length > 0
												? examResults.reduce((sum, r) => sum + r.grade, 0) /
													examResults.length
												: null;

										return (
											<div
												key={exam.id}
												onClick={() => setSelectedExam(exam)}
												className={`p-4 rounded-lg cursor-pointer transition-all border-2 ${
													selectedExam?.id === exam.id
														? "border-blue-500 bg-blue-50"
														: "border-transparent hover:bg-gray-50"
												}`}
											>
												<div className="flex justify-between items-start">
													<div>
														<h3
															className="font-semibold"
															style={{ color: "var(--text-primary)" }}
														>
															{exam.title}
														</h3>
														<p
															className="text-sm"
															style={{ color: "var(--text-secondary)" }}
														>
															{getClassName(exam.classId)} •{" "}
															{formatDate(new Date(exam.date))}
														</p>
														<p
															className="text-xs mt-1"
															style={{ color: "var(--text-secondary)" }}
														>
															{exam.subject} • {exam.maxPoints} Pkt.
															{exam.bonusPoints
																? ` (+${exam.bonusPoints} Bonus)`
																: ""}
															{exam.weight !== 1
																? ` • Gewicht: ${exam.weight}x`
																: ""}
														</p>
													</div>
													<div className="text-right">
														{avgGrade !== null && (
															<span
																className="text-lg font-bold"
																style={{ color: getGradeColor(avgGrade) }}
															>
																Ø {avgGrade.toFixed(1)}
															</span>
														)}
														<p
															className="text-xs"
															style={{ color: "var(--text-secondary)" }}
														>
															{examResults.length}/
															{examClass?.students.length || 0} erfasst
														</p>
													</div>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>

						{/* Results Panel */}
						<div className="bg-white rounded-xl shadow-sm p-4">
							{selectedExam ? (
								<>
									<div className="flex justify-between items-start mb-4">
										<div>
											<h2
												className="text-lg font-semibold"
												style={{ color: "var(--text-primary)" }}
											>
												{selectedExam.title}
											</h2>
											<p
												className="text-sm"
												style={{ color: "var(--text-secondary)" }}
											>
												{getClassName(selectedExam.classId)} •{" "}
												{formatDate(new Date(selectedExam.date))}
											</p>
										</div>
										<div className="flex gap-2">
											<button
												onClick={() => setPrintExam(selectedExam)}
												className="px-3 py-1 rounded text-sm"
												style={{ backgroundColor: "var(--gray-200)" }}
												title="Resultate drucken"
											>
												🖨️
											</button>
											<button
												onClick={() => openEditModal(selectedExam)}
												className="px-3 py-1 rounded text-sm"
												style={{ backgroundColor: "var(--gray-200)" }}
											>
												Bearbeiten
											</button>
											<button
												onClick={() => handleDeleteExam(selectedExam.id)}
												className="px-3 py-1 rounded text-sm text-white"
												style={{ backgroundColor: "var(--danger)" }}
											>
												Löschen
											</button>
										</div>
									</div>

									{selectedExam.description && (
										<p
											className="mb-4 text-sm p-3 rounded-lg"
											style={{
												backgroundColor: "var(--gray-50)",
												color: "var(--text-secondary)",
											}}
										>
											{selectedExam.description}
										</p>
									)}

									{/* Sort Toggle */}
									<div className="flex items-center gap-2 mb-3">
										<span
											className="text-sm"
											style={{ color: "var(--text-secondary)" }}
										>
											Sortieren:
										</span>
										<button
											onClick={() => setStudentSort("lastName")}
											className={`px-3 py-1 rounded text-sm ${
												studentSort === "lastName"
													? "text-white"
													: ""
											}`}
											style={{
												backgroundColor:
													studentSort === "lastName"
														? "var(--primary)"
														: "var(--gray-200)",
											}}
										>
											Nachname
										</button>
										<button
											onClick={() => setStudentSort("firstName")}
											className={`px-3 py-1 rounded text-sm ${
												studentSort === "firstName"
													? "text-white"
													: ""
											}`}
											style={{
												backgroundColor:
													studentSort === "firstName"
														? "var(--primary)"
														: "var(--gray-200)",
											}}
										>
											Vorname
										</button>
									</div>

									{/* Student Results */}
									<div className="space-y-2 max-h-[500px] overflow-y-auto">
										{(() => {
											const examClass = getExamClass(selectedExam.classId);
											if (!examClass) return <p>Klasse nicht gefunden</p>;

											const sortedStudents = [...examClass.students].sort((a, b) => {
												if (studentSort === "lastName") {
													return a.lastName.localeCompare(b.lastName, "de");
												}
												return a.firstName.localeCompare(b.firstName, "de");
											});

											return sortedStudents.map((student) => {
												const result = getStudentResult(
													selectedExam.id,
													student.id,
												);
												const gradeInfo = result
													? calculateGrade(
															Math.min(
																result.points + (selectedExam.bonusPoints || 0),
																selectedExam.maxPoints,
															),
															selectedExam.maxPoints,
														)
													: null;

												return (
													<div
														key={student.id}
														className="flex items-center gap-4 p-3 rounded-lg"
														style={{ backgroundColor: "var(--gray-50)" }}
													>
														<div className="flex-1 flex gap-1 font-medium">
															<span className="w-32 truncate">{student.lastName},</span>
															<span className="truncate">{student.firstName}</span>
														</div>
														<div className="flex items-center gap-2">
															<input
																type="text"
																inputMode="decimal"
																defaultValue={result?.points ?? ""}
																key={`${student.id}-${result?.points ?? ""}`}
																onBlur={(e) => {
																	const val = e.target.value.replace(",", ".");
																	const points = parseFloat(val);
																	if (
																		!isNaN(points) &&
																		points >= 0 &&
																		points <= selectedExam.maxPoints
																	) {
																		handleSaveResult(student.id, points);
																	}
																}}
																className="w-20 px-2 py-1 rounded border text-center"
																style={{ borderColor: "var(--border)" }}
																placeholder="-"
															/>
															<span
																className="text-sm w-16"
																style={{ color: "var(--text-secondary)" }}
															>
																/ {selectedExam.maxPoints}
															</span>
															{gradeInfo && (
																<span
																	className="font-bold w-12 text-center"
																	style={{
																		color: getGradeColor(gradeInfo.grade),
																	}}
																>
																	{gradeInfo.grade.toFixed(1)}
																</span>
															)}
														</div>
													</div>
												);
											});
										})()}
									</div>
								</>
							) : (
								<div className="flex items-center justify-center h-64">
									<p style={{ color: "var(--text-secondary)" }}>
										Wähle eine Prüfung aus der Liste
									</p>
								</div>
							)}
						</div>
					</div>
				)}
			</main>

			{/* Add/Edit Modal */}
			{(showAddModal || editingExam) && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-2xl p-6 w-full max-w-md">
						<h2
							className="text-xl font-bold mb-4"
							style={{ color: "var(--text-primary)" }}
						>
							{editingExam ? "Prüfung bearbeiten" : "Neue Prüfung"}
						</h2>

						<div className="space-y-4">
							<div>
								<label
									className="block text-sm font-medium mb-1"
									style={{ color: "var(--text-secondary)" }}
								>
									Titel *
								</label>
								<input
									type="text"
									value={formData.title}
									onChange={(e) =>
										setFormData({ ...formData, title: e.target.value })
									}
									className="w-full px-4 py-3 rounded-lg border-2"
									style={{ borderColor: "var(--border)" }}
									placeholder="z.B. Teilchenmodell und Trennmethoden"
								/>
							</div>

							<div>
								<label
									className="block text-sm font-medium mb-1"
									style={{ color: "var(--text-secondary)" }}
								>
									Klasse *
								</label>
								<select
									value={formData.classId}
									onChange={(e) =>
										setFormData({ ...formData, classId: e.target.value })
									}
									className="w-full px-4 py-3 rounded-lg border-2"
									style={{ borderColor: "var(--border)" }}
								>
									<option value="">Klasse wählen...</option>
									{classes.map((cls) => (
										<option key={cls.id} value={cls.id}>
											{cls.name}
										</option>
									))}
								</select>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<label
										className="block text-sm font-medium mb-1"
										style={{ color: "var(--text-secondary)" }}
									>
										Datum *
									</label>
									<input
										type="date"
										value={formData.date}
										onChange={(e) =>
											setFormData({ ...formData, date: e.target.value })
										}
										className="w-full px-4 py-3 rounded-lg border-2"
										style={{ borderColor: "var(--border)" }}
									/>
								</div>
								<div>
									<label
										className="block text-sm font-medium mb-1"
										style={{ color: "var(--text-secondary)" }}
									>
										Fach
									</label>
									<input
										type="text"
										value={formData.subject}
										onChange={(e) =>
											setFormData({ ...formData, subject: e.target.value })
										}
										className="w-full px-4 py-3 rounded-lg border-2"
										style={{ borderColor: "var(--border)" }}
										placeholder="z.B. Chemie"
									/>
								</div>
							</div>

							<div className="grid grid-cols-3 gap-4">
								<div>
									<label
										className="block text-sm font-medium mb-1"
										style={{ color: "var(--text-secondary)" }}
									>
										Max. Punkte
									</label>
									<input
										type="text"
										inputMode="decimal"
										value={maxPointsInput}
										onChange={(e) => setMaxPointsInput(e.target.value)}
										onBlur={() => {
											const val = maxPointsInput.replace(",", ".");
											const num = parseFloat(val);
											if (!isNaN(num) && num > 0) {
												setFormData({ ...formData, maxPoints: num });
												setMaxPointsInput(String(num));
											} else {
												setMaxPointsInput(String(formData.maxPoints));
											}
										}}
										className="w-full px-4 py-3 rounded-lg border-2"
										style={{ borderColor: "var(--border)" }}
									/>
								</div>
								<div>
									<label
										className="block text-sm font-medium mb-1"
										style={{ color: "var(--text-secondary)" }}
									>
										Bonuspunkte
									</label>
									<input
										type="text"
										inputMode="decimal"
										value={bonusPointsInput}
										onChange={(e) => setBonusPointsInput(e.target.value)}
										onBlur={() => {
											const val = bonusPointsInput.replace(",", ".");
											const num = parseFloat(val);
											if (!isNaN(num) && num >= 0) {
												setFormData({ ...formData, bonusPoints: num });
												setBonusPointsInput(String(num));
											} else {
												setBonusPointsInput(String(formData.bonusPoints));
											}
										}}
										className="w-full px-4 py-3 rounded-lg border-2"
										style={{ borderColor: "var(--border)" }}
									/>
								</div>
								<div>
									<label
										className="block text-sm font-medium mb-1"
										style={{ color: "var(--text-secondary)" }}
									>
										Gewichtung
									</label>
									<input
										type="number"
										min="0.5"
										max="3"
										step="0.5"
										value={formData.weight}
										onChange={(e) =>
											setFormData({
												...formData,
												weight: parseFloat(e.target.value) || 1,
											})
										}
										className="w-full px-4 py-3 rounded-lg border-2"
										style={{ borderColor: "var(--border)" }}
									/>
								</div>
							</div>

							<div>
								<label
									className="block text-sm font-medium mb-1"
									style={{ color: "var(--text-secondary)" }}
								>
									Beschreibung
								</label>
								<textarea
									value={formData.description}
									onChange={(e) =>
										setFormData({ ...formData, description: e.target.value })
									}
									className="w-full px-4 py-3 rounded-lg border-2"
									style={{ borderColor: "var(--border)" }}
									rows={3}
									placeholder="Optionale Beschreibung..."
								/>
							</div>
						</div>

						<div className="flex gap-3 mt-6">
							<button
								onClick={() => {
									setShowAddModal(false);
									setEditingExam(null);
									resetForm();
								}}
								className="flex-1 py-3 rounded-lg font-semibold"
								style={{
									backgroundColor: "var(--gray-200)",
									color: "var(--text-primary)",
								}}
							>
								Abbrechen
							</button>
							<button
								onClick={editingExam ? handleUpdateExam : handleAddExam}
								className="flex-1 py-3 rounded-lg font-semibold text-white"
								style={{ backgroundColor: "var(--primary)" }}
							>
								{editingExam ? "Speichern" : "Erstellen"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Print-only Exam Results */}
			{printExam && (() => {
				const { students, average } = getExamPrintData(printExam);
				const examClass = getExamClass(printExam.classId);
				return (
					<div className="print-only print-exam-results">
						<div className="print-exam-header">
							<h1>{printExam.title}</h1>
							<p>
								{examClass?.name} • {formatDate(new Date(printExam.date))} • {printExam.maxPoints} Punkte
								{printExam.bonusPoints ? ` (+${printExam.bonusPoints} Bonus)` : ''}
							</p>
						</div>

						<table className="print-exam-table">
							<thead>
								<tr>
									<th style={{ width: '40px' }}>Nr.</th>
									<th style={{ width: '30%' }}>Nachname</th>
									<th style={{ width: '30%' }}>Vorname</th>
									<th style={{ width: '15%', textAlign: 'center' }}>Punkte</th>
									<th style={{ width: '15%', textAlign: 'center' }}>Note</th>
								</tr>
							</thead>
							<tbody>
								{students.map((student, index) => (
									<tr key={student.id}>
										<td style={{ textAlign: 'center' }}>{index + 1}</td>
										<td>{student.lastName}</td>
										<td>{student.firstName}</td>
										<td style={{ textAlign: 'center' }}>
											{student.points !== null ? student.points : '-'}
										</td>
										<td style={{ textAlign: 'center', fontWeight: 'bold' }}>
											{student.grade !== null ? student.grade.toFixed(1) : '-'}
										</td>
									</tr>
								))}
							</tbody>
							<tfoot>
								<tr>
									<td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold' }}>
										Notenschnitt:
									</td>
									<td style={{ textAlign: 'center', fontWeight: 'bold' }}>
										{average > 0 ? average.toFixed(2) : '-'}
									</td>
								</tr>
							</tfoot>
						</table>

						<div className="print-exam-footer">
							{new Date().toLocaleDateString('de-DE')}
						</div>
					</div>
				);
			})()}
		</div>
	);
}
