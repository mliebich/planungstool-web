/**
 * Notenberechnungs-Utility
 *
 * Lineare Notenskala: 60% der Maximalpunktzahl = Note 4
 *
 * Berechnung:
 * - 100% = Note 6
 * - 60% = Note 4
 * - 0% = Note 1
 *
 * Formel: Note = 1 + (Prozent / 100) * 5
 * Mit Anpassung für 60% = 4:
 * - Für Prozent >= 60%: Note = 4 + ((Prozent - 60) / 40) * 2
 * - Für Prozent < 60%: Note = 1 + (Prozent / 60) * 3
 */

export interface GradeCalculation {
	points: number;
	maxPoints: number;
	percentage: number;
	grade: number;
	passed: boolean; // >= 4
}

/**
 * Berechnet die Note basierend auf erreichten Punkten
 * @param points Erreichte Punktzahl
 * @param maxPoints Maximale Punktzahl
 * @returns Objekt mit Punkten, Prozent, Note und Bestanden-Status
 */
export function calculateGrade(
	points: number,
	maxPoints: number,
): GradeCalculation {
	if (maxPoints <= 0) {
		throw new Error("Maximale Punktzahl muss größer als 0 sein");
	}

	if (points < 0) {
		throw new Error("Erreichte Punktzahl kann nicht negativ sein");
	}

	// Begrenze auf maxPoints
	const actualPoints = Math.min(points, maxPoints);

	// Berechne Prozentsatz
	const percentage = (actualPoints / maxPoints) * 100;

	// Berechne Note basierend auf linearer Skala mit 60% = 4
	let grade: number;

	if (percentage >= 60) {
		// Oberhalb 60%: lineare Skala von 4 (bei 60%) bis 6 (bei 100%)
		// Steigung: 2 Noten / 40 Prozentpunkte = 0.05
		grade = 4 + ((percentage - 60) / 40) * 2;
	} else {
		// Unterhalb 60%: lineare Skala von 1 (bei 0%) bis 4 (bei 60%)
		// Steigung: 3 Noten / 60 Prozentpunkte = 0.05
		grade = 1 + (percentage / 60) * 3;
	}

	// Runde auf eine Nachkommastelle
	grade = Math.round(grade * 10) / 10;

	// Begrenze auf 1-6
	grade = Math.max(1, Math.min(6, grade));

	const passed = grade >= 4;

	return {
		points: actualPoints,
		maxPoints,
		percentage: Math.round(percentage * 10) / 10,
		grade,
		passed,
	};
}

/**
 * Berechnet die benötigten Punkte für eine bestimmte Note
 * @param targetGrade Ziel-Note (1-6)
 * @param maxPoints Maximale Punktzahl
 * @returns Benötigte Punktzahl
 */
export function getRequiredPoints(
	targetGrade: number,
	maxPoints: number,
): number {
	if (targetGrade < 1 || targetGrade > 6) {
		throw new Error("Note muss zwischen 1 und 6 liegen");
	}

	let requiredPercentage: number;

	if (targetGrade >= 4) {
		// Oberhalb Note 4
		requiredPercentage = 60 + ((targetGrade - 4) / 2) * 40;
	} else {
		// Unterhalb Note 4
		requiredPercentage = ((targetGrade - 1) / 3) * 60;
	}

	const requiredPoints = (requiredPercentage / 100) * maxPoints;
	return Math.ceil(requiredPoints);
}

/**
 * Berechnet Statistiken für eine Menge von Resultaten
 * @param results Array von GradeCalculation Objekten
 */
export function calculateStatistics(results: GradeCalculation[]) {
	if (results.length === 0) {
		return {
			count: 0,
			averageGrade: 0,
			averagePercentage: 0,
			bestGrade: 0,
			worstGrade: 0,
			passedCount: 0,
			failedCount: 0,
			passRate: 0,
		};
	}

	const grades = results.map((r) => r.grade);
	const percentages = results.map((r) => r.percentage);

	const averageGrade = grades.reduce((a, b) => a + b, 0) / grades.length;
	const averagePercentage =
		percentages.reduce((a, b) => a + b, 0) / percentages.length;

	const bestGrade = Math.max(...grades);
	const worstGrade = Math.min(...grades);

	const passedCount = results.filter((r) => r.passed).length;
	const failedCount = results.length - passedCount;
	const passRate = (passedCount / results.length) * 100;

	return {
		count: results.length,
		averageGrade: Math.round(averageGrade * 10) / 10,
		averagePercentage: Math.round(averagePercentage * 10) / 10,
		bestGrade,
		worstGrade,
		passedCount,
		failedCount,
		passRate: Math.round(passRate * 10) / 10,
	};
}
