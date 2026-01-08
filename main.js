
const { app, BrowserWindow, clipboard, ipcMain, Tray, Menu, nativeImage, session, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let lastClipboardText = "";
let isQuitting = false;

// 笔记存储根路径
const NOTES_DIR = path.join(app.getPath('userData'), 'notes');

// 确保根目录存在
if (!fs.existsSync(NOTES_DIR)) {
  fs.mkdirSync(NOTES_DIR, { recursive: true });
}

app.commandLine.appendSwitch('use-fake-ui-for-media-stream'); 
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-gpu-sandbox'); 

function setAutoStart() {
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: true, path: app.getPath('exe') });
  }
}

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

  // 保存笔记：支持主题文件夹
  ipcMain.on('save-note', (event, { note, topic = '未分类' }) => {
    const topicPath = path.join(NOTES_DIR, topic);
    if (!fs.existsSync(topicPath)) fs.mkdirSync(topicPath, { recursive: true });

    const filePath = path.join(topicPath, `note_${note.id}.txt`);
    const fileContent = `ID: ${note.id}\nTOPIC: ${topic}\nTAGS: ${note.tags.join(', ')}\nCREATED_AT: ${note.createdAt}\n--------------------------------\n${note.content}`;
    fs.writeFile(filePath, fileContent, 'utf8', (err) => {
      if (err) console.error("[Disk Error] Save failed:", err);
    });
  });

  // 读取所有主题及笔记
  ipcMain.handle('get-all-data', async () => {
    try {
      const topics = fs.readdirSync(NOTES_DIR).filter(f => fs.statSync(path.join(NOTES_DIR, f)).isDirectory());
      const allNotes = [];
      
      topics.forEach(topic => {
        const topicPath = path.join(NOTES_DIR, topic);
        const files = fs.readdirSync(topicPath).filter(f => f.endsWith('.txt'));
        files.forEach(file => {
          try {
            const raw = fs.readFileSync(path.join(topicPath, file), 'utf8');
            const [meta, ...contentParts] = raw.split('--------------------------------\n');
            const metaLines = meta.split('\n');
            allNotes.push({
              id: metaLines[0].replace('ID: ', ''),
              topic: metaLines[1].replace('TOPIC: ', ''),
              tags: metaLines[2].replace('TAGS: ', '').split(', ').filter(t => t),
              createdAt: parseInt(metaLines[3].replace('CREATED_AT: ', '')),
              content: contentParts.join('--------------------------------\n').trim()
            });
          } catch (e) {}
        });
      });
      return { topics, notes: allNotes };
    } catch (e) {
      return { topics: ['未分类'], notes: [] };
    }
  });

  // 删除笔记：物理路径定位
  ipcMain.on('delete-note', (event, { noteId, topic }) => {
    const filePath = path.join(NOTES_DIR, topic, `note_${noteId}.txt`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  // 删除整个主题
  ipcMain.on('delete-topic', (event, topic) => {
    const topicPath = path.join(NOTES_DIR, topic);
    if (fs.existsSync(topicPath)) fs.rmSync(topicPath, { recursive: true, force: true });
  });

  ipcMain.on('window-min', () => mainWindow?.minimize());
  ipcMain.on('window-close', () => mainWindow?.hide());

  function createWindow() {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    mainWindow = new BrowserWindow({
      width: 420, height: 650,
      x: screenWidth - 440, y: screenHeight - 670,
      frame: false, alwaysOnTop: true, transparent: true, resizable: false,
      webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false }
    });
    app.isPackaged ? mainWindow.loadFile(path.join(__dirname, 'dist/index.html')) : mainWindow.loadURL('http://localhost:5173');
    setInterval(() => {
      const text = clipboard.readText().trim();
      if (text && text !== lastClipboardText) {
        lastClipboardText = text;
        mainWindow?.webContents.send('clipboard-sync', text);
      }
    }, 1000);
  }

  app.whenReady().then(createWindow);
}
