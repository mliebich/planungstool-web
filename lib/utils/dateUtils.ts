import {
	getISOWeek,
	getYear,
	startOfISOWeek,
	setISOWeek,
	addDays,
	format,
} from "date-fns";
import { de } from "date-fns/locale";

/**
 * Gibt die aktuelle Kalenderwoche zurück
 */
export const getCurrentWeek = (): number => {
	return getISOWeek(new Date()); // ISO 8601 Kalenderwoche
};

/**
 * Gibt das aktuelle Jahr zurück
 */
export const getCurrentYear = (): number => {
	return getYear(new Date());
};

/**
 * Konvertiert eine Kalenderwoche und Jahr zu einem Datum (Montag der Woche)
 */
export const getDateFromWeek = (weekNumber: number, year: number): Date => {
	// Erstelle ein Datum für den 4. Januar des Jahres (immer in KW 1 nach ISO 8601)
	const jan4 = new Date(year, 0, 4);
	// Setze die ISO-Woche und gib den Montag zurück
	const dateInWeek = setISOWeek(jan4, weekNumber);
	return startOfISOWeek(dateInWeek);
};

/**
 * Gibt alle Tage einer Woche zurück (Montag bis Sonntag)
 */
export const getWeekDays = (weekNumber: number, year: number): Date[] => {
	const monday = getDateFromWeek(weekNumber, year);
	return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
};

/**
 * Formatiert ein Datum für die Anzeige
 */
export const formatDate = (date: Date): string => {
	return format(date, "dd.MM.yyyy", { locale: de });
};

/**
 * Formatiert ein Datum für die Wochenanzeige
 */
export const formatWeekDate = (date: Date): string => {
	return format(date, "EEE dd.MM", { locale: de });
};

/**
 * Prüft ob eine Zeit im Format HH:MM korrekt ist
 */
export const validateTimeFormat = (time: string): boolean => {
	const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
	return timeRegex.test(time);
};

/**
 * Konvertiert Zeit-String zu Minuten seit Mitternacht
 */
export const timeToMinutes = (time: string): number => {
	const [hours, minutes] = time.split(":").map(Number);
	return hours * 60 + minutes;
};

/**
 * Konvertiert Minuten seit Mitternacht zu Zeit-String
 */
export const minutesToTime = (minutes: number): string => {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
};
