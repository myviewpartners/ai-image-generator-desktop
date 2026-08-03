const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class AppDatabase {
  constructor() {
    const dataPath = app.getPath('userData');
    this.settingsPath = path.join(dataPath, 'settings.json');
    this.historyPath = path.join(dataPath, 'history.json');
    this.ensureFiles();
  }

  ensureFiles() {
    if (!fs.existsSync(this.settingsPath)) {
      this.saveSettings({
        apiKey: '',
        defaultSize: '1024x1024',
        defaultQuality: 'standard',
        defaultStyle: 'vivid',
        rateLimit: '10'
      });
    }
    if (!fs.existsSync(this.historyPath)) {
      fs.writeFileSync(this.historyPath, JSON.stringify([]));
    }
  }

  readJson(filePath) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return {};
    }
  }

  writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  getSettings() {
    return this.readJson(this.settingsPath);
  }

  saveSettings(settings) {
    const current = this.getSettings();
    this.writeJson(this.settingsPath, { ...current, ...settings });
  }

  getHistory(limit = 50, offset = 0) {
    const history = this.readJson(this.historyPath);
    return history.slice(offset, offset + limit);
  }

  logGeneration({ prompt, size, quality, style, imageUrl, revisedPrompt }) {
    const history = this.readJson(this.historyPath);
    history.unshift({
      id: Date.now(),
      prompt,
      size,
      quality,
      style,
      image_url: imageUrl,
      revised_prompt: revisedPrompt,
      created_at: new Date().toISOString()
    });
    // Keep only last 500 entries
    if (history.length > 500) history.pop();
    this.writeJson(this.historyPath, history);
  }

  getRecentGenerationCount(hours = 1) {
    const history = this.readJson(this.historyPath);
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    return history.filter(h => h.created_at > cutoff).length;
  }

  clearHistory() {
    this.writeJson(this.historyPath, []);
  }
}

module.exports = AppDatabase;
