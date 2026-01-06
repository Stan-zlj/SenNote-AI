
const { app, BrowserWindow, clipboard, ipcMain, Tray, Menu } = require('electron');
const path = require('path');

let mainWindow;
let lastClipboardText = "";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 700,
    frame: false, // 无边框
    alwaysOnTop: true, // 置顶
    transparent: true, // 透明支持
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 加载本地入口
  mainWindow.loadFile('index.html');

  // 开机自启设置
  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath('exe')
  });

  // 剪贴板监听器 (每秒检查一次)
  setInterval(() => {
    const text = clipboard.readText();
    if (text && text !== lastClipboardText) {
      lastClipboardText = text;
      // 发送给渲染进程（前端）
      if (mainWindow) {
        mainWindow.webContents.send('clipboard-sync', text);
      }
    }
  }, 1000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
