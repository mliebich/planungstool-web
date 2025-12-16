export interface Lesson {
	id: string;
	subject: string;
	dayOfWeek: number; // 0 = Sonntag, 1 = Montag, etc.
	startTime: string; // Format: "HH:MM"
	endTime: string;
	room?: string;
	class?: string;
	themeId?: string; // Verknüpfung zu einem Oberthema
	assignedMaterialId?: string; // Spezifisches Material für diese Lektion
	plannedWeek?: number; // Spezifische Woche, in der diese Lektion mit Material stattfinden soll
}

export interface Theme {
	id: string;
	name: string;
	description?: string;
	startWeek: number; // Kalenderwoche
	endWeek: number;
	year: number;
	classLevel: string; // Klasse, z.B. '2. Klasse'
	targetClass?: string; // Zielklasse für Materialverteilung, z.B. '2a'
	materials: Material[];
	totalLessons: number;
	assignedLessons: string[]; // IDs der zugewiesenen Lektionen
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

export interface MaterialUsage {
	id: string;
	materialId: string;
	lessonId: string;
	themeId: string;
	weekNumber: number;
	year: number;
	used: boolean;
	comment?: string;
	usedAt?: Date;
}

export interface WeekPlan {
	weekNumber: number;
	year: number;
	lessons: Lesson[];
	notes?: string;
}

export interface CalendarEvent {
	id: string;
	title: string;
	start: Date;
	end: Date;
	description?: string;
	location?: string;
	isImported?: boolean; // Markiert importierte ICS-Ereignisse
}

export interface Schedule {
	id: string;
	name: string;
	lessons: Lesson[];
	startDate: Date;
	endDate: Date;
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

export interface AppState {
	schedules: Schedule[];
	themes: Theme[];
	classes: Class[]; // Neue Klassen
	currentWeek: number;
	currentYear: number;
	importedEvents: CalendarEvent[];
	blockages: Blockage[]; // Sperrtermine
	materialUsages: MaterialUsage[]; // Materialverwendung
}
