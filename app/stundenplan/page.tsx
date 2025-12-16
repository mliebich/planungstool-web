"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { storage } from "@/lib/services/storage";
import { Lesson, Schedule } from "@/lib/types";
import { validateTimeFormat, timeToMinutes } from "@/lib/utils/dateUtils";
import { getClassColor, ClassColorConfig } from "@/lib/utils/colorUtils";
import { v4 as uuidv4 } from "uuid";
import Link from "next/link";

const DAYS_OF_WEEK = [
	"Montag",
	"Dienstag",
	"Mittwoch",
	"Donnerstag",
	"Freitag",
];
const TIME_SLOTS = [
	"08:00-08:45",
	"08:55-09:40",
	"10:00-10:45",
	"10:55-11:40",
	"11:45-12:30",
	"13:30-14:15",
	"14:25-15:10",
	"15:20-16:05",
];

export default function StundenplanPage() {
	const { isAuthenticated, isLoading } = useAuth();
	const router = useRouter();

	const [lessons, setLessons] = useState<Lesson[]>([]);
	const [showAddModal, setShowAddModal] = useState(false);
	const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
	const [customColors, setCustomColors] = useState<ClassColorConfig>({});
	const [formData, setFormData] = useState({
		subject: "",
		dayOfWeek: 1,
		startTime: "",
		endTime: "",
		room: "",
		class: "",
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
			const savedLessons = await storage.getItem("lessons");
			if (savedLessons) {
				setLessons(JSON.parse(savedLessons));
			}

			const savedColors = await storage.getItem("customClassColors");
			if (savedColors) {
				setCustomColors(JSON.parse(savedColors));
			}
		} catch (error) {
			console.error("Fehler beim Laden:", error);
		}
	};

	const saveLessons = async (updatedLessons: Lesson[]) => {
		try {
			await storage.setItem("lessons", JSON.stringify(updatedLessons));
			setLessons(updatedLessons);
		} catch (error) {
			console.error("Fehler beim Speichern:", error);
		}
	};

	const handleAddLesson = async () => {
		if (!formData.subject || !formData.startTime || !formData.endTime) {
			alert("Bitte Fach, Start- und Endzeit angeben");
			return;
		}

		if (
			!validateTimeFormat(formData.startTime) ||
			!validateTimeFormat(formData.endTime)
		) {
			alert("Ungültiges Zeitformat (HH:MM)");
			return;
		}

		const newLesson: Lesson = {
			id: uuidv4(),
			subject: formData.subject,
			dayOfWeek: formData.dayOfWeek,
			startTime: formData.startTime,
			endTime: formData.endTime,
			room: formData.room || undefined,
			class: formData.class || undefined,
		};

		await saveLessons([...lessons, newLesson]);
		setShowAddModal(false);
		resetForm();
	};

	const handleUpdateLesson = async () => {
		if (!editingLesson) return;

		const updatedLessons = lessons.map((l) =>
			l.id === editingLesson.id
				? {
						...l,
						subject: formData.subject,
						dayOfWeek: formData.dayOfWeek,
						startTime: formData.startTime,
						endTime: formData.endTime,
						room: formData.room || undefined,
						class: formData.class || undefined,
					}
				: l,
		);

		await saveLessons(updatedLessons);
		setEditingLesson(null);
		resetForm();
	};

	const handleDeleteLesson = async (id: string) => {
		if (confirm("Lektion wirklich löschen?")) {
			await saveLessons(lessons.filter((l) => l.id !== id));
		}
	};

	const resetForm = () => {
		setFormData({
			subject: "",
			dayOfWeek: 1,
			startTime: "",
			endTime: "",
			room: "",
			class: "",
		});
	};

	const openEditModal = (lesson: Lesson) => {
		setEditingLesson(lesson);
		setFormData({
			subject: lesson.subject,
			dayOfWeek: lesson.dayOfWeek,
			startTime: lesson.startTime,
			endTime: lesson.endTime,
			room: lesson.room || "",
			class: lesson.class || "",
		});
	};

	const getLessonForSlot = (dayIndex: number, timeSlot: string) => {
		const [slotStart] = timeSlot.split("-");
		return lessons.find(
			(l) => l.dayOfWeek === dayIndex + 1 && l.startTime === slotStart,
		);
	};

	const handleTimeSlotClick = (dayIndex: number, timeSlot: string) => {
		const [start, end] = timeSlot.split("-");
		setFormData({
			...formData,
			dayOfWeek: dayIndex + 1,
			startTime: start,
			endTime: end,
		});
		setShowAddModal(true);
	};

	if (isLoading || !isAuthenticated) {
		return (
			<div
				className="min-h-screen flex items-center justify-center"
				style={{ backgroundColor: "var(--gray-50)" }}
			>
				<div className="text-4xl animate-spin">⏳</div>
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
							🏠 Home
						</Link>
						<h1
							className="text-2xl font-bold"
							style={{ color: "var(--text-primary)" }}
						>
							📅 Stundenplan
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
							onClick={() => setShowAddModal(true)}
							className="px-4 py-2 rounded-lg text-white"
							style={{ backgroundColor: "var(--secondary)" }}
						>
							+ Neue Lektion
						</button>
					</div>
				</div>
			</header>

			{/* Print Header (hidden on screen) */}
			<div className="print-header hidden">
				<h1>Stundenplan</h1>
				<p>Gedruckt am {new Date().toLocaleDateString("de-DE")}</p>
			</div>

			{/* Schedule Grid */}
			<main className="max-w-7xl mx-auto px-4 py-6">
				<div className="bg-white rounded-xl shadow-sm overflow-x-auto">
					<table className="w-full border-collapse">
						<thead>
							<tr>
								<th
									className="p-3 border-b text-left"
									style={{ backgroundColor: "var(--gray-50)", width: "100px" }}
								>
									Zeit
								</th>
								{DAYS_OF_WEEK.map((day) => (
									<th
										key={day}
										className="p-3 border-b text-center font-semibold"
										style={{ backgroundColor: "var(--gray-50)" }}
									>
										{day}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{TIME_SLOTS.map((timeSlot) => (
								<tr key={timeSlot}>
									<td
										className="p-2 border-b text-sm font-medium"
										style={{ color: "var(--text-secondary)" }}
									>
										{timeSlot}
									</td>
									{DAYS_OF_WEEK.map((_, dayIndex) => {
										const lesson = getLessonForSlot(dayIndex, timeSlot);
										const bgColor = lesson?.class
											? getClassColor(lesson.class, customColors)
											: "var(--gray-100)";

										return (
											<td
												key={dayIndex}
												className="p-1 border-b border-r cursor-pointer hover:opacity-80 transition-opacity"
												onClick={() =>
													lesson
														? openEditModal(lesson)
														: handleTimeSlotClick(dayIndex, timeSlot)
												}
											>
												{lesson ? (
													<div
														className="p-2 rounded-lg text-white min-h-[60px]"
														style={{ backgroundColor: bgColor }}
													>
														<div className="font-semibold text-sm">
															{lesson.subject}
														</div>
														{lesson.class && (
															<div className="text-xs opacity-90">
																{lesson.class}
															</div>
														)}
														{lesson.room && (
															<div className="text-xs opacity-75">
																{lesson.room}
															</div>
														)}
													</div>
												) : (
													<div
														className="min-h-[60px] rounded-lg"
														style={{ backgroundColor: "var(--gray-50)" }}
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

				{/* Legend */}
				<div className="mt-6 p-4 bg-white rounded-xl shadow-sm">
					<h3
						className="font-semibold mb-3"
						style={{ color: "var(--text-primary)" }}
					>
						Legende
					</h3>
					<div className="flex flex-wrap gap-2">
						{[...new Set(lessons.map((l) => l.class).filter(Boolean))].map(
							(className) => (
								<div
									key={className}
									className="px-3 py-1 rounded-full text-white text-sm"
									style={{
										backgroundColor: getClassColor(className!, customColors),
									}}
								>
									{className}
								</div>
							),
						)}
					</div>
				</div>
			</main>

			{/* Add/Edit Modal */}
			{(showAddModal || editingLesson) && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-2xl p-6 w-full max-w-md">
						<h2
							className="text-xl font-bold mb-4"
							style={{ color: "var(--text-primary)" }}
						>
							{editingLesson ? "Lektion bearbeiten" : "Neue Lektion"}
						</h2>

						<div className="space-y-4">
							<div>
								<label
									className="block text-sm font-medium mb-1"
									style={{ color: "var(--text-secondary)" }}
								>
									Fach *
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

							<div>
								<label
									className="block text-sm font-medium mb-1"
									style={{ color: "var(--text-secondary)" }}
								>
									Tag
								</label>
								<select
									value={formData.dayOfWeek}
									onChange={(e) =>
										setFormData({
											...formData,
											dayOfWeek: parseInt(e.target.value),
										})
									}
									className="w-full px-4 py-3 rounded-lg border-2"
									style={{ borderColor: "var(--border)" }}
								>
									{DAYS_OF_WEEK.map((day, i) => (
										<option key={day} value={i + 1}>
											{day}
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
										Startzeit *
									</label>
									<input
										type="time"
										value={formData.startTime}
										onChange={(e) =>
											setFormData({ ...formData, startTime: e.target.value })
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
										Endzeit *
									</label>
									<input
										type="time"
										value={formData.endTime}
										onChange={(e) =>
											setFormData({ ...formData, endTime: e.target.value })
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
									Klasse
								</label>
								<input
									type="text"
									value={formData.class}
									onChange={(e) =>
										setFormData({ ...formData, class: e.target.value })
									}
									className="w-full px-4 py-3 rounded-lg border-2"
									style={{ borderColor: "var(--border)" }}
									placeholder="z.B. 5a"
								/>
							</div>

							<div>
								<label
									className="block text-sm font-medium mb-1"
									style={{ color: "var(--text-secondary)" }}
								>
									Raum
								</label>
								<input
									type="text"
									value={formData.room}
									onChange={(e) =>
										setFormData({ ...formData, room: e.target.value })
									}
									className="w-full px-4 py-3 rounded-lg border-2"
									style={{ borderColor: "var(--border)" }}
									placeholder="z.B. A101"
								/>
							</div>
						</div>

						<div className="flex gap-3 mt-6">
							<button
								onClick={() => {
									setShowAddModal(false);
									setEditingLesson(null);
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
							{editingLesson && (
								<button
									onClick={() => handleDeleteLesson(editingLesson.id)}
									className="py-3 px-4 rounded-lg font-semibold text-white"
									style={{ backgroundColor: "var(--danger)" }}
								>
									🗑️
								</button>
							)}
							<button
								onClick={editingLesson ? handleUpdateLesson : handleAddLesson}
								className="flex-1 py-3 rounded-lg font-semibold text-white"
								style={{ backgroundColor: "var(--primary)" }}
							>
								{editingLesson ? "Speichern" : "Hinzufügen"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
