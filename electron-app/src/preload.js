const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('messenger', {
    getDefaults: ()                              => ipcRenderer.invoke('messenger:getDefaults'),
    getKeys:     (userId)                        => ipcRenderer.invoke('messenger:getKeys', userId),
    decrypt:     (fromUserId, payloadB64, myId)  => ipcRenderer.invoke('messenger:decrypt', fromUserId, payloadB64, myId),
})
