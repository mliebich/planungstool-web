"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { storage } from "@/lib/services/storage";
import classService from "@/lib/services/classService";
import {
	CoachingSession,
	CoachingThemeTag,
	CoachingStatus,
	Class,
	Student,
} from "@/lib/types";
import { formatDate } from "@/lib/utils/dateUtils";
import { v4 as uuidv4 } from "uuid";
import Link from "next/link";

const THEME_TAGS: { value: CoachingThemeTag; label: string }[] = [
	{ value: "learning_behavior", label: "Lernverhalten" },
	{ value: "social_interaction", label: "Sozialverhalten" },
	{ value: "motivation", label: "Motivation" },
	{ value: "concentration", label: "Konzentration" },
	{ value: "friendships", label: "Freundschaften" },
	{ value: "independence", label: "Selbstständigkeit" },
	{ value: "conflict_resolution", label: "Konfliktlösung" },
	{ value: "other", label: "Sonstiges" },
];

const STATUS_OPTIONS: { value: CoachingStatus; label: string }[] = [
	{ value: "planned", label: "Geplant" },
	{ value: "completed", label: "Abgeschlossen" },
	{ value: "cancelled", label: "Abgesagt" },
];

export default function CoachingPage() {
	const { isAuthenticated, isLoading } = useAuth();
	const router = useRouter();

	const [sessions, setSessions] = useState<CoachingSession[]>([]);
	const [classes, setClasses] = useState<Class[]>([]);
	const [showAddModal, setShowAddModal] = useState(false);
	const [editingSession, setEditingSession] = useState<CoachingSession | null>(
		null,
	);
	const [printSession, setPrintSession] = useState<CoachingSession | null>(null);
	const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");
	const [selectedTagFilter, setSelectedTagFilter] = useState<string>("all");

	const [formData, setFormData] = useState({
		studentId: "",
		classId: "",
		date: new Date().toISOString().split("T")[0],
		parentsPresent: false,
		occasion: "",
		themeTags: [] as CoachingThemeTag[],
		strengths: "",
		challenges: "",
		nextSteps: "",
		status: "completed" as CoachingStatus,
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
			const [loadedClasses, savedSessions] = await Promise.all([
				classService.getAllClasses(),
				storage.getItem("coachingSessions"),
			]);

			setClasses(loadedClasses);
			if (savedSessions) {
				const parsed = JSON.parse(savedSessions);
				setSessions(
					parsed.map((s: CoachingSession) => ({
						...s,
						createdAt: new Date(s.createdAt),
						updatedAt: new Date(s.updatedAt),
					})),
				);
			}
		} catch (error) {
			console.error("Fehler beim Laden:", error);
		}
	};

	const saveSessions = async (updatedSessions: CoachingSession[]) => {
		try {
			await storage.setItem(
				"coachingSessions",
				JSON.stringify(updatedSessions),
			);
			setSessions(updatedSessions);
		} catch (error) {
			console.error("Fehler beim Speichern:", error);
		}
	};

	const handleAddSession = async () => {
		if (!formData.studentId || !formData.occasion) {
			alert("Bitte Schüler:in und Anlass angeben");
			return;
		}

		// Find the classId from the student
		let classId = formData.classId;
		if (!classId) {
			for (const cls of classes) {
				if (cls.students.some((s) => s.id === formData.studentId)) {
					classId = cls.id;
					break;
				}
			}
		}

		const newSession: CoachingSession = {
			id: uuidv4(),
			studentId: formData.studentId,
			classId: classId,
			date: formData.date,
			parentsPresent: formData.parentsPresent,
			occasion: formData.occasion,
			themeTags: formData.themeTags,
			strengths: formData.strengths,
			challenges: formData.challenges,
			goals: [],
			nextSteps: formData.nextSteps,
			status: formData.status,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		await saveSessions([...sessions, newSession]);
		setShowAddModal(false);
		resetForm();
	};

	const handleUpdateSession = async () => {
		if (!editingSession) return;

		const updatedSessions = sessions.map((s) =>
			s.id === editingSession.id
				? {
						...s,
						studentId: formData.studentId,
						classId: formData.classId || s.classId,
						date: formData.date,
						parentsPresent: formData.parentsPresent,
						occasion: formData.occasion,
						themeTags: formData.themeTags,
						strengths: formData.strengths,
						challenges: formData.challenges,
						nextSteps: formData.nextSteps,
						status: formData.status,
						updatedAt: new Date(),
					}
				: s,
		);

		await saveSessions(updatedSessions);
		setEditingSession(null);
		resetForm();
	};

	const handleDeleteSession = async (id: string) => {
		if (confirm("Eintrag wirklich löschen?")) {
			await saveSessions(sessions.filter((s) => s.id !== id));
		}
	};

	const resetForm = () => {
		setFormData({
			studentId: "",
			classId: "",
			date: new Date().toISOString().split("T")[0],
			parentsPresent: false,
			occasion: "",
			themeTags: [],
			strengths: "",
			challenges: "",
			nextSteps: "",
			status: "completed",
		});
	};

	const openEditModal = (session: CoachingSession) => {
		setEditingSession(session);
		setFormData({
			studentId: session.studentId,
			classId: session.classId,
			date: session.date,
			parentsPresent: session.parentsPresent,
			occasion: session.occasion,
			themeTags: session.themeTags || [],
			strengths: session.strengths || "",
			challenges: session.challenges || "",
			nextSteps: session.nextSteps || "",
			status: session.status,
		});
	};

	const toggleTag = (tag: CoachingThemeTag) => {
		setFormData((prev) => ({
			...prev,
			themeTags: prev.themeTags.includes(tag)
				? prev.themeTags.filter((t) => t !== tag)
				: [...prev.themeTags, tag],
		}));
	};

	const getStudentById = (
		studentId: string,
	): { student: Student; className: string } | null => {
		for (const cls of classes) {
			const student = cls.students.find((s) => s.id === studentId);
			if (student) {
				return { student, className: cls.name };
			}
		}
		return null;
	};

	const filteredSessions = sessions
		.filter((s) => {
			if (selectedClassFilter !== "all") {
				if (s.classId !== selectedClassFilter) return false;
			}
			if (selectedTagFilter !== "all") {
				if (!s.themeTags?.includes(selectedTagFilter as CoachingThemeTag))
					return false;
			}
			return true;
		})
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

	const getStatusColor = (status: CoachingStatus) => {
		switch (status) {
			case "completed":
				return "var(--secondary)";
			case "planned":
				return "var(--primary)";
			case "cancelled":
				return "var(--danger)";
			default:
				return "var(--gray-400)";
		}
	};

	const handlePrintSession = (session: CoachingSession) => {
		setPrintSession(session);
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
				<div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
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
							Coaching
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
							+ Neuer Eintrag
						</button>
					</div>
				</div>
			</header>

			{/* Print Header (hidden on screen) */}
			<div className="print-header hidden">
				<h1>Coaching-Gespräche</h1>
				<p>Gedruckt am {new Date().toLocaleDateString("de-DE")}</p>
			</div>

			<main className="max-w-4xl mx-auto px-4 py-6">
				{classes.length === 0 ? (
					<div className="bg-white rounded-xl p-8 text-center shadow-sm">
						<p className="mb-4" style={{ color: "var(--text-secondary)" }}>
							Erstelle zuerst Klassen mit Schüler:innen, um Coaching-Einträge
							hinzuzufügen.
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
					<>
						{/* Filters */}
						<div className="mb-6 flex flex-wrap gap-4 items-center">
							<div>
								<label
									className="text-sm font-medium mr-2"
									style={{ color: "var(--text-secondary)" }}
								>
									Klasse:
								</label>
								<select
									value={selectedClassFilter}
									onChange={(e) => setSelectedClassFilter(e.target.value)}
									className="px-3 py-2 rounded-lg border-2"
									style={{ borderColor: "var(--border)" }}
								>
									<option value="all">Alle</option>
									{classes.map((cls) => (
										<option key={cls.id} value={cls.id}>
											{cls.name}
										</option>
									))}
								</select>
							</div>
							<div>
								<label
									className="text-sm font-medium mr-2"
									style={{ color: "var(--text-secondary)" }}
								>
									Thema:
								</label>
								<select
									value={selectedTagFilter}
									onChange={(e) => setSelectedTagFilter(e.target.value)}
									className="px-3 py-2 rounded-lg border-2"
									style={{ borderColor: "var(--border)" }}
								>
									<option value="all">Alle</option>
									{THEME_TAGS.map((tag) => (
										<option key={tag.value} value={tag.value}>
											{tag.label}
										</option>
									))}
								</select>
							</div>
						</div>

						{/* Sessions List */}
						<div className="bg-white rounded-xl shadow-sm p-4">
							<h2
								className="text-lg font-semibold mb-4"
								style={{ color: "var(--text-primary)" }}
							>
								Einträge ({filteredSessions.length})
							</h2>

							{filteredSessions.length === 0 ? (
								<p
									className="text-center py-8"
									style={{ color: "var(--text-secondary)" }}
								>
									Keine Einträge gefunden
								</p>
							) : (
								<div className="space-y-3">
									{filteredSessions.map((session) => {
										const studentInfo = getStudentById(session.studentId);

										return (
											<div
												key={session.id}
												className="p-4 rounded-lg"
												style={{ backgroundColor: "var(--gray-50)" }}
											>
												<div className="flex justify-between items-start mb-2">
													<div>
														<span
															className="font-semibold"
															style={{ color: "var(--text-primary)" }}
														>
															{studentInfo
																? `${studentInfo.student.firstName} ${studentInfo.student.lastName}`
																: "Unbekannt"}
														</span>
														{studentInfo && (
															<span
																className="text-sm ml-2"
																style={{ color: "var(--text-secondary)" }}
															>
																({studentInfo.className})
															</span>
														)}
													</div>
													<div className="flex items-center gap-2">
														<span
															className="text-xs px-2 py-0.5 rounded-full text-white"
															style={{
																backgroundColor: getStatusColor(session.status),
															}}
														>
															{
																STATUS_OPTIONS.find(
																	(s) => s.value === session.status,
																)?.label
															}
														</span>
														<span
															className="text-sm"
															style={{ color: "var(--text-secondary)" }}
														>
															{formatDate(new Date(session.date))}
														</span>
													</div>
												</div>

												<p
													className="text-sm mb-2"
													style={{ color: "var(--text-primary)" }}
												>
													<strong>Anlass:</strong> {session.occasion}
												</p>

												{session.strengths && (
													<p
														className="text-sm mb-1"
														style={{ color: "var(--secondary)" }}
													>
														<strong>Stärken:</strong> {session.strengths}
													</p>
												)}

												{session.challenges && (
													<p
														className="text-sm mb-1"
														style={{ color: "var(--warning)" }}
													>
														<strong>Herausforderungen:</strong>{" "}
														{session.challenges}
													</p>
												)}

												{session.themeTags && session.themeTags.length > 0 && (
													<div className="flex flex-wrap gap-1 mb-2">
														{session.themeTags.map((tag) => (
															<span
																key={tag}
																className="text-xs px-2 py-0.5 rounded-full"
																style={{
																	backgroundColor: "var(--gray-200)",
																	color: "var(--text-primary)",
																}}
															>
																{THEME_TAGS.find((t) => t.value === tag)
																	?.label || tag}
															</span>
														))}
													</div>
												)}

												{session.parentsPresent && (
													<p
														className="text-xs mb-2"
														style={{ color: "var(--text-secondary)" }}
													>
														Eltern anwesend
													</p>
												)}

												<div className="flex gap-2 mt-2 no-print">
													<button
														onClick={() => openEditModal(session)}
														className="text-xs px-2 py-1 rounded"
														style={{ backgroundColor: "var(--gray-200)" }}
													>
														Bearbeiten
													</button>
													<button
														onClick={() => handlePrintSession(session)}
														className="text-xs px-2 py-1 rounded"
														style={{ backgroundColor: "var(--gray-200)" }}
													>
														🖨️ Drucken
													</button>
													<button
														onClick={() => handleDeleteSession(session.id)}
														className="text-xs px-2 py-1 rounded text-white"
														style={{ backgroundColor: "var(--danger)" }}
													>
														Löschen
													</button>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					</>
				)}
			</main>

			{/* Single Session Print View */}
			{printSession && (() => {
				const studentInfo = getStudentById(printSession.studentId);
				return (
					<div
						className="print-single-session"
						style={{
							position: 'fixed',
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							background: 'white',
							zIndex: 9999,
							padding: '40px',
							overflow: 'auto',
						}}
					>
						<div className="max-w-2xl mx-auto">
							{/* Header */}
							<div className="text-center mb-8 pb-4 border-b-2 border-gray-800">
								<h1 className="text-2xl font-bold">Coaching-Gespräch</h1>
								<p className="text-gray-600 mt-1">
									Dokumentation vom {formatDate(new Date(printSession.date))}
								</p>
							</div>

							{/* Student Info */}
							<div className="mb-6 p-4 bg-gray-50 rounded-lg">
								<div className="grid grid-cols-2 gap-4">
									<div>
										<span className="text-sm text-gray-500">Schüler:in</span>
										<p className="font-semibold text-lg">
											{studentInfo
												? `${studentInfo.student.firstName} ${studentInfo.student.lastName}`
												: "Unbekannt"}
										</p>
									</div>
									<div>
										<span className="text-sm text-gray-500">Klasse</span>
										<p className="font-semibold text-lg">
											{studentInfo?.className || "-"}
										</p>
									</div>
									<div>
										<span className="text-sm text-gray-500">Status</span>
										<p className="font-semibold">
											{STATUS_OPTIONS.find((s) => s.value === printSession.status)?.label}
										</p>
									</div>
									<div>
										<span className="text-sm text-gray-500">Eltern anwesend</span>
										<p className="font-semibold">
											{printSession.parentsPresent ? "Ja" : "Nein"}
										</p>
									</div>
								</div>
							</div>

							{/* Themes */}
							{printSession.themeTags && printSession.themeTags.length > 0 && (
								<div className="mb-6">
									<h3 className="font-semibold text-gray-700 mb-2">Themen</h3>
									<div className="flex flex-wrap gap-2">
										{printSession.themeTags.map((tag) => (
											<span
												key={tag}
												className="px-3 py-1 bg-gray-200 rounded-full text-sm"
											>
												{THEME_TAGS.find((t) => t.value === tag)?.label || tag}
											</span>
										))}
									</div>
								</div>
							)}

							{/* Occasion */}
							<div className="mb-6">
								<h3 className="font-semibold text-gray-700 mb-2">Anlass / Beobachtungen</h3>
								<div className="p-4 border rounded-lg bg-white">
									<p className="whitespace-pre-wrap">{printSession.occasion || "-"}</p>
								</div>
							</div>

							{/* Strengths */}
							{printSession.strengths && (
								<div className="mb-6">
									<h3 className="font-semibold text-green-700 mb-2">Stärken</h3>
									<div className="p-4 border-l-4 border-green-500 bg-green-50 rounded-r-lg">
										<p className="whitespace-pre-wrap">{printSession.strengths}</p>
									</div>
								</div>
							)}

							{/* Challenges */}
							{printSession.challenges && (
								<div className="mb-6">
									<h3 className="font-semibold text-orange-700 mb-2">Herausforderungen</h3>
									<div className="p-4 border-l-4 border-orange-500 bg-orange-50 rounded-r-lg">
										<p className="whitespace-pre-wrap">{printSession.challenges}</p>
									</div>
								</div>
							)}

							{/* Goals / Next Steps */}
							{printSession.nextSteps && (
								<div className="mb-6">
									<h3 className="font-semibold text-blue-700 mb-2">Ziele / Nächste Schritte</h3>
									<div className="p-4 border-l-4 border-blue-500 bg-blue-50 rounded-r-lg">
										<p className="whitespace-pre-wrap">{printSession.nextSteps}</p>
									</div>
								</div>
							)}

							{/* Goals Array (if exists) */}
							{printSession.goals && printSession.goals.length > 0 && (
								<div className="mb-6">
									<h3 className="font-semibold text-purple-700 mb-2">Vereinbarte Ziele</h3>
									<div className="space-y-2">
										{printSession.goals.map((goal, index) => (
											<div key={goal.id || index} className="p-3 border rounded-lg flex items-start gap-3">
												<span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-medium">
													{index + 1}
												</span>
												<div className="flex-1">
													<p>{goal.description}</p>
													<span className="text-xs text-gray-500">
														Status: {goal.status === 'achieved' ? 'Erreicht' : 'Aktiv'}
													</span>
												</div>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Footer */}
							<div className="mt-12 pt-4 border-t text-center text-sm text-gray-500">
								<p>Erstellt: {formatDate(new Date(printSession.createdAt))}</p>
								<p>Gedruckt: {new Date().toLocaleDateString("de-DE")}</p>
							</div>

							{/* Close Button (hidden when printing) */}
							<div className="mt-8 text-center no-print">
								<button
									onClick={() => setPrintSession(null)}
									className="px-6 py-3 rounded-lg mr-4"
									style={{ backgroundColor: 'var(--gray-200)', color: 'var(--text-primary)' }}
								>
									Schliessen
								</button>
								<button
									onClick={() => window.print()}
									className="px-6 py-3 rounded-lg text-white"
									style={{ backgroundColor: 'var(--primary)' }}
								>
									🖨️ Drucken
								</button>
							</div>
						</div>
					</div>
				);
			})()}

			{/* Add/Edit Modal */}
			{(showAddModal || editingSession) && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
					<div className="bg-white rounded-2xl p-6 w-full max-w-lg my-8">
						<h2
							className="text-xl font-bold mb-4"
							style={{ color: "var(--text-primary)" }}
						>
							{editingSession ? "Eintrag bearbeiten" : "Neuer Coaching-Eintrag"}
						</h2>

						<div className="space-y-4 max-h-[60vh] overflow-y-auto">
							<div>
								<label
									className="block text-sm font-medium mb-1"
									style={{ color: "var(--text-secondary)" }}
								>
									Schüler:in *
								</label>
								<select
									value={formData.studentId}
									onChange={(e) => {
										const studentId = e.target.value;
										// Also update classId
										let classId = "";
										for (const cls of classes) {
											if (cls.students.some((s) => s.id === studentId)) {
												classId = cls.id;
												break;
											}
										}
										setFormData({ ...formData, studentId, classId });
									}}
									className="w-full px-4 py-3 rounded-lg border-2"
									style={{ borderColor: "var(--border)" }}
								>
									<option value="">Wählen...</option>
									{classes.map((cls) => (
										<optgroup key={cls.id} label={cls.name}>
											{cls.students.map((student) => (
												<option key={student.id} value={student.id}>
													{student.lastName}, {student.firstName}
												</option>
											))}
										</optgroup>
									))}
								</select>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<label
										className="block text-sm font-medium mb-1"
										style={{ color: "var(--text-secondary)" }}
									>
										Datum
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
										Status
									</label>
									<select
										value={formData.status}
										onChange={(e) =>
											setFormData({
												...formData,
												status: e.target.value as CoachingStatus,
											})
										}
										className="w-full px-4 py-3 rounded-lg border-2"
										style={{ borderColor: "var(--border)" }}
									>
										{STATUS_OPTIONS.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{opt.label}
											</option>
										))}
									</select>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<input
									type="checkbox"
									id="parentsPresent"
									checked={formData.parentsPresent}
									onChange={(e) =>
										setFormData({
											...formData,
											parentsPresent: e.target.checked,
										})
									}
									className="w-4 h-4"
								/>
								<label
									htmlFor="parentsPresent"
									className="text-sm"
									style={{ color: "var(--text-primary)" }}
								>
									Eltern anwesend
								</label>
							</div>

							<div>
								<label
									className="block text-sm font-medium mb-1"
									style={{ color: "var(--text-secondary)" }}
								>
									Themen
								</label>
								<div className="flex flex-wrap gap-2">
									{THEME_TAGS.map((tag) => (
										<button
											key={tag.value}
											type="button"
											onClick={() => toggleTag(tag.value)}
											className={`px-3 py-1 rounded-full text-sm transition-colors ${
												formData.themeTags.includes(tag.value)
													? "text-white"
													: ""
											}`}
											style={{
												backgroundColor: formData.themeTags.includes(tag.value)
													? "var(--primary)"
													: "var(--gray-200)",
												color: formData.themeTags.includes(tag.value)
													? "white"
													: "var(--text-primary)",
											}}
										>
											{tag.label}
										</button>
									))}
								</div>
							</div>

							<div>
								<label
									className="block text-sm font-medium mb-1"
									style={{ color: "var(--text-secondary)" }}
								>
									Anlass / Beobachtungen *
								</label>
								<textarea
									value={formData.occasion}
									onChange={(e) =>
										setFormData({ ...formData, occasion: e.target.value })
									}
									className="w-full px-4 py-3 rounded-lg border-2"
									style={{ borderColor: "var(--border)" }}
									rows={3}
									placeholder="Was war der Anlass für das Gespräch?"
								/>
							</div>

							<div>
								<label
									className="block text-sm font-medium mb-1"
									style={{ color: "var(--text-secondary)" }}
								>
									Stärken
								</label>
								<textarea
									value={formData.strengths}
									onChange={(e) =>
										setFormData({ ...formData, strengths: e.target.value })
									}
									className="w-full px-4 py-3 rounded-lg border-2"
									style={{ borderColor: "var(--border)" }}
									rows={2}
									placeholder="Welche Stärken wurden beobachtet?"
								/>
							</div>

							<div>
								<label
									className="block text-sm font-medium mb-1"
									style={{ color: "var(--text-secondary)" }}
								>
									Herausforderungen
								</label>
								<textarea
									value={formData.challenges}
									onChange={(e) =>
										setFormData({ ...formData, challenges: e.target.value })
									}
									className="w-full px-4 py-3 rounded-lg border-2"
									style={{ borderColor: "var(--border)" }}
									rows={2}
									placeholder="Welche Herausforderungen gibt es?"
								/>
							</div>

							<div>
								<label
									className="block text-sm font-medium mb-1"
									style={{ color: "var(--text-secondary)" }}
								>
									Ziele, nächste Schritte
								</label>
								<textarea
									value={formData.nextSteps}
									onChange={(e) =>
										setFormData({ ...formData, nextSteps: e.target.value })
									}
									className="w-full px-4 py-3 rounded-lg border-2"
									style={{ borderColor: "var(--border)" }}
									rows={2}
									placeholder="Was sind die nächsten Schritte?"
								/>
							</div>
						</div>

						<div className="flex gap-3 mt-6">
							<button
								onClick={() => {
									setShowAddModal(false);
									setEditingSession(null);
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
								onClick={
									editingSession ? handleUpdateSession : handleAddSession
								}
								className="flex-1 py-3 rounded-lg font-semibold text-white"
								style={{ backgroundColor: "var(--primary)" }}
							>
								{editingSession ? "Speichern" : "Erstellen"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
