
const { app, BrowserWindow, clipboard, ipcMain, Tray, Menu, nativeImage, session, screen } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let lastClipboardText = "";
let isQuitting = false;

// Hardware and environment optimizations
app.commandLine.appendSwitch('use-fake-ui-for-media-stream'); 
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'PreloadMediaEngagementData,AutoplayIgnoreWebAudio');
app.commandLine.appendSwitch('enable-features', 'WebRtcHideLocalIpsWithMdns,VideoFullscreenOrientationLock');
app.commandLine.appendSwitch('disable-gpu-sandbox'); 

function setAutoStart() {
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath('exe')
    });
  }
}

// Ensure single instance of the application
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

  // IPC handlers for window controls from React
  ipcMain.on('window-min', () => { 
    if (mainWindow) mainWindow.minimize(); 
  });
  
  ipcMain.on('window-close', () => { 
    if (mainWindow) mainWindow.hide(); // Hide to tray instead of closing
  });

  /**
   * Generates a base64 placeholder icon for the tray if no local icon is found.
   * This ensures the tray doesn't appear empty or error out.
   */
  function getAppIcon() {
    // A simple blue/indigo square representing ZenNote AI
    const b64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAACXBIWXMAAAsTAAALEwEAmpwYAAABNmlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDAgNzkuMTYwNDUxLCAyMDE3LzA1LzA2LTAxOjA4OjIxICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIi8+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InciPz45uOfBAAAAZEVYSWZNTQAqAAAACAAFARIAAwAAAAEAAQAAARoABQAAAAEAAABKARsABQAAAAEAAABSASgAAwAAAAEAAgAAh2kABwAAAQAAAAByA6QAAwAAAAEAAQAAoAAABwAAAAQwMjEw6hwF6QAAAD9JREFUOBFjYBgFoyEwGgKjITAgIQAAIf8AAbOfmY0AAAAASUVORK5CYII=';
    return nativeImage.createFromDataURL(b64);
  }

  /**
   * Initializes the system tray icon with a context menu and interactivity.
   * Only one instance of the tray icon is created.
   */
  function createTray() {
    if (tray) return; 
    
    const icon = getAppIcon();
    tray = new Tray(icon);
    
    const contextMenu = Menu.buildFromTemplate([
      { label: 'ZenNote AI', enabled: false },
      { type: 'separator' },
      { 
        label: 'Show Window', 
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        } 
      },
      { 
        label: 'Quit', 
        click: () => { 
          isQuitting = true; 
          app.quit(); 
        } 
      }
    ]);
    
    tray.setToolTip('ZenNote AI - Study Companion');
    tray.setContextMenu(contextMenu);
    
    // Interactive: Toggle window visibility on tray click
    tray.on('click', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    
    // Ensure window is shown and focused on double click
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }

  function createWindow() {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    const winWidth = 420;
    const winHeight = 650;

    mainWindow = new BrowserWindow({
      width: winWidth,
      height: winHeight,
      // Default position: Bottom-right corner of the screen
      x: screenWidth - winWidth - 20, 
      y: screenHeight - winHeight - 20, 
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      resizable: false,
      show: false,
      backgroundColor: '#00000000',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false,
        backgroundThrottling: false,
        allowRunningInsecureContent: true,
      }
    });

    // Permission handling for camera, mic, and clipboard
    const ses = session.defaultSession;
    ses.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowed = ['media', 'audioCapture', 'videoCapture', 'clipboard-read'];
      callback(allowed.includes(permission));
    });

    ses.setPermissionCheckHandler(() => true);
    ses.setDevicePermissionHandler(() => true);

    if (app.isPackaged) {
      mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
    } else {
      mainWindow.loadURL('http://localhost:5173');
    }

    // Resolve white flash issues by showing window only when ready
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    // Prevent application from closing completely when window 'close' is called
    mainWindow.on('close', (e) => {
      if (!isQuitting) {
        e.preventDefault();
        mainWindow.hide();
      }
    });

    // Background process to sync clipboard content into the note state
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
    setAutoStart();
  });

  // Ensure clean up of the tray icon on quit
  app.on('will-quit', () => {
    if (tray) {
      tray.destroy();
      tray = null;
    }
  });

  // Quit when all windows are closed, except on macOS
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
