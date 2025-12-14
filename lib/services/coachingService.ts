import { storage } from "./storage";
import {
	CoachingSession,
	CoachingGoal,
	CoachingStatus,
	GoalStatus,
	CoachingThemeTag,
} from "../types";

const SESSIONS_KEY = "coachingSessions";
const TAGS_KEY = "coachingTags";

class CoachingService {
	// ========== Session Management ==========

	async getAllSessions(): Promise<CoachingSession[]> {
		try {
			const data = await storage.getItem(SESSIONS_KEY);
			if (!data) return [];
			return JSON.parse(data);
		} catch (error) {
			console.error("Error loading coaching sessions:", error);
			return [];
		}
	}

	async getSessionsByStudent(studentId: string): Promise<CoachingSession[]> {
		const sessions = await this.getAllSessions();
		return sessions
			.filter((s) => s.studentId === studentId)
			.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	}

	async getSessionsByClass(classId: string): Promise<CoachingSession[]> {
		const sessions = await this.getAllSessions();
		return sessions
			.filter((s) => s.classId === classId)
			.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	}

	async getSessionById(sessionId: string): Promise<CoachingSession | null> {
		const sessions = await this.getAllSessions();
		return sessions.find((s) => s.id === sessionId) || null;
	}

	async createSession(
		studentId: string,
		classId: string,
		data: Partial<CoachingSession>,
	): Promise<CoachingSession> {
		const sessions = await this.getAllSessions();

		const newSession: CoachingSession = {
			id: Date.now().toString(),
			studentId,
			classId,
			date: data.date || new Date().toISOString(),
			parentsPresent: data.parentsPresent || false,
			occasion: data.occasion || "",
			themeTags: data.themeTags || [],
			strengths: data.strengths || "",
			challenges: data.challenges || "",
			goals: data.goals || [],
			nextSteps: data.nextSteps || "",
			status: data.status || "planned",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		sessions.push(newSession);
		await storage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
		return newSession;
	}

	async updateSession(
		sessionId: string,
		updates: Partial<CoachingSession>,
	): Promise<boolean> {
		try {
			const sessions = await this.getAllSessions();
			const index = sessions.findIndex((s) => s.id === sessionId);

			if (index === -1) return false;

			sessions[index] = {
				...sessions[index],
				...updates,
				updatedAt: new Date(),
			};

			await storage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
			return true;
		} catch (error) {
			console.error("Error updating session:", error);
			return false;
		}
	}

	async deleteSession(sessionId: string): Promise<boolean> {
		try {
			const sessions = await this.getAllSessions();
			const filtered = sessions.filter((s) => s.id !== sessionId);
			await storage.setItem(SESSIONS_KEY, JSON.stringify(filtered));
			return true;
		} catch (error) {
			console.error("Error deleting session:", error);
			return false;
		}
	}

	// ========== Goal Management ==========

	async getActiveGoalsForStudent(studentId: string): Promise<CoachingGoal[]> {
		const sessions = await this.getSessionsByStudent(studentId);
		const allGoals: CoachingGoal[] = [];

		sessions.forEach((session) => {
			const activeGoals = session.goals.filter((g) => g.status === "active");
			allGoals.push(...activeGoals);
		});

		return allGoals.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);
	}

	async addGoalToSession(
		sessionId: string,
		description: string,
	): Promise<CoachingGoal | null> {
		try {
			const sessions = await this.getAllSessions();
			const session = sessions.find((s) => s.id === sessionId);

			if (!session) return null;

			const newGoal: CoachingGoal = {
				id: Date.now().toString(),
				sessionId,
				description,
				status: "active",
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			session.goals.push(newGoal);
			session.updatedAt = new Date();

			await storage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
			return newGoal;
		} catch (error) {
			console.error("Error adding goal:", error);
			return null;
		}
	}

	async updateGoal(
		sessionId: string,
		goalId: string,
		updates: Partial<CoachingGoal>,
	): Promise<boolean> {
		try {
			const sessions = await this.getAllSessions();
			const session = sessions.find((s) => s.id === sessionId);

			if (!session) return false;

			const goalIndex = session.goals.findIndex((g) => g.id === goalId);
			if (goalIndex === -1) return false;

			session.goals[goalIndex] = {
				...session.goals[goalIndex],
				...updates,
				updatedAt: new Date(),
			};

			session.updatedAt = new Date();

			await storage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
			return true;
		} catch (error) {
			console.error("Error updating goal:", error);
			return false;
		}
	}

	async deleteGoal(sessionId: string, goalId: string): Promise<boolean> {
		try {
			const sessions = await this.getAllSessions();
			const session = sessions.find((s) => s.id === sessionId);

			if (!session) return false;

			session.goals = session.goals.filter((g) => g.id !== goalId);
			session.updatedAt = new Date();

			await storage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
			return true;
		} catch (error) {
			console.error("Error deleting goal:", error);
			return false;
		}
	}

	// ========== Statistics ==========

	async getStudentStatistics(studentId: string) {
		const sessions = await this.getSessionsByStudent(studentId);
		const activeGoals = await this.getActiveGoalsForStudent(studentId);

		const completedSessions = sessions.filter((s) => s.status === "completed");
		const plannedSessions = sessions.filter((s) => s.status === "planned");
		const cancelledSessions = sessions.filter((s) => s.status === "cancelled");

		const totalGoals = sessions.reduce(
			(sum, session) => sum + session.goals.length,
			0,
		);
		const achievedGoals = sessions.reduce(
			(sum, session) =>
				sum + session.goals.filter((g) => g.status === "achieved").length,
			0,
		);

		return {
			totalSessions: sessions.length,
			completedSessions: completedSessions.length,
			plannedSessions: plannedSessions.length,
			cancelledSessions: cancelledSessions.length,
			totalGoals,
			achievedGoals,
			activeGoals: activeGoals.length,
			goalAchievementRate:
				totalGoals > 0 ? Math.round((achievedGoals / totalGoals) * 100) : 0,
		};
	}

	// ========== Theme Tag Helpers ==========

	private getDefaultTags(): Record<string, string> {
		return {
			learning_behavior: "Lernverhalten",
			social_interaction: "Soziales Miteinander",
			motivation: "Motivation",
			concentration: "Konzentration",
			friendships: "Freundschaften",
			independence: "Selbstständigkeit",
			conflict_resolution: "Konfliktlösung",
			other: "Sonstiges",
		};
	}

	async getCoachingTags(): Promise<Record<string, string>> {
		try {
			const data = await storage.getItem(TAGS_KEY);
			if (!data) {
				// Wenn keine Tags gespeichert sind, Standard-Tags speichern und zurückgeben
				const defaultTags = this.getDefaultTags();
				await storage.setItem(TAGS_KEY, JSON.stringify(defaultTags));
				return defaultTags;
			}
			return JSON.parse(data);
		} catch (error) {
			console.error("Error loading coaching tags:", error);
			return this.getDefaultTags();
		}
	}

	async updateCoachingTags(tags: Record<string, string>): Promise<boolean> {
		try {
			await storage.setItem(TAGS_KEY, JSON.stringify(tags));
			return true;
		} catch (error) {
			console.error("Error updating coaching tags:", error);
			return false;
		}
	}

	async addCoachingTag(key: string, label: string): Promise<boolean> {
		try {
			const tags = await this.getCoachingTags();
			tags[key] = label;
			await storage.setItem(TAGS_KEY, JSON.stringify(tags));
			return true;
		} catch (error) {
			console.error("Error adding coaching tag:", error);
			return false;
		}
	}

	async deleteCoachingTag(key: string): Promise<boolean> {
		try {
			const tags = await this.getCoachingTags();
			delete tags[key];
			await storage.setItem(TAGS_KEY, JSON.stringify(tags));
			return true;
		} catch (error) {
			console.error("Error deleting coaching tag:", error);
			return false;
		}
	}

	async resetTagsToDefault(): Promise<boolean> {
		try {
			const defaultTags = this.getDefaultTags();
			await storage.setItem(TAGS_KEY, JSON.stringify(defaultTags));
			return true;
		} catch (error) {
			console.error("Error resetting tags:", error);
			return false;
		}
	}

	async getThemeTagLabel(tag: string): Promise<string> {
		const tags = await this.getCoachingTags();
		return tags[tag] || tag;
	}

	async getAllThemeTags(): Promise<string[]> {
		const tags = await this.getCoachingTags();
		return Object.keys(tags);
	}
}

export default new CoachingService();
