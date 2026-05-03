import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs";
import started from "electron-squirrel-startup";

if (started) app.quit();

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ipcMain.handle("get-user-data-path", () => app.getPath("userData"));

ipcMain.handle("ensure-directory", (_, dirPath) => {
    try {
        ensureDir(dirPath);
        return { success: true, path: dirPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle("directory-exists", (_, dirPath) => fs.existsSync(dirPath));

ipcMain.handle("init-tdlib-directories", () => {
    const base = path.join(app.getPath("userData"), "tdlib");
    const dirs = {
        databaseDirectory: path.join(base, "database"),
        filesDirectory: path.join(base, "files"),
    };
    Object.values(dirs).forEach(ensureDir);
    return dirs;
});

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1200,
        height: 1000,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
        win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }

    win.webContents.openDevTools();
};

app.whenReady().then(() => {
    createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
