export interface Lesson {
	id: string;
	subject: string;
	dayOfWeek: number; // 0 = Sonntag, 1 = Montag, etc.
	startTime: string; // Format: "HH:MM"
	endTime: string;
	room?: string;
	class?: string;
	themeId?: string; // Verknüpfung zu einem Oberthema
	assignmentId?: string; // Verknüpfung zu einer Thema-Zuweisung
	assignedMaterialId?: string; // Spezifisches Material für diese Lektion
	plannedWeek?: number; // Spezifische Woche, in der diese Lektion mit Material stattfinden soll
}

// Zuweisung eines Themas zu einer Klasse mit Zeitraum
export interface ThemeAssignment {
	id: string;
	targetClass: string; // Zielklasse, z.B. '5a'
	startWeek: number; // Start-Kalenderwoche
	endWeek: number; // End-Kalenderwoche
	year: number;
	assignedLessons: string[]; // IDs der zugewiesenen Lektionen
}

export interface Theme {
	id: string;
	name: string;
	description?: string;
	classLevel: string; // Klassenstufe, z.B. '5. Klasse'
	materials: Material[];
	totalLessons: number;
	assignments: ThemeAssignment[]; // Zuweisungen zu Klassen
	// Legacy fields for backward compatibility (will be migrated)
	startWeek?: number;
	endWeek?: number;
	year?: number;
	targetClass?: string;
	assignedLessons?: string[];
}

export interface Material {
	id: string;
	type: "link" | "pdf" | "document" | "video" | "exercise";
	title: string;
	urls?: string[];
	filePath?: string;
	description?: string;
	plannedLessons?: number; // Anzahl der Lektionen, für die das Material gedacht ist
}

export interface WeekPlan {
	weekNumber: number;
	year: number;
	lessons: Lesson[];
	notes?: string;
}

// Blockierung/Sperrung von Lektionen
export interface Blockage {
	id: string;
	title: string; // z.B. "Ferien", "Weiterbildung", "Klassenfahrt"
	description?: string;
	type:
		| "single-lesson"
		| "morning"
		| "afternoon"
		| "full-day"
		| "multiple-days";
	startDate: Date; // Startdatum der Blockierung
	endDate: Date; // Enddatum der Blockierung
	weekNumber?: number; // Kalenderwoche (wird automatisch berechnet)
	year?: number; // Jahr (wird automatisch berechnet)

	// Spezifische Blockierung für einzelne Lektionen
	specificTime?: {
		dayOfWeek: number; // 1-7 (Montag-Sonntag)
		startTime: string; // "HH:MM"
		endTime: string; // "HH:MM"
	};

	// Für Vormittag/Nachmittag Blockierungen
	timeRange?: "morning" | "afternoon"; // Vormittag: 08:00-12:00, Nachmittag: 13:00-17:00

	// Betroffene Klassen (optional, leer = alle Klassen)
	affectedClasses?: string[];

	// Betroffene Fächer (optional, leer = alle Fächer)
	affectedSubjects?: string[];
}

// Schüler:in-Interface
export interface Student {
	id: string;
	firstName: string;
	lastName: string;
	email?: string;
	birthDate?: string;
	gender?: "m" | "f" | "d"; // männlich, weiblich, divers
	notes?: string;
	createdAt: Date;
	updatedAt: Date;
}

// Klassen-Interface
export interface Class {
	id: string;
	name: string; // z.B. "5a", "Chemie Gruppe A"
	description?: string;
	grade: string; // z.B. "5. Klasse", "Oberstufe"
	schoolYear: string; // z.B. "2023/2024"
	students: Student[];
	teacher?: string; // Name des Klassenlehrers
	room?: string; // Klassenraum
	color?: string; // Farbe für UI
	createdAt: Date;
	updatedAt: Date;
}

// Prüfungs-Interface
export interface Exam {
	id: string;
	title: string; // z.B. "Chemie Test Kapitel 5"
	subject: string; // z.B. "Chemie", "Informatik"
	classId: string; // Referenz zur Klasse
	date: string; // Prüfungsdatum (YYYY-MM-DD)
	maxPoints: number; // Maximale Punktzahl
	bonusPoints?: number; // Optional: Bonuspunkte (werden zu erreichten Punkten addiert)
	weight: number; // Gewichtung (z.B. 1.0, 1.5, 2.0)
	description?: string; // Optional: Beschreibung/Themen
	createdAt: Date;
	updatedAt: Date;
}

// Prüfungsresultat-Interface
export interface ExamResult {
	id: string;
	examId: string; // Referenz zur Prüfung
	studentId: string; // Referenz zur/zum Schüler:in
	points: number; // Erreichte Punktzahl
	grade: number; // Berechnete Note (1-6)
	notes?: string; // Optional: Bemerkungen
	createdAt: Date;
	updatedAt: Date;
}

// Coaching-Enums
export type CoachingStatus = "planned" | "completed" | "cancelled";
export type CoachingThemeTag =
	| "learning_behavior"
	| "social_interaction"
	| "motivation"
	| "concentration"
	| "friendships"
	| "independence"
	| "conflict_resolution"
	| "other";

export type GoalStatus = "active" | "achieved";

// Coaching-Ziel
export interface CoachingGoal {
	id: string;
	sessionId: string; // Referenz zur Session
	description: string; // Zielbeschreibung
	status: GoalStatus;
	createdAt: Date;
	updatedAt: Date;
}

// Coaching-Session
export interface CoachingSession {
	id: string;
	studentId: string; // Referenz zur/zum Schüler:in
	classId: string; // Referenz zur Klasse
	date: string; // Datum & Uhrzeit (ISO string)
	parentsPresent: boolean; // Elternteil anwesend
	occasion: string; // Gesprächs-Anlass / Beobachtungen
	themeTags: string[]; // Themen-Tags (dynamisch aus Einstellungen)
	strengths: string; // Stärken der/des Schüler:in
	challenges: string; // Herausforderungen / Besprochene Punkte
	goals: CoachingGoal[]; // Vereinbarte Ziele
	nextSteps: string; // Nächste Schritte / Notizen für Lehrperson
	status: CoachingStatus;
	createdAt: Date;
	updatedAt: Date;
}

