/**
 * Parst tabellarische Daten aus der Zwischenablage (Excel-Format)
 * Erwartet Tab-getrennte Werte mit Spaltenüberschriften in der ersten Zeile
 */

export interface ParsedStudentData {
	firstName: string;
	lastName: string;
	email?: string;
	birthDate?: string;
	gender?: "m" | "f" | "d";
	notes?: string;
}

export interface ParseResult {
	success: boolean;
	data: ParsedStudentData[];
	errors: string[];
	warnings: string[];
}

/**
 * Normalisiert Spaltennamen (entfernt Leerzeichen, macht lowercase, etc.)
 */
function normalizeColumnName(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/\s+/g, "_")
		.replace(/[äöü]/g, (match) => {
			const map: { [key: string]: string } = { ä: "ae", ö: "oe", ü: "ue" };
			return map[match] || match;
		});
}

/**
 * Mappt verschiedene mögliche Spaltennamen auf Standard-Feldnamen
 */
const COLUMN_MAPPINGS: { [key: string]: string[] } = {
	firstName: [
		"vorname",
		"first_name",
		"firstname",
		"name",
		"vname",
		"first",
		"givenname",
	],
	lastName: [
		"nachname",
		"last_name",
		"lastname",
		"familienname",
		"surname",
		"nname",
		"last",
		"familyname",
	],
	email: ["email", "e-mail", "mail", "e_mail"],
	birthDate: [
		"geburtsdatum",
		"geburtstag",
		"birth_date",
		"birthdate",
		"birthday",
		"dob",
		"date_of_birth",
	],
	gender: ["geschlecht", "gender", "sex"],
	notes: ["notizen", "notes", "bemerkung", "bemerkungen", "kommentar", "comment"],
};

/**
 * Findet den Standard-Feldnamen für einen gegebenen Spaltennamen
 */
function findFieldName(columnName: string): string | null {
	const normalized = normalizeColumnName(columnName);

	for (const [fieldName, aliases] of Object.entries(COLUMN_MAPPINGS)) {
		if (aliases.includes(normalized)) {
			return fieldName;
		}
	}

	return null;
}

/**
 * Normalisiert Geschlechtsangaben
 */
function normalizeGender(value: string): "m" | "f" | "d" | undefined {
	const normalized = value.toLowerCase().trim();

	if (["m", "männlich", "male", "junge", "boy"].includes(normalized)) {
		return "m";
	}
	if (["w", "f", "weiblich", "female", "mädchen", "girl"].includes(normalized)) {
		return "f";
	}
	if (["d", "divers", "diverse", "other"].includes(normalized)) {
		return "d";
	}

	return undefined;
}

/**
 * Validiert und formatiert ein Datum
 */
function validateDate(dateString: string): string | undefined {
	if (!dateString || dateString.trim() === "") {
		return undefined;
	}

	// Versuche verschiedene Datumsformate zu parsen
	const formats = [
		/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, // DD.MM.YYYY
		/^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
		/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // DD/MM/YYYY
	];

	for (const format of formats) {
		const match = dateString.trim().match(format);
		if (match) {
			// Konvertiere zu ISO-Format (YYYY-MM-DD)
			if (format === formats[0] || format === formats[2]) {
				// DD.MM.YYYY oder DD/MM/YYYY
				const day = match[1].padStart(2, "0");
				const month = match[2].padStart(2, "0");
				const year = match[3];
				return `${year}-${month}-${day}`;
			} else {
				// YYYY-MM-DD
				return dateString.trim();
			}
		}
	}

	return undefined;
}

/**
 * Hauptfunktion zum Parsen von Excel-Daten aus der Zwischenablage
 */
export function parseStudentsFromClipboard(
	clipboardText: string,
): ParseResult {
	const errors: string[] = [];
	const warnings: string[] = [];
	const data: ParsedStudentData[] = [];

	if (!clipboardText || clipboardText.trim() === "") {
		return {
			success: false,
			data: [],
			errors: ["Keine Daten in der Zwischenablage gefunden"],
			warnings: [],
		};
	}

	// Zeilen trennen (sowohl \n als auch \r\n berücksichtigen)
	const lines = clipboardText.split(/\r?\n/).filter((line) => line.trim() !== "");

	if (lines.length < 2) {
		return {
			success: false,
			data: [],
			errors: ["Mindestens 2 Zeilen erforderlich (Überschrift + Daten)"],
			warnings: [],
		};
	}

	// Erste Zeile sind die Spaltenüberschriften
	const headerLine = lines[0];
	const headers = headerLine.split("\t").map((h) => h.trim());

	// Mappe Spaltenindizes zu Feldnamen
	const columnMapping: { [index: number]: string } = {};
	headers.forEach((header, index) => {
		const fieldName = findFieldName(header);
		if (fieldName) {
			columnMapping[index] = fieldName;
		}
	});

	// Prüfe, ob Pflichtfelder vorhanden sind
	const hasFirstName = Object.values(columnMapping).includes("firstName");
	const hasLastName = Object.values(columnMapping).includes("lastName");

	if (!hasFirstName || !hasLastName) {
		return {
			success: false,
			data: [],
			errors: [
				"Pflichtfelder fehlen: Vorname und Nachname müssen vorhanden sein",
			],
			warnings: [],
		};
	}

	// Verarbeite jede Datenzeile
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		const values = line.split("\t").map((v) => v.trim());

		const student: Partial<ParsedStudentData> = {};
		let hasError = false;

		values.forEach((value, index) => {
			const fieldName = columnMapping[index];
			if (!fieldName) return;

			if (fieldName === "firstName" || fieldName === "lastName") {
				if (!value || value === "") {
					errors.push(
						`Zeile ${i + 1}: ${fieldName === "firstName" ? "Vorname" : "Nachname"} fehlt`,
					);
					hasError = true;
				} else {
					student[fieldName] = value;
				}
			} else if (fieldName === "email") {
				// Einfache Email-Validierung
				if (value && value !== "") {
					if (value.includes("@")) {
						student.email = value;
					} else {
						warnings.push(`Zeile ${i + 1}: Email-Format ungültig - ignoriert`);
					}
				}
			} else if (fieldName === "birthDate") {
				const formattedDate = validateDate(value);
				if (formattedDate) {
					student.birthDate = formattedDate;
				} else if (value && value !== "") {
					warnings.push(
						`Zeile ${i + 1}: Geburtsdatum-Format ungültig - ignoriert`,
					);
				}
			} else if (fieldName === "gender") {
				const gender = normalizeGender(value);
				if (gender) {
					student.gender = gender;
				} else if (value && value !== "") {
					warnings.push(
						`Zeile ${i + 1}: Geschlecht "${value}" nicht erkannt - ignoriert`,
					);
				}
			} else if (fieldName === "notes") {
				if (value && value !== "") {
					student.notes = value;
				}
			}
		});

		// Nur hinzufügen, wenn keine kritischen Fehler vorliegen
		if (!hasError && student.firstName && student.lastName) {
			data.push(student as ParsedStudentData);
		}
	}

	const success = data.length > 0;

	return {
		success,
		data,
		errors,
		warnings,
	};
}

/**
 * Hilfsfunktion zum Generieren einer Beispiel-Vorlage
 */
export function getExampleTemplate(): string {
	return "Vorname\tNachname\tEmail\tGeburtsdatum\tGeschlecht\tNotizen\n" +
		"Max\tMustermann\tmax@example.com\t01.01.2010\tm\tGute Leistungen\n" +
		"Anna\tMüller\tanna@example.com\t15.03.2011\tf\tNachhilfe Mathe";
}
