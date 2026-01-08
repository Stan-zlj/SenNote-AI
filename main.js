
const { app, BrowserWindow, clipboard, ipcMain, Tray, Menu, nativeImage, session, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let lastClipboardText = "";
let isQuitting = false;

// 笔记存储路径：用户数据目录下的 notes 文件夹
const NOTES_DIR = path.join(app.getPath('userData'), 'notes');

// 确保存储目录物理存在
if (!fs.existsSync(NOTES_DIR)) {
  fs.mkdirSync(NOTES_DIR, { recursive: true });
}

// 硬件加速与媒体权限优化
app.commandLine.appendSwitch('use-fake-ui-for-media-stream'); 
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-gpu-sandbox'); 

// 开机自启动配置
function setAutoStart() {
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath('exe')
    });
  }
}

// 单例模式确保只有一个窗口
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

  // 【核心功能】IPC 处理器：保存笔记到物理 TXT 文件
  ipcMain.on('save-note', (event, note) => {
    const filePath = path.join(NOTES_DIR, `note_${note.id}.txt`);
    const fileContent = `ID: ${note.id}\nTAGS: ${note.tags.join(', ')}\nCREATED_AT: ${note.createdAt}\n--------------------------------\n${note.content}`;
    fs.writeFile(filePath, fileContent, 'utf8', (err) => {
      if (err) console.error("[Disk Error] Failed to save TXT:", err);
    });
  });

  // 【核心功能】IPC 处理器：从磁盘读取所有 TXT 笔记
  ipcMain.handle('get-notes', async () => {
    try {
      if (!fs.existsSync(NOTES_DIR)) return [];
      const files = fs.readdirSync(NOTES_DIR);
      const notes = files
        .filter(f => f.endsWith('.txt'))
        .map(file => {
          try {
            const raw = fs.readFileSync(path.join(NOTES_DIR, file), 'utf8');
            const [meta, ...contentParts] = raw.split('--------------------------------\n');
            const metaLines = meta.split('\n');
            
            return {
              id: metaLines[0].replace('ID: ', ''),
              tags: metaLines[1].replace('TAGS: ', '').split(', ').filter(t => t),
              createdAt: parseInt(metaLines[2].replace('CREATED_AT: ', '')),
              content: contentParts.join('--------------------------------\n').trim()
            };
          } catch (e) {
            console.error(`[Disk Error] Corrupted file: ${file}`);
            return null;
          }
        })
        .filter(n => n !== null)
        .sort((a, b) => b.createdAt - a.createdAt);
      return notes;
    } catch (e) {
      console.error("[Disk Error] Load notes failed:", e);
      return [];
    }
  });

  // 【核心功能】IPC 处理器：物理删除笔记文件
  ipcMain.on('delete-note', (event, noteId) => {
    const filePath = path.join(NOTES_DIR, `note_${noteId}.txt`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  ipcMain.on('window-min', () => { if (mainWindow) mainWindow.minimize(); });
  ipcMain.on('window-close', () => { if (mainWindow) mainWindow.hide(); });

  function createTray() {
    if (tray) return; 
    const icon = nativeImage.createEmpty(); // 实际应使用资源图标
    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'ZenNote AI', enabled: false },
      { type: 'separator' },
      { label: '显示窗口', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
      { label: '退出', click: () => { isQuitting = true; app.quit(); } }
    ]);
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (!mainWindow) return;
      mainWindow.isVisible() ? mainWindow.hide() : (mainWindow.show(), mainWindow.focus());
    });
  }

  function createWindow() {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    const winWidth = 420;
    const winHeight = 650;

    mainWindow = new BrowserWindow({
      width: winWidth,
      height: winHeight,
      x: screenWidth - winWidth - 20, 
      y: screenHeight - winHeight - 20, 
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      resizable: false,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false
      }
    });

    if (app.isPackaged) {
      mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
    } else {
      mainWindow.loadURL('http://localhost:5173');
    }

    mainWindow.once('ready-to-show', () => mainWindow.show());

    mainWindow.on('close', (e) => {
      if (!isQuitting) {
        e.preventDefault();
        mainWindow.hide();
      }
    });

    // 剪贴板轮询监听
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
}
