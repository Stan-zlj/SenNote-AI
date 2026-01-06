
const { app, BrowserWindow, clipboard, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let lastClipboardText = "";
let isQuitting = false;

// --- 单实例锁定逻辑 ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  // 窗口控制 IPC
  ipcMain.on('window-min', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.hide();
  });

  function createTray() {
    if (tray) return;

    // 尝试寻找图标路径
    const possibleIconPaths = [
      path.join(__dirname, 'dist/favicon.ico'),
      path.join(__dirname, 'public/favicon.ico'),
      path.join(__dirname, 'favicon.ico'),
    ];

    let iconPath = possibleIconPaths.find(p => fs.existsSync(p));
    let icon;

    if (iconPath) {
      icon = nativeImage.createFromPath(iconPath);
    } else {
      // 兜底方案：如果找不到文件，创建一个简单的 16x16 红色方块作为图标，确保托盘可用
      // 实际开发中请确保根目录有 favicon.ico
      const buffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH5QMWEhInJ9y9VAAAACBJREFUOMtjYmJiYmJkZGRkZGBgYGBgYGBgYGBgYGBgYAAyAAn7m9FwAAAAAElFTkSuQmCC',
        'base64'
      );
      icon = nativeImage.createFromBuffer(buffer);
    }

    tray = new Tray(icon);
    
    const contextMenu = Menu.buildFromTemplate([
      { 
        label: '显示 ZenNote AI', 
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        } 
      },
      { 
        label: '开机自启', 
        type: 'checkbox', 
        checked: app.getLoginItemSettings().openAtLogin, 
        click: (item) => {
          app.setLoginItemSettings({ openAtLogin: item.checked });
        }
      },
      { type: 'separator' },
      { 
        label: '退出程序', 
        click: () => {
          isQuitting = true;
          app.quit();
        } 
      }
    ]);

    tray.setToolTip('ZenNote AI - 点击切换显示');
    tray.setContextMenu(contextMenu);

    // 单击切换显示/隐藏
    tray.on('click', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
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

    const isDev = !app.isPackaged;
    if (isDev) {
      mainWindow.loadURL('http://localhost:5173');
    } else {
      mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
    }

    mainWindow.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault();
        mainWindow.hide();
      }
      return false;
    });

    // 剪贴板监听
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
