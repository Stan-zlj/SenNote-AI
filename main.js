
const { app, BrowserWindow, clipboard, ipcMain, Tray, Menu, nativeImage, screen } = require('electron');
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

// 优化性能与权限
app.commandLine.appendSwitch('use-fake-ui-for-media-stream'); 
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-gpu-sandbox'); 

// 开机自启动管理
function setAutoStart(enable) {
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: enable,
      path: app.getPath('exe')
    });
  }
}

// 托盘初始化
function createTray() {
  // 使用一个简单的点作为占位图标，实际开发建议放置 16x16 的 png
  const icon = nativeImage.createEmpty(); 
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'ZenNote AI', enabled: false },
    { type: 'separator' },
    { label: '显示窗口', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { label: '开机自启', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (item) => setAutoStart(item.checked) },
    { type: 'separator' },
    { label: '彻底退出', click: () => { 
        isQuitting = true; 
        app.quit(); 
      } 
    }
  ]);

  tray.setToolTip('ZenNote AI - 并行便签');
  tray.setContextMenu(contextMenu);

  // 点击托盘图标切换显示/隐藏
  tray.on('click', () => {
    if (!mainWindow) return;
    mainWindow.isVisible() ? mainWindow.hide() : (mainWindow.show(), mainWindow.focus());
  });
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

  // 保存笔记
  ipcMain.on('save-note', (event, { note, topic = '未分类' }) => {
    const topicPath = path.join(NOTES_DIR, topic);
    if (!fs.existsSync(topicPath)) fs.mkdirSync(topicPath, { recursive: true });
    const filePath = path.join(topicPath, `note_${note.id}.txt`);
    const fileContent = `ID: ${note.id}\nTOPIC: ${topic}\nTAGS: ${note.tags.join(', ')}\nCREATED_AT: ${note.createdAt}\n--------------------------------\n${note.content}`;
    fs.writeFile(filePath, fileContent, 'utf8', (err) => {
      if (err) console.error("[Disk Error] Save failed:", err);
    });
  });

  // 读取数据
  ipcMain.handle('get-all-data', async () => {
    try {
      if (!fs.existsSync(NOTES_DIR)) return { topics: ['未分类'], notes: [] };
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
      return { topics: topics.length ? topics : ['未分类'], notes: allNotes };
    } catch (e) {
      return { topics: ['未分类'], notes: [] };
    }
  });

  ipcMain.on('delete-note', (event, { noteId, topic }) => {
    const filePath = path.join(NOTES_DIR, topic, `note_${noteId}.txt`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  ipcMain.on('delete-topic', (event, topic) => {
    const topicPath = path.join(NOTES_DIR, topic);
    if (fs.existsSync(topicPath)) fs.rmSync(topicPath, { recursive: true, force: true });
  });

  ipcMain.on('window-min', () => mainWindow?.minimize());
  ipcMain.on('window-close', () => mainWindow?.hide()); // 界面点击关闭仅隐藏

  function createWindow() {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    mainWindow = new BrowserWindow({
      width: 420, height: 650,
      x: screenWidth - 440, y: screenHeight - 670,
      frame: false, 
      alwaysOnTop: true, 
      transparent: true, 
      resizable: false,
      skipTaskbar: false, // 托盘模式下通常不跳过任务栏，或根据喜好设置
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

    // 关键：拦截关闭事件实现后台运行
    mainWindow.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault();
        mainWindow.hide();
      }
    });

    // 持续监听剪贴板
    setInterval(() => {
      const text = clipboard.readText().trim();
      if (text && text !== lastClipboardText) {
        lastClipboardText = text;
        mainWindow?.webContents.send('clipboard-sync', text);
      }
    }, 1000);
  }

  app.whenReady().then(() => {
    createWindow();
    createTray();
    setAutoStart(true); // 默认开启
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && isQuitting) {
      app.quit();
    }
  });
}
