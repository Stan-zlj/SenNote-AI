
const { app, BrowserWindow, clipboard, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let lastClipboardText = "";
let isQuitting = false;

// 确保单实例
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

  // 响应窗口操作
  ipcMain.on('window-min', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.hide(); // 隐藏到托盘
  });

  function getAppIcon() {
    // 这是一个标准的 16x16 紫色圆形 PNG，包含透明通道，兼容性更高
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
      }
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
  }

  app.whenReady().then(() => {
    createWindow();
    createTray();
  });
}
