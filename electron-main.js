const { app, BrowserWindow, clipboard, dialog, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

const { writeExportFile } = require('./src/services/exporter');
const { decryptEncArchive } = require('./src/services/encDecryptor');
const { prepareLogText, handoffLogText } = require('./src/services/chatgptHandoff');

const APP_ROOT = __dirname;
const UPDATE_CHECK_DELAY_MS = 5000;
const DEFAULT_ZOOM_FACTOR = 1;
const MIN_ZOOM_FACTOR = 0.6;
const MAX_ZOOM_FACTOR = 1.8;
const ZOOM_STEP = 0.1;
let mainWindow = null;
let parseWorker = null;
let autoUpdaterStarted = false;
let handoffBusy = false;

// Large log tables and animated canvases can trigger very high Chromium GPU
// memory on some Windows drivers. Software compositing is slower but keeps the
// desktop app responsive and avoids multi-GB GPU child processes.
app.disableHardwareAcceleration();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1540,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#08110f',
    title: 'BLTN-Analysis Log',
    icon: path.join(APP_ROOT, 'YuRa-256.png'),
    webPreferences: {
      preload: path.join(APP_ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);
  wireWindowShortcuts(mainWindow);
  mainWindow.loadFile(path.join(APP_ROOT, 'index.html'));
}

function wireWindowShortcuts(window) {
  window.webContents.on('did-finish-load', () => {
    setWindowZoom(window, DEFAULT_ZOOM_FACTOR);
  });
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta)) return;
    const key = String(input.key || '').toLowerCase();
    const code = String(input.code || '');
    if (key === '+' || key === '=' || code === 'Equal' || code === 'NumpadAdd') {
      event.preventDefault();
      setWindowZoom(window, getWindowZoom(window) + ZOOM_STEP);
      return;
    }
    if (key === '-' || code === 'Minus' || code === 'NumpadSubtract') {
      event.preventDefault();
      setWindowZoom(window, getWindowZoom(window) - ZOOM_STEP);
      return;
    }
    if (key === '0' || code === 'Digit0' || code === 'Numpad0') {
      event.preventDefault();
      setWindowZoom(window, DEFAULT_ZOOM_FACTOR);
    }
  });
}

function getWindowZoom(window) {
  try {
    return window.webContents.getZoomFactor();
  } catch (_error) {
    return DEFAULT_ZOOM_FACTOR;
  }
}

function setWindowZoom(window, factor) {
  if (!window || window.isDestroyed()) return;
  const next = Math.round(clampNumber(factor, MIN_ZOOM_FACTOR, MAX_ZOOM_FACTOR) * 100) / 100;
  window.webContents.setZoomFactor(next);
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function sendUpdateStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:update-status', status);
  }
}

function setupAutoUpdater() {
  if (autoUpdaterStarted || !canCheckUpdates()) return;
  autoUpdaterStarted = true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => sendUpdateStatus({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => sendUpdateStatus({ state: 'available', version: info.version }));
  autoUpdater.on('update-not-available', () => sendUpdateStatus({ state: 'not-available' }));
  autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus({
      state: 'downloading',
      percent: Math.round(progress.percent || 0),
      transferred: progress.transferred || 0,
      total: progress.total || 0,
      bytesPerSecond: progress.bytesPerSecond || 0
    });
  });
  autoUpdater.on('error', (error) => {
    sendUpdateStatus({ state: 'error', error: error.message });
  });
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus({ state: 'downloaded', version: info.version });
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((error) => {
      sendUpdateStatus({ state: 'error', error: error.message });
    });
  }, UPDATE_CHECK_DELAY_MS);
}

function sendParseEvent(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('logs:parse-event', payload);
  }
}

function stopParseWorker() {
  if (parseWorker) {
    parseWorker.terminate();
    parseWorker = null;
  }
}

function isEncryptedLogFile(filePath) {
  return path.extname(filePath || '').toLowerCase() === '.enc';
}

async function prepareFilesForParsing(filePaths) {
  const preparedFiles = [];

  for (const filePath of filePaths) {
    if (!isEncryptedLogFile(filePath)) {
      preparedFiles.push(filePath);
      continue;
    }

    const decryptedFiles = await decryptAndSelectLogFiles(filePath);
    if (!decryptedFiles.length) {
      return {
        ok: false,
        canceled: true,
        error: 'ENC decrypted successfully, but no DLT file was selected.'
      };
    }
    preparedFiles.push(...decryptedFiles);
  }

  return { ok: true, files: preparedFiles };
}

async function decryptAndSelectLogFiles(encPath) {
  const fileName = path.basename(encPath);
  sendParseEvent({ type: 'decrypt-start', fileName, filePath: encPath });

  const decrypted = await decryptEncArchive({
    inputPath: encPath,
    appRoot: APP_ROOT,
    outputRoot: decryptedEncOutputRoot(encPath)
  });

  sendParseEvent({
    type: 'decrypt-done',
    fileName,
    filePath: encPath,
    outputDir: decrypted.outputDir,
    files: decrypted.candidates
  });

  if (!decrypted.candidates.length) {
    return [];
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: `Choose DLT files from ${fileName}`,
    defaultPath: decrypted.outputDir,
    buttonLabel: 'Open Selected DLT',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'DLT and logs', extensions: ['dlt', 'log', 'bin', 'txt'] },
      { name: 'All files', extensions: ['*'] }
    ]
  });

  return result.canceled ? [] : result.filePaths;
}

function decryptedEncOutputRoot(encPath) {
  return path.dirname(path.resolve(encPath));
}

app.setAppUserModelId('com.bltn.analysis-log');

app.whenReady().then(async () => {
  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      setupAutoUpdater();
    }
  });
});

app.on('window-all-closed', () => {
  stopParseWorker();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('app:get-version', () => app.getVersion());
ipcMain.handle('app:install-update', () => autoUpdater.quitAndInstall(true, true));
ipcMain.handle('app:download-update', () => autoUpdater.downloadUpdate().catch((error) => {
  sendUpdateStatus({ state: 'error', error: error.message });
}));
ipcMain.handle('app:check-update', () => {
  if (!canCheckUpdates()) {
    sendUpdateStatus({ state: 'disabled' });
    return;
  }
  sendUpdateStatus({ state: 'checking' });
  autoUpdater.checkForUpdates().catch((error) => {
    sendUpdateStatus({ state: 'error', error: error.message });
  });
});

ipcMain.handle('logs:open-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open DLT / ENC / log files',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'DLT, ENC, and logs', extensions: ['dlt', 'enc', 'log', 'bin', 'txt'] },
      { name: 'All files', extensions: ['*'] }
    ]
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('logs:parse', async (_event, filePaths) => {
  stopParseWorker();
  const files = (filePaths || []).filter((filePath) => {
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch (_error) {
      return false;
    }
  });
  if (!files.length) {
    return { ok: false, error: 'No readable file selected.' };
  }

  let prepared;
  try {
    prepared = await prepareFilesForParsing(files);
  } catch (error) {
    return { ok: false, error: error.message || 'Could not prepare selected files.' };
  }

  if (!prepared.ok) {
    return prepared;
  }

  parseWorker = new Worker(path.join(APP_ROOT, 'src', 'workers', 'parseWorker.js'));
  parseWorker.on('message', (payload) => sendParseEvent(payload));
  parseWorker.on('error', (error) => sendParseEvent({ type: 'error', error: error.message }));
  parseWorker.on('exit', (code) => {
    if (code !== 0) {
      sendParseEvent({ type: 'error', error: `Parse worker exited with code ${code}.` });
    }
    parseWorker = null;
  });
  parseWorker.postMessage({ type: 'start', files: prepared.files });
  return { ok: true };
});

ipcMain.handle('logs:cancel-parse', async () => {
  stopParseWorker();
  return { ok: true };
});

ipcMain.handle('export:save', async (_event, payload) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: payload.title || 'Export logs',
    defaultPath: payload.defaultPath || 'dlt-export.txt',
    filters: payload.filters || [{ name: 'All files', extensions: ['*'] }]
  });
  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }
  await writeExportFile(result.filePath, payload.content || '');
  return { ok: true, filePath: result.filePath };
});

ipcMain.handle('app:read-readme', async () => {
  const candidates = ['README.md', 'Readme.md', 'readme.md'].map((fileName) => path.join(APP_ROOT, fileName));
  const readmePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!readmePath) {
    return { ok: false, error: 'README.md was not found in the project folder.' };
  }
  return {
    ok: true,
    fileName: path.basename(readmePath),
    content: fs.readFileSync(readmePath, 'utf8')
  };
});

ipcMain.handle('app:read-user-guide', async () => {
  const candidates = [
    'USER_GUIDE_EN.md',
    'USER_GUIDE.md',
    'UserGuide.md'
  ].map((fileName) => path.join(APP_ROOT, fileName));
  const guidePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!guidePath) {
    return { ok: false, error: 'USER_GUIDE_EN.md was not found in the project folder.' };
  }
  return {
    ok: true,
    fileName: path.basename(guidePath),
    content: fs.readFileSync(guidePath, 'utf8')
  };
});

ipcMain.handle('clipboard:write', async (_event, text) => {
  clipboard.writeText(String(text || ''));
  return { ok: true };
});

ipcMain.handle('chatgpt:prepare', async (_event, request) => {
  if (handoffBusy) throw new Error('A log export is already running.');
  if (!Array.isArray(request?.messages) || !request.messages.length) {
    throw new Error('No log rows selected.');
  }
  handoffBusy = true;
  try {
    const text = await prepareLogText(request.messages);
    const result = await handoffLogText(text, { openBrowser: request.openBrowser === true, url: request.url }, { clipboard, shell });
    return result;
  } finally {
    handoffBusy = false;
  }
});


/** Unpacked builds have no updater metadata; keep their updater inactive. */
function canCheckUpdates() {
  return app.isPackaged && fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'));
}
