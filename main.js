const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 500,
        minWidth: 400,
        minHeight: 250,
        frame: false,
        transparent: true,
        resizable: true,
        useContentSize: true, // Add this to better respect dimensions
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // Enforce Aspect Ratio
    mainWindow.setAspectRatio(800 / 500);

    mainWindow.loadFile('index.html');

    // 开发模式下打开 DevTools
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC 事件处理
ipcMain.on('window-minimize', () => {
    mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.on('window-close', () => {
    mainWindow.close();
});

ipcMain.on('set-opacity', (event, opacity) => {
    mainWindow.setOpacity(opacity);
});

ipcMain.on('set-always-on-top', (event, flag) => {
    mainWindow.setAlwaysOnTop(flag);
});
