
const { app, BrowserWindow, clipboard, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let lastClipboardText = "";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 700,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000', // 完全透明，由网页控制底色
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    const loadURL = () => {
      mainWindow.loadURL('http://localhost:5173').catch(() => {
        setTimeout(loadURL, 1500);
      });
    };
    loadURL();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // 设置开机自启动
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: false
  });

  ipcMain.on('window-min', () => mainWindow.minimize());
  ipcMain.on('window-close', () => mainWindow.close());

  setInterval(() => {
    try {
      const text = clipboard.readText().trim();
      if (text && text !== lastClipboardText) {
        lastClipboardText = text;
        if (mainWindow) {
          mainWindow.webContents.send('clipboard-sync', text);
        }
      }
    } catch (e) {}
  }, 1000);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
