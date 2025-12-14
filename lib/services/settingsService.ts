import { storage } from "./storage";
import { AppSettings, TileConfig, DayOfWeek, DEFAULT_TILES } from "../types/settings";

const SETTINGS_KEY = "appSettings";

class SettingsService {
	async getSettings(): Promise<AppSettings> {
		try {
			const data = await storage.getItem(SETTINGS_KEY);
			if (!data) {
				return this.getDefaultSettings();
			}
			const settings: AppSettings = JSON.parse(data);

			// Merge any new default tiles that don't exist in saved settings
			const savedTileIds = settings.tiles.map(t => t.id);
			const missingTiles = DEFAULT_TILES.filter(t => !savedTileIds.includes(t.id));
			if (missingTiles.length > 0) {
				const maxOrder = Math.max(...settings.tiles.map(t => t.order), 0);
				missingTiles.forEach((tile, idx) => {
					settings.tiles.push({ ...tile, order: maxOrder + idx + 1 });
				});
				await this.saveSettings(settings);
			}

			return settings;
		} catch (error) {
			console.error("Error loading settings:", error);
			return this.getDefaultSettings();
		}
	}

	async saveSettings(settings: AppSettings): Promise<boolean> {
		try {
			settings.lastUpdated = new Date();
			await storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
			return true;
		} catch (error) {
			console.error("Error saving settings:", error);
			return false;
		}
	}

	getDefaultSettings(): AppSettings {
		return {
			visibleWeekdays: [1, 2, 3, 4, 5], // Montag bis Freitag
			tiles: DEFAULT_TILES,
			lastUpdated: new Date(),
		};
	}

	async updateVisibleWeekdays(weekdays: DayOfWeek[]): Promise<boolean> {
		const settings = await this.getSettings();
		settings.visibleWeekdays = weekdays;
		return this.saveSettings(settings);
	}

	async updateTiles(tiles: TileConfig[]): Promise<boolean> {
		const settings = await this.getSettings();
		settings.tiles = tiles;
		return this.saveSettings(settings);
	}

	async toggleTile(tileId: string, enabled: boolean): Promise<boolean> {
		const settings = await this.getSettings();
		const tile = settings.tiles.find(t => t.id === tileId);
		if (tile) {
			tile.enabled = enabled;
			return this.saveSettings(settings);
		}
		return false;
	}

	async updateTileColor(tileId: string, color: string): Promise<boolean> {
		const settings = await this.getSettings();
		const tile = settings.tiles.find(t => t.id === tileId);
		if (tile) {
			tile.color = color;
			return this.saveSettings(settings);
		}
		return false;
	}

	async reorderTiles(tiles: TileConfig[]): Promise<boolean> {
		const settings = await this.getSettings();
		settings.tiles = tiles.map((tile, index) => ({ ...tile, order: index + 1 }));
		return this.saveSettings(settings);
	}

	async resetToDefaults(): Promise<boolean> {
		return this.saveSettings(this.getDefaultSettings());
	}

	getDayName(day: DayOfWeek): string {
		const names = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
		return names[day];
	}
}

export default new SettingsService();
