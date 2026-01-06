
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
    backgroundColor: '#1e293b', // 即使没加载出来，也给个深色底色，不黑屏
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    // 自动重试加载，直到 Vite 服务器启动
    const loadURL = () => {
      mainWindow.loadURL('http://localhost:5173').catch(() => {
        console.log("Vite 服务器未就绪，2秒后重试...");
        setTimeout(loadURL, 2000);
      });
    };
    loadURL();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // 窗口控制
  ipcMain.on('window-min', () => mainWindow.minimize());
  ipcMain.on('window-close', () => mainWindow.close());

  // 剪贴板自动同步
  setInterval(() => {
    try {
      const text = clipboard.readText();
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
