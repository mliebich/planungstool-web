import { storage } from "./storage";
import { v4 as uuidv4 } from "uuid";
import { Class, Student } from "../types";

const CLASSES_KEY = "classes";

// Hilfsfunktionen für Duplikaterkennung
function normalizeStr(s?: string): string {
	return (s || "").trim().toLowerCase();
}

function studentIdentityKeys(s: Partial<Student>): string[] {
	const keys: string[] = [];
	if (s.email) keys.push(`email:${normalizeStr(s.email)}`);
	if (s.birthDate && s.firstName && s.lastName) {
		keys.push(
			`bd:${normalizeStr(s.birthDate)}:${normalizeStr(s.firstName)}:${normalizeStr(s.lastName)}`,
		);
	}
	if (s.firstName && s.lastName) {
		keys.push(`name:${normalizeStr(s.firstName)}:${normalizeStr(s.lastName)}`);
	}
	return keys;
}

class ClassService {
	async getAllClasses(): Promise<Class[]> {
		try {
			const classesJson = await storage.getItem(CLASSES_KEY);
			if (!classesJson) {
				return [];
			}
			const classes = JSON.parse(classesJson);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return classes.map((cls: any) => ({
				...cls,
				createdAt: new Date(cls.createdAt),
				updatedAt: new Date(cls.updatedAt),
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				students: cls.students.map((student: any) => ({
					...student,
					createdAt: new Date(student.createdAt),
					updatedAt: new Date(student.updatedAt),
				})),
			}));
		} catch (error) {
			console.error("Fehler beim Laden der Klassen:", error);
			return [];
		}
	}

	async getClassById(id: string): Promise<Class | null> {
		const classes = await this.getAllClasses();
		return classes.find((cls) => cls.id === id) || null;
	}

	async createClass(
		classData: Omit<Class, "id" | "createdAt" | "updatedAt" | "students">,
	): Promise<Class> {
		const newClass: Class = {
			...classData,
			id: uuidv4(),
			students: [],
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const classes = await this.getAllClasses();
		classes.push(newClass);
		await storage.setItem(CLASSES_KEY, JSON.stringify(classes));

		return newClass;
	}

	async updateClass(id: string, updates: Partial<Class>): Promise<Class> {
		const classes = await this.getAllClasses();
		const index = classes.findIndex((cls) => cls.id === id);

		if (index === -1) {
			throw new Error(`Klasse mit ID ${id} nicht gefunden`);
		}

		const updatedClass: Class = {
			...classes[index],
			...updates,
			id: classes[index].id,
			updatedAt: new Date(),
		};

		classes[index] = updatedClass;
		await storage.setItem(CLASSES_KEY, JSON.stringify(classes));

		return updatedClass;
	}

	async deleteClass(id: string): Promise<void> {
		const classes = await this.getAllClasses();
		const filteredClasses = classes.filter((cls) => cls.id !== id);
		await storage.setItem(CLASSES_KEY, JSON.stringify(filteredClasses));
	}

	async addStudentsToClass(
		classId: string,
		students: Omit<Student, "id" | "createdAt" | "updatedAt">[],
	): Promise<Class> {
		const currentClass = await this.getClassById(classId);
		if (!currentClass) {
			throw new Error(`Klasse mit ID ${classId} nicht gefunden`);
		}

		const now = new Date();

		// Duplikaterkennung
		const existingStudentKeys = new Set<string>();
		for (const s of currentClass.students) {
			for (const key of studentIdentityKeys(s)) existingStudentKeys.add(key);
		}

		const seenNewKeys = new Set<string>();
		const filteredStudents = students.filter((student) => {
			const keys = studentIdentityKeys(student);
			if (keys.length === 0 && student.firstName && student.lastName) {
				keys.push(
					`name:${normalizeStr(student.firstName)}:${normalizeStr(student.lastName)}`,
				);
			}
			const isDup = keys.some((k) => existingStudentKeys.has(k) || seenNewKeys.has(k));
			if (!isDup) {
				for (const k of keys) seenNewKeys.add(k);
				return true;
			}
			return false;
		});

		const newStudents: Student[] = filteredStudents.map((student) => ({
			...student,
			id: uuidv4(),
			createdAt: now,
			updatedAt: now,
		}));

		const updatedStudents = [...currentClass.students, ...newStudents];
		return await this.updateClass(classId, { students: updatedStudents });
	}

	async updateStudent(
		classId: string,
		studentId: string,
		updates: Partial<Student>,
	): Promise<Class> {
		const currentClass = await this.getClassById(classId);
		if (!currentClass) {
			throw new Error(`Klasse mit ID ${classId} nicht gefunden`);
		}

		const studentIndex = currentClass.students.findIndex(
			(s) => s.id === studentId,
		);
		if (studentIndex === -1) {
			throw new Error(`Schüler:in mit ID ${studentId} nicht gefunden`);
		}

		const updatedStudents = [...currentClass.students];
		updatedStudents[studentIndex] = {
			...updatedStudents[studentIndex],
			...updates,
			id: studentId,
			updatedAt: new Date(),
		};

		return await this.updateClass(classId, { students: updatedStudents });
	}

	async removeStudent(classId: string, studentId: string): Promise<Class> {
		const currentClass = await this.getClassById(classId);
		if (!currentClass) {
			throw new Error(`Klasse mit ID ${classId} nicht gefunden`);
		}

		const updatedStudents = currentClass.students.filter(
			(s) => s.id !== studentId,
		);

		return await this.updateClass(classId, { students: updatedStudents });
	}

	async replaceAllClasses(classes: Class[]): Promise<void> {
		await storage.setItem(CLASSES_KEY, JSON.stringify(classes));
	}
}

export default new ClassService();
