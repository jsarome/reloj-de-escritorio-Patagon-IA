const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow () {
  const win = new BrowserWindow({
    width: 400,
    height: 600,
    minWidth: 400,
    maxWidth: 400,
    minHeight: 180,
    resizable: true,
    frame: false,
    transparent: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Usamos contextIsolation: true para mayor seguridad.
      // Permite usar contextBridge en preload.js de forma aislada.
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  win.loadFile('index.html');
}

// Todos los handlers IPC registrados una sola vez aquí
// ── Siempre al frente ──
ipcMain.handle('toggle-pin', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return false;

  const isPinned = win.isAlwaysOnTop();
  if (!isPinned) {
    win.setAlwaysOnTop(true, 'screen-saver');
  } else {
    win.setAlwaysOnTop(false);
  }
  return !isPinned;
});

// ── Obtener tamaño actual de ventana ──
ipcMain.handle('get-window-size', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return [400, 600];
  return win.getSize();
});

// ── Redimensionar ventana ──
ipcMain.on('resize-window', (event, width, height) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    const minH = 180;
    const bounds = win.getBounds();
    const newH = Math.max(minH, Math.floor(height));
    win.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width, // Fijo, ignoramos el parámetro width
      height: newH
    });
  }
});

// ── Cerrar ventana ──
ipcMain.on('close-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
