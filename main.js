
const { app, BrowserWindow, clipboard, ipcMain, Tray, Menu, nativeImage, session } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let lastClipboardText = "";
let isQuitting = false;

// 解决部分系统硬件灯不亮的底层配置
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

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

  ipcMain.on('window-min', () => { if (mainWindow) mainWindow.minimize(); });
  ipcMain.on('window-close', () => { if (mainWindow) mainWindow.hide(); });

  function getAppIcon() {
    const b64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAACXBIWXMAAAsTAAALEwEAmpwYAAABNmlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDAgNzkuMTYwNDUxLCAyMDE3LzA1LzA2LTAxOjA4OjIxICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIi8+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InciPz45uOfBAAAAZEVYSWZNTQAqAAAACAAFARIAAwAAAAEAAQAAARoABQAAAAEAAABKARsABQAAAAEAAABSASgAAwAAAAEAAgAAh2kABwAAAQAAAAByA6QAAwAAAAEAAQAAoAAABwAAAAQwMjEw6hwF6QAAAD9JREFUOBFjYBgFoyEwGgKjITAgIQAAIf8AAbOfmY0AAAAASUVORK5CYII=';
    return nativeImage.createFromDataURL(b64);
  }

  function createTray() {
    if (tray) return;
    const icon = getAppIcon();
    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'ZenNote AI', enabled: false },
      { type: 'separator' },
      { label: '显示主界面', click: () => mainWindow.show() },
      { label: '彻底退出', click: () => { isQuitting = true; app.quit(); } }
    ]);
    tray.setToolTip('ZenNote AI');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => mainWindow.show());
  }

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 420,
      height: 650,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      backgroundColor: '#00000000',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false,
        backgroundThrottling: false,
      }
    });

    // 强化权限处理：必须对 defaultSession 生效
    const ses = session.defaultSession;
    ses.setPermissionRequestHandler((webContents, permission, callback) => {
      callback(true); // 自动允许所有权限请求（摄像头、麦克风等）
    });

    ses.setPermissionCheckHandler((webContents, permission) => {
      return true; // 自动通过权限检查
    });

    if (app.isPackaged) {
      mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
    } else {
      mainWindow.loadURL('http://localhost:5173');
    }

    mainWindow.on('close', (e) => {
      if (!isQuitting) {
        e.preventDefault();
        mainWindow.hide();
      }
    });

    // 剪贴板监听
    setInterval(() => {
      const text = clipboard.readText().trim();
      if (text && text !== lastClipboardText) {
        lastClipboardText = text;
        if (mainWindow) mainWindow.webContents.send('clipboard-sync', text);
      }
    }, 1000);
  }

  app.whenReady().then(() => {
    createWindow();
    createTray();
  });
}
