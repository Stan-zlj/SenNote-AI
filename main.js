
const { app, BrowserWindow, clipboard, ipcMain, Tray, Menu } = require('electron');
const path = require('path');

let mainWindow;
let tray = null;
let lastClipboardText = "";
let isQuitting = false;

function createTray() {
  // 使用一个简单的图标，如果没有本地图标，可以使用 base64
  tray = new Tray(path.join(__dirname, 'dist/assets/favicon.ico')); 
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示窗口', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: '退出 ZenNote', click: () => {
        isQuitting = true;
        app.quit();
      } 
    }
  ]);
  tray.setToolTip('ZenNote AI 正在运行');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow.show());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 700,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // 点击关闭时隐藏而不是退出
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });

  // 设置开机自启动
  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath('exe')
  });

  ipcMain.on('window-min', () => mainWindow.minimize());
  ipcMain.on('window-close', () => mainWindow.hide()); // 修改为隐藏

  // 剪贴板监听逻辑
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

app.whenReady().then(() => {
  createWindow();
  // 注意：托盘图标在打包后才会显示，或者你需要准备一个 favicon.ico 放在 assets 目录
  try { createTray(); } catch(e) { console.log('Tray error:', e); }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
