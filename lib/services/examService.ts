import { storage } from "./storage";
import { v4 as uuidv4 } from "uuid";
import { Exam, ExamResult } from "../types";
import { calculateGrade } from "../utils/gradeCalculator";

const EXAMS_KEY = "exams";
const EXAM_RESULTS_KEY = "examResults";

class ExamService {
	// === PRÜFUNGEN ===

	async getAllExams(): Promise<Exam[]> {
		try {
			const examsJson = await storage.getItem(EXAMS_KEY);
			if (!examsJson) return [];

			const exams = JSON.parse(examsJson);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return exams.map((exam: any) => ({
				...exam,
				createdAt: new Date(exam.createdAt),
				updatedAt: new Date(exam.updatedAt),
			}));
		} catch (error) {
			console.error("Fehler beim Laden der Prüfungen:", error);
			return [];
		}
	}

	async getExamById(id: string): Promise<Exam | null> {
		const exams = await this.getAllExams();
		return exams.find((exam) => exam.id === id) || null;
	}

	async getExamsByClass(classId: string): Promise<Exam[]> {
		const exams = await this.getAllExams();
		return exams.filter((exam) => exam.classId === classId);
	}

	async createExam(
		examData: Omit<Exam, "id" | "createdAt" | "updatedAt">,
	): Promise<Exam> {
		try {
			const newExam: Exam = {
				...examData,
				id: uuidv4(),
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const exams = await this.getAllExams();
			exams.push(newExam);
			await storage.setItem(EXAMS_KEY, JSON.stringify(exams));

			return newExam;
		} catch (error) {
			console.error("Fehler beim Erstellen der Prüfung:", error);
			throw error;
		}
	}

	async updateExam(id: string, updates: Partial<Exam>): Promise<Exam> {
		try {
			const exams = await this.getAllExams();
			const index = exams.findIndex((exam) => exam.id === id);

			if (index === -1) {
				throw new Error(`Prüfung mit ID ${id} nicht gefunden`);
			}

			const updatedExam: Exam = {
				...exams[index],
				...updates,
				id: exams[index].id,
				updatedAt: new Date(),
			};

			exams[index] = updatedExam;
			await storage.setItem(EXAMS_KEY, JSON.stringify(exams));

			return updatedExam;
		} catch (error) {
			console.error("Fehler beim Aktualisieren der Prüfung:", error);
			throw error;
		}
	}

	async deleteExam(id: string): Promise<void> {
		try {
			// Lösche Prüfung
			const exams = await this.getAllExams();
			const filteredExams = exams.filter((exam) => exam.id !== id);
			await storage.setItem(EXAMS_KEY, JSON.stringify(filteredExams));

			// Lösche alle zugehörigen Resultate
			const results = await this.getAllResults();
			const filteredResults = results.filter((result) => result.examId !== id);
			await storage.setItem(
				EXAM_RESULTS_KEY,
				JSON.stringify(filteredResults),
			);
		} catch (error) {
			console.error("Fehler beim Löschen der Prüfung:", error);
			throw error;
		}
	}

	// === RESULTATE ===

	async getAllResults(): Promise<ExamResult[]> {
		try {
			const resultsJson = await storage.getItem(EXAM_RESULTS_KEY);
			if (!resultsJson) return [];

			const results = JSON.parse(resultsJson);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return results.map((result: any) => ({
				...result,
				createdAt: new Date(result.createdAt),
				updatedAt: new Date(result.updatedAt),
			}));
		} catch (error) {
			console.error("Fehler beim Laden der Resultate:", error);
			return [];
		}
	}

	async getResultsByExam(examId: string): Promise<ExamResult[]> {
		const results = await this.getAllResults();
		return results.filter((result) => result.examId === examId);
	}

	async getResultsByStudent(studentId: string): Promise<ExamResult[]> {
		const results = await this.getAllResults();
		return results.filter((result) => result.studentId === studentId);
	}

	async getResultByStudentAndExam(
		studentId: string,
		examId: string,
	): Promise<ExamResult | null> {
		const results = await this.getAllResults();
		return (
			results.find(
				(r) => r.studentId === studentId && r.examId === examId,
			) || null
		);
	}

	async saveResult(
		examId: string,
		studentId: string,
		points: number,
		notes?: string,
	): Promise<ExamResult> {
		try {
			// Hole Prüfung für Notenberechnung
			const exam = await this.getExamById(examId);
			if (!exam) {
				throw new Error(`Prüfung mit ID ${examId} nicht gefunden`);
			}

			// Addiere Bonuspunkte zu den erreichten Punkten
			const bonusPoints = exam.bonusPoints || 0;
			const finalPoints = Math.min(points + bonusPoints, exam.maxPoints);

			// Berechne Note mit finalen Punkten
			const gradeCalc = calculateGrade(finalPoints, exam.maxPoints);

			const results = await this.getAllResults();
			const existingIndex = results.findIndex(
				(r) => r.studentId === studentId && r.examId === examId,
			);

			const now = new Date();
			let result: ExamResult;

			if (existingIndex !== -1) {
				// Update existierendes Resultat
				result = {
					...results[existingIndex],
					points,
					grade: gradeCalc.grade,
					notes,
					updatedAt: now,
				};
				results[existingIndex] = result;
			} else {
				// Neues Resultat erstellen
				result = {
					id: uuidv4(),
					examId,
					studentId,
					points,
					grade: gradeCalc.grade,
					notes,
					createdAt: now,
					updatedAt: now,
				};
				results.push(result);
			}

			await storage.setItem(EXAM_RESULTS_KEY, JSON.stringify(results));
			return result;
		} catch (error) {
			console.error("Fehler beim Speichern des Resultats:", error);
			throw error;
		}
	}

	async deleteResult(id: string): Promise<void> {
		try {
			const results = await this.getAllResults();
			const filteredResults = results.filter((result) => result.id !== id);
			await storage.setItem(
				EXAM_RESULTS_KEY,
				JSON.stringify(filteredResults),
			);
		} catch (error) {
			console.error("Fehler beim Löschen des Resultats:", error);
			throw error;
		}
	}

	// === STATISTIKEN ===

	async getExamStatistics(examId: string) {
		const results = await this.getResultsByExam(examId);
		const exam = await this.getExamById(examId);

		if (!exam || results.length === 0) {
			return null;
		}

		const bonusPoints = exam.bonusPoints || 0;
		const grades = results.map((r) => r.grade);
		const points = results.map((r) => r.points);

		// Berechne finale Punkte mit Bonus (aber max. maxPoints)
		const finalPoints = points.map(p => Math.min(p + bonusPoints, exam.maxPoints));

		const averageGrade = grades.reduce((a, b) => a + b, 0) / grades.length;
		const averagePoints = points.reduce((a, b) => a + b, 0) / points.length;
		const averageFinalPoints = finalPoints.reduce((a, b) => a + b, 0) / finalPoints.length;
		const averagePercentage = (averageFinalPoints / exam.maxPoints) * 100;

		const bestGrade = Math.max(...grades);
		const worstGrade = Math.min(...grades);
		const bestPoints = Math.max(...points);
		const worstPoints = Math.min(...points);

		const passedCount = results.filter((r) => r.grade >= 4).length;
		const failedCount = results.length - passedCount;
		const passRate = (passedCount / results.length) * 100;

		return {
			totalResults: results.length,
			averageGrade: Math.round(averageGrade * 10) / 10,
			averagePoints: Math.round(averagePoints * 10) / 10,
			averagePercentage: Math.round(averagePercentage * 10) / 10,
			bestGrade,
			worstGrade,
			bestPoints,
			worstPoints,
			passedCount,
			failedCount,
			passRate: Math.round(passRate * 10) / 10,
		};
	}

	async replaceAllExams(exams: Exam[]): Promise<void> {
		await storage.setItem(EXAMS_KEY, JSON.stringify(exams));
	}

	async replaceAllResults(results: ExamResult[]): Promise<void> {
		await storage.setItem(EXAM_RESULTS_KEY, JSON.stringify(results));
	}
}

export default new ExamService();
