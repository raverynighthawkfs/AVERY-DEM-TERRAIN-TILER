const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { generateTerrainTiles } = require('./src/pipeline');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'ui', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS keep app alive until explicit quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('select-input-dem', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'DEM / GeoTIFF', extensions: ['tif', 'tiff'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('select-output-dir', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  });

  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('run-tiler', async (event, options) => {
  try {
    const { inputPath, outputDir, tileSize, maxLevel } = options || {};

    if (!inputPath || !outputDir) {
      throw new Error('Input DEM and output directory are required');
    }

    await generateTerrainTiles({
      inputPath,
      outputDir,
      tileSize: Number(tileSize) || 256,
      maxLevel: Number(maxLevel) || 10,
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
});
