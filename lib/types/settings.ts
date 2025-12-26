export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sonntag, 1=Montag, etc.

export interface TileConfig {
	id: string;
	route: string;
	icon: string;
	title: string;
	description: string;
	color: string;
	enabled: boolean;
	order: number;
}

export interface AppSettings {
	// Wochentage-Einstellungen
	visibleWeekdays: DayOfWeek[];

	// Kachel-Einstellungen
	tiles: TileConfig[];

	// Metadaten
	lastUpdated: Date;
}

export const DEFAULT_TILES: TileConfig[] = [
	{ id: "schedule", route: "/stundenplan", icon: "📅", title: "Stundenplan", description: "Verwalten", color: "#007AFF", enabled: true, order: 1 },
	{ id: "week", route: "/wochenansicht", icon: "📊", title: "Wochenansicht", description: "Übersicht", color: "#34C759", enabled: true, order: 2 },
	{ id: "themes", route: "/themen", icon: "📚", title: "Oberthemen", description: "Materialien", color: "#AF52DE", enabled: true, order: 3 },
	{ id: "exams", route: "/pruefungen", icon: "📝", title: "Prüfungen", description: "Resultate", color: "#FF9500", enabled: true, order: 4 },
	{ id: "classes", route: "/klassen", icon: "👥", title: "Klassen", description: "Schüler:innen", color: "#5AC8FA", enabled: true, order: 5 },
	{ id: "month", route: "/monatsansicht", icon: "📅", title: "Monatsansicht", description: "Kalender", color: "#5856D6", enabled: true, order: 6 },
	{ id: "blockages", route: "/sperrzeiten", icon: "🚫", title: "Sperrzeiten", description: "Blockierungen", color: "#FF3B30", enabled: true, order: 7 },
	{ id: "import", route: "/kalender-import", icon: "📥", title: "Import", description: "ICS-Datei", color: "#32ADE6", enabled: true, order: 8 },
	{ id: "colors", route: "/farben", icon: "🎨", title: "Farben", description: "Klassen", color: "#FF2D55", enabled: true, order: 9 },
	{ id: "coaching", route: "/coaching", icon: "💬", title: "Coaching", description: "Gespräche", color: "#FF6B6B", enabled: true, order: 10 },
	{ id: "settings", route: "/einstellungen", icon: "⚙️", title: "Einstellungen", description: "Konfiguration", color: "#8E8E93", enabled: true, order: 11 },
];
