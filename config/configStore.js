const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

class ConfigStore {
  constructor() {
    // Store configs in memory, indexed by channel ID
    this.configs = new Map();
    this.configDir = path.join(__dirname, "../data");
  }

  async init() {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
    } catch (error) {
      console.error("Error creating config directory:", error);
    }
  }

  getConfigPath(channelId) {
    return path.join(this.configDir, `${channelId}.json`);
  }

  async loadConfig(channelId) {
    if (this.configs.has(channelId)) {
      return this.configs.get(channelId);
    }

    try {
      const configPath = this.getConfigPath(channelId);
      const data = await fs.readFile(configPath, "utf8");
      const config = JSON.parse(data);
      this.configs.set(channelId, config);
      return config;
    } catch (error) {
      // Return default config if file doesn't exist or is invalid
      const defaultConfig = {
        notionKey: null,
        databases: {
          streamer: null,
          viewer: null,
        },
        setupComplete: false,
        lastUpdated: null,
      };
      this.configs.set(channelId, defaultConfig);
      return defaultConfig;
    }
  }

  async saveConfig(channelId, config) {
    try {
      const configPath = this.getConfigPath(channelId);
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      this.configs.set(channelId, config);
    } catch (error) {
      console.error(`Error saving config for channel ${channelId}:`, error);
      throw error;
    }
  }

  async updateConfig(channelId, updates) {
    const config = await this.loadConfig(channelId);
    const newConfig = {
      ...config,
      ...updates,
      lastUpdated: new Date().toISOString(),
    };
    await this.saveConfig(channelId, newConfig);
    return newConfig;
  }

  async getSetupStatus(channelId) {
    const config = await this.loadConfig(channelId);
    return {
      notionConnected: !!config.notionKey,
      databasesCreated: !!(
        config.databases?.streamer && config.databases?.viewer
      ),
      setupComplete: config.setupComplete,
    };
  }

  // Encrypt sensitive data before saving
  encryptData(data) {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error("ENCRYPTION_KEY environment variable not set");
    }
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      "aes-256-gcm",
      Buffer.from(key, "hex"),
      iv,
    );
    const encrypted = Buffer.concat([
      cipher.update(data, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return {
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
      data: encrypted.toString("hex"),
    };
  }

  // Decrypt sensitive data when loading
  decryptData(encrypted) {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error("ENCRYPTION_KEY environment variable not set");
    }
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      Buffer.from(key, "hex"),
      Buffer.from(encrypted.iv, "hex"),
    );
    decipher.setAuthTag(Buffer.from(encrypted.authTag, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted.data, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }
}

module.exports = new ConfigStore();
