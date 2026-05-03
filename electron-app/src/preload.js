const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    getUserDataPath: () => ipcRenderer.invoke("get-user-data-path"),
    ensureDirectory: (dirPath) => ipcRenderer.invoke("ensure-directory", dirPath),
    directoryExists: (dirPath) => ipcRenderer.invoke("directory-exists", dirPath),
    initTDLibDirectories: () => ipcRenderer.invoke("init-tdlib-directories"),
});
