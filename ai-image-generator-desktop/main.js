const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');
const Database = require('./database');

let mainWindow;
const db = new Database();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'AI Image Generator',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC Handlers
ipcMain.handle('generate-image', async (event, { prompt, size, quality, style }) => {
  try {
    const settings = db.getSettings();

    if (!settings.apiKey) {
      throw new Error('OpenAI API key is not configured. Please add it in Settings.');
    }

    if (!prompt || !prompt.trim()) {
      throw new Error('Please enter a prompt.');
    }

    const limit = parseInt(settings.rateLimit) || 10;
    const recentCount = db.getRecentGenerationCount(1);
    if (recentCount >= limit) {
      throw new Error(`Rate limit exceeded. Maximum ${limit} generations per hour.`);
    }

    const allowedSizes = ['1024x1024', '1792x1024', '1024x1792'];
    const allowedQuality = ['standard', 'hd'];
    const allowedStyle = ['vivid', 'natural'];

    if (!allowedSizes.includes(size)) size = '1024x1024';
    if (!allowedQuality.includes(quality)) quality = 'standard';
    if (!allowedStyle.includes(style)) style = 'vivid';

    const body = JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt.trim(),
      n: 1,
      size: size,
      quality: quality,
      style: style,
      response_format: 'url'
    });

    const result = await makeOpenAIRequest(body, settings.apiKey);

    db.logGeneration({
      prompt: prompt.trim(),
      size: size,
      quality: quality,
      style: style,
      imageUrl: result.url,
      revisedPrompt: result.revised_prompt || prompt.trim()
    });

    return {
      success: true,
      url: result.url,
      revisedPrompt: result.revised_prompt || prompt.trim(),
      size: size,
      quality: quality,
      style: style
    };

  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-settings', async (event, settings) => {
  try {
    db.saveSettings(settings);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-settings', async () => {
  try {
    const settings = db.getSettings();
    return { success: true, settings };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-history', async (event, { limit = 50, offset = 0 }) => {
  try {
    const history = db.getHistory(limit, offset);
    return { success: true, history };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-history', async () => {
  try {
    db.clearHistory();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-image', async (event, { url, prompt }) => {
  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `ai-generated-${sanitizeFilename(prompt)}.png`,
      filters: [
        { name: 'PNG Images', extensions: ['png'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!filePath) {
      return { success: false, cancelled: true };
    }

    await downloadFile(url, filePath);
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
});

function makeOpenAIRequest(body, apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.openai.com',
      path: '/v1/images/generations',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 60000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode !== 200) {
            reject(new Error(parsed.error?.message || `API Error: ${res.statusCode}`));
          } else if (!parsed.data || !parsed.data[0] || !parsed.data[0].url) {
            reject(new Error('Invalid response from OpenAI API.'));
          } else {
            resolve({
              url: parsed.data[0].url,
              revised_prompt: parsed.data[0].revised_prompt
            });
          }
        } catch (e) {
          reject(new Error('Failed to parse API response.'));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Request failed: ${err.message}`)));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out. Please try again.'));
    });

    req.write(body);
    req.end();
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { timeout: 30000 }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

function sanitizeFilename(str) {
  return str.replace(/[^a-z0-9]/gi, '-').substring(0, 40).toLowerCase() || 'image';
}
