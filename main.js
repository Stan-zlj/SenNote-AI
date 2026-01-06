
const { app, BrowserWindow, clipboard, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let lastClipboardText = "";
let isQuitting = false;

// 确保单实例运行
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  // 响应最小化
  ipcMain.on('window-min', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  // 响应关闭（隐藏到托盘）
  ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.hide();
  });

  // 增强版托盘图标获取
  function getAppIcon() {
    // 1. 尝试从构建目录读取
    const iconPath = path.join(__dirname, 'dist/favicon.ico');
    if (fs.existsSync(iconPath)) {
      return nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    }

    // 2. 兜底：一个更标准的紫色圆形图标 Base64 (16x16 PNG)
    const b64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAWklEQVQ4y2P8//8/AyWAgYGBgeG/4X8S9TMwtv8hRj/D/98M6Orv/ydS8z+S9P9mSNDP+D8p+hmZ6Wf8n6SAlZSRmf7/SArYyYp+RuYv7P9J0s/IzD9E6WdkZpDxPwMAp687IeB9C9UAAAAASUVORK5CYII=';
    return nativeImage.createFromDataURL(b64);
  }

  function createTray() {
    if (tray) return;
    try {
      const icon = getAppIcon();
      tray = new Tray(icon);
      
      const contextMenu = Menu.buildFromTemplate([
        { label: 'ZenNote AI', enabled: false },
        { type: 'separator' },
        { label: '打开窗口', click: () => { if (mainWindow) mainWindow.show(); } },
        { 
          label: '开机启动', 
          type: 'checkbox', 
          checked: app.getLoginItemSettings().openAtLogin,
          click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked })
        },
        { type: 'separator' },
        { label: '彻底退出', click: () => { isQuitting = true; app.quit(); } }
      ]);

      tray.setToolTip('ZenNote AI - 你的学习伴侣');
      tray.setContextMenu(contextMenu);
      
      tray.on('double-click', () => {
        if (mainWindow) mainWindow.show();
      });
    } catch (e) {
      console.error("Tray Creation Failed:", e);
    }
  }

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 420,
      height: 650,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      resizable: true,
      skipTaskbar: false,
      backgroundColor: '#00000000',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        backgroundThrottling: false,
        webSecurity: false
      }
    });

    if (!app.isPackaged) {
      mainWindow.loadURL('http://localhost:5173');
    } else {
      mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
    }

    mainWindow.on('close', (e) => {
      if (!isQuitting) {
        e.preventDefault();
        mainWindow.hide();
      }
    });

    // 剪贴板轮询
    setInterval(() => {
      try {
        const text = clipboard.readText().trim();
        if (text && text !== lastClipboardText) {
          lastClipboardText = text;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('clipboard-sync', text);
          }
        }
      } catch (e) {}
    }, 1000);
  }

  app.whenReady().then(() => {
    createWindow();
    createTray();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });
}
