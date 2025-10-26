const fs = require("fs").promises;
const path = require("path");

const CONFIG_FILE = path.join(__dirname, "config.json");
const DEFAULT_CONFIG = {
  databases: {
    streamer: null,
    viewer: null,
  },
  schemaVersion: "1.0.0",
  setupComplete: false,
  lastUpdated: null,
};

class ConfigManager {
  constructor() {
    this.config = null;
  }

  async load() {
    try {
      const configData = await fs.readFile(CONFIG_FILE, "utf8");
      this.config = JSON.parse(configData);
    } catch (error) {
      // If file doesn't exist or is invalid, create default config
      this.config = DEFAULT_CONFIG;
      await this.save();
    }
    return this.config;
  }

  async save() {
    this.config.lastUpdated = new Date().toISOString();
    await fs.writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2));
  }

  async updateDatabases(streamerDbId, viewerDbId) {
    this.config.databases.streamer = streamerDbId;
    this.config.databases.viewer = viewerDbId;
    this.config.setupComplete = true;
    await this.save();
  }

  async getDatabaseIds() {
    if (!this.config) {
      await this.load();
    }
    return this.config.databases;
  }

  async isSetupComplete() {
    if (!this.config) {
      await this.load();
    }
    return this.config.setupComplete;
  }
}

module.exports = new ConfigManager();
