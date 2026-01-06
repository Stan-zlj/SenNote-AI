
const { app, BrowserWindow, clipboard, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let lastClipboardText = "";
let isQuitting = false;

// 单实例锁定
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  setTimeout(() => process.exit(0), 100);
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  ipcMain.on('window-min', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.hide();
  });

  function getAppIcon() {
    // 优先尝试从物理路径读取 favicon.ico
    const possiblePaths = [
      path.join(__dirname, 'dist/favicon.ico'),
      path.join(__dirname, 'favicon.ico'),
      path.join(app.getAppPath(), 'favicon.ico'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        try {
          return nativeImage.createFromPath(p).resize({ width: 16, height: 16 });
        } catch (e) { console.error("NativeImage error", e); }
      }
    }

    // 终极兜底：亮紫色圆点图标（Base64 PNG 24x24）
    const b64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAAsTAAALEwEAmpwYAAABJUlEQVR4nO2VMUvDQBiGny8S8Aei4CB0EByUuLiIq9u5uou7O6iL4ODmX9TByUEcBR10ExfBxUFB7B9IwaU6XBy0pQ2hLReXGnoPguRL33fPvXfXf8Y6Y8U0V0mSBMAz8AJ8A08O6h7oAHeE/RloARvDAb7+Y6oBvAFtM4Fv5VvOAm2g7T97B7qD983k6g/mCmgDT9A0E3hSvhVZoAm0HPhRviVZIM8E9O95E0mYmB6CjL+4TCRH+jA9S070ZnoAnOnddG4vC1N6O88XFqasE739qXvAnOn9M75XGKZsq853FqasK99L0xN9mX5KjvRhuh/9N9F7O7m+mZgeAnOG90/6HnKm9O44V6Yn+it9p9Y6v2NlZq7yH9YpM6Y5UvIHeS4mB4A34Ad49g50B/8Ab06R6pQ+AeoAAAAASUVORK5CYII=';
    return nativeImage.createFromDataURL(b64);
  }

  function createTray() {
    if (tray) return;
    try {
      const icon = getAppIcon();
      tray = new Tray(icon);
      
      const contextMenu = Menu.buildFromTemplate([
        { label: 'ZenNote AI 便签', enabled: false },
        { type: 'separator' },
        { label: '显示窗口', click: () => { if (mainWindow) mainWindow.show(); } },
        { 
          label: '开机自启', 
          type: 'checkbox', 
          checked: app.getLoginItemSettings().openAtLogin,
          click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked })
        },
        { type: 'separator' },
        { label: '彻底退出', click: () => { isQuitting = true; app.quit(); } }
      ]);

      tray.setToolTip('ZenNote AI - 灵感随行');
      tray.setContextMenu(contextMenu);
      
      tray.on('click', () => {
        if (!mainWindow) return;
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      });
    } catch (e) {
      console.error("Tray failed", e);
    }
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
        contextIsolation: false,
        backgroundThrottling: false 
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

  app.on('before-quit', () => {
    isQuitting = true;
    if (tray) tray.destroy();
  });
}
