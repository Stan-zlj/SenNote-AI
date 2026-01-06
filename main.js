
const { app, BrowserWindow, clipboard, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let lastClipboardText = "";
let isQuitting = false;

// --- 核心修复：单实例锁定，防止托盘图标重复 ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // 如果已经有一个实例在运行，直接退出，不创建任何窗口或托盘
  app.quit();
  setTimeout(() => {
    process.exit(0);
  }, 100);
} else {
  // 当用户尝试启动第二个实例时，激活主实例
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true);
    }
  });

  // 窗口控制 IPC
  ipcMain.on('window-min', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.hide(); // 点击关闭按钮仅隐藏到托盘
  });

  // 获取图标的辅助函数
  function getAppIcon() {
    const possiblePaths = [
      path.join(__dirname, 'dist/favicon.ico'),
      path.join(__dirname, 'public/favicon.ico'),
      path.join(__dirname, 'favicon.ico'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return nativeImage.createFromPath(p).resize({ width: 16, height: 16 });
      }
    }

    // 兜底方案：如果找不到 ico 文件，使用硬编码的蓝色圆点图标（Base64 PNG）
    // 这样能确保托盘永远有图标，且永远可以点击
    const base64Icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAACXBIWXMAAAsTAAALEwEAmpwYAAABWWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDAgNzkuMTYwNDUxLCAyMDE3LzA1LzA2LTAxOjA4OjIxICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly92cy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDozRDUyMUE5QTM0RkUxMUU4OEFFOEU3RkVDMEQxMTZDQSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDozRDUyMUE5OTM0RkUxMUU4OEFFOEU3RkVDMEQxMTZDQCIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgKFdpbmRvd3MpIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6M0Q1MjFBOUIzNEZFMTFFODhBRThFN0ZFQzBEMTE2Q0EiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6M0Q1MjFBOUMzNEZFMTFFODhBRThFN0ZFQzBEMTE2Q0EiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InciPz4vOf7uAAAAb0lEQVQ4y2P4//8/AyUYIxETByMDY6Snp7m5Of9/YmIi9fX1f6iurv5DdXX1f9XU1P7X0NBgoKKiYqSnp8fAQIwaYmJi/v/U1NT8p6am9p8Y9f9JSUn/I7I5SUnJ/8S6IDEx8T8+O0lOTv6Paj8RAABO8T6h26nSFAAAAABJRU5ErkJggg==';
    return nativeImage.createFromDataURL(base64Icon);
  }

  function createTray() {
    if (tray) return;

    const icon = getAppIcon();
    tray = new Tray(icon);
    
    const contextMenu = Menu.buildFromTemplate([
      { label: 'ZenNote AI 便签', enabled: false },
      { type: 'separator' },
      { 
        label: '显示便签主窗口', 
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        } 
      },
      { 
        label: '开机自动启动', 
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

    tray.setToolTip('ZenNote AI - 随时记录你的灵感');
    tray.setContextMenu(contextMenu);

    // 在 Windows 下单击图标直接显示/隐藏
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

    // 剪贴板自动同步监听
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
  
  // 确保在应用退出前清理托盘图标
  app.on('before-quit', () => {
    isQuitting = true;
    if (tray) {
      tray.destroy();
    }
  });
}
