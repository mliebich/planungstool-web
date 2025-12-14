/**
 * Color utilities for class-based lesson coloring
 */

export interface ClassColorConfig {
	[className: string]: string;
}

// Vordefinierte Farben für verschiedene Klassen
export const DEFAULT_CLASS_COLORS: ClassColorConfig = {
	"1a": "#FF6B6B", // Rot
	"1b": "#4ECDC4", // Türkis
	"1c": "#45B7D1", // Hellblau
	"2a": "#96CEB4", // Mintgrün
	"2b": "#FECA57", // Gelb
	"2c": "#FF9FF3", // Pink
	"3a": "#54A0FF", // Blau
	"3b": "#5F27CD", // Lila
	"3c": "#00D2D3", // Cyan
	"4a": "#FF9F43", // Orange
	"4b": "#10AC84", // Grün
	"4c": "#EE5A24", // Dunkelorange
	"5a": "#0ABDE3", // Hellblau
	"5b": "#FD79A8", // Rosa
	"5c": "#6C5CE7", // Violett
	"6a": "#A29BFE", // Lavendel
	"6b": "#FD79A8", // Rosa
	"6c": "#FDCB6E", // Goldgelb
	"7a": "#FF7675", // Koralle
	"7b": "#74B9FF", // Himmelblau
	"7c": "#81ECEC", // Aqua
	"8a": "#A29BFE", // Helllila
	"8b": "#FD79A8", // Bubblegum
	"8c": "#FDCB6E", // Warmes Gelb
	"9a": "#E17055", // Terra
	"9b": "#00B894", // Mint
	"9c": "#6C5CE7", // Lila
	"10a": "#FF7675", // Pfirsich
	"10b": "#55A3FF", // Königsblau
	"10c": "#26DE81", // Smaragd
	"11a": "#FC427B", // Magenta
	"11b": "#1DD1A1", // Türkisgrün
	"11c": "#F368E0", // Fuchsia
	"12a": "#FF3838", // Rot
	"12b": "#2ED573", // Grün
	"12c": "#1E90FF", // Dodger Blue
};

const DEFAULT_COLOR = "#007AFF"; // Standard iOS blau

/**
 * Generiert eine Farbe für eine gegebene Klasse
 * @param className - Der Name der Klasse (z.B. "5a", "7b")
 * @param customColors - Optionale benutzerdefinierte Farbkonfiguration
 * @returns Hex-Farbcode als String
 */
export const getClassColor = (
	className: string,
	customColors?: ClassColorConfig,
): string => {
	if (!className || className.trim() === "") {
		return DEFAULT_COLOR;
	}

	// Verwende benutzerdefinierte Farben falls vorhanden, sonst Standard
	const colorConfig = customColors || DEFAULT_CLASS_COLORS;

	// Normalisiere den Klassennamen (kleinbuchstaben, entferne whitespace)
	const normalizedClassName = className.toLowerCase().trim();

	// Prüfe ob eine vordefinierte Farbe existiert
	if (colorConfig[normalizedClassName]) {
		return colorConfig[normalizedClassName];
	}

	// Fallback: Generiere eine Farbe basierend auf dem Klassennamen (Hash-basiert)
	return generateColorFromString(className);
};

/**
 * Generiert eine konsistente Farbe basierend auf einem String
 * @param input - Der Input-String
 * @returns HSL-Farbcode als String
 */
export const generateColorFromString = (input: string): string => {
	let hash = 0;
	for (let i = 0; i < input.length; i++) {
		hash = input.charCodeAt(i) + ((hash << 5) - hash);
	}

	// Konvertiere Hash zu Farbe (helle, angenehme Farben)
	// Verwende einen bestimmten Bereich für Hue um zu grelle/dunkle Farben zu vermeiden
	const hue = (Math.abs(hash) % 300) + 30; // 30-330 Grad, vermeidet sehr rote Töne
	const saturation = 65; // 65% Sättigung für lebendige aber nicht überwältigende Farben
	const lightness = 60; // 60% Helligkeit für gute Lesbarkeit

	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

/**
 * Prüft ob eine Farbe hell oder dunkel ist
 * @param color - Hex-Farbcode oder HSL-String
 * @returns true wenn die Farbe hell ist, false wenn dunkel
 */
export const isLightColor = (color: string): boolean => {
	let r: number, g: number, b: number;

	if (color.startsWith("#")) {
		// Hex-Farbe
		const hex = color.replace("#", "");
		r = parseInt(hex.substring(0, 2), 16);
		g = parseInt(hex.substring(2, 4), 16);
		b = parseInt(hex.substring(4, 6), 16);
	} else if (color.startsWith("hsl")) {
		// HSL-Farbe - vereinfachte Umrechnung
		const lightness = parseInt(color.match(/(\d+)%\)$/)?.[1] || "50");
		return lightness > 50;
	} else {
		// Fallback für unbekannte Formate
		return false;
	}

	// Berechne relative Luminanz
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance > 0.5;
};

/**
 * Gibt eine kontrastierende Textfarbe für einen gegebenen Hintergrund zurück
 * @param backgroundColor - Die Hintergrundfarbe
 * @returns "#000000" für helle Hintergründe, "#FFFFFF" für dunkle
 */
export const getContrastTextColor = (backgroundColor: string): string => {
	return isLightColor(backgroundColor) ? "#000000" : "#FFFFFF";
};

/**
 * Extrahiert einzigartige Klassennamen aus einer Liste von Lektionen
 * @param lessons - Array von Lesson-Objekten
 * @returns Sortiertes Array von einzigartigen Klassennamen
 */
export const getUniqueClassNames = (
	lessons: Array<{ class?: string }>,
): string[] => {
	const classNames = lessons
		.map((lesson) => lesson.class)
		.filter(
			(className): className is string =>
				className !== undefined &&
				className !== null &&
				className.trim() !== "",
		)
		.map((className) => className.trim());

	return [...new Set(classNames)].sort();
};

/**
 * Gibt die Standard-Farbkonfiguration zurück
 * @returns Das Standard-Farb-Mapping
 */
export const getDefaultClassColors = (): ClassColorConfig => {
	return { ...DEFAULT_CLASS_COLORS };
};

/**
 * Gibt die Standard-Farbe zurück
 * @returns Standard-Farbe als Hex-String
 */
export const getDefaultColor = (): string => {
	return DEFAULT_COLOR;
};
