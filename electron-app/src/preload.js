const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('messenger', {
    getDefaults: ()                                    => ipcRenderer.invoke('messenger:getDefaults'),
    getKeys:     (userId)                              => ipcRenderer.invoke('messenger:getKeys', userId),
    encrypt:     (peerUserId, plaintext, myUserId)     => ipcRenderer.invoke('messenger:encrypt', peerUserId, plaintext, myUserId),
    decrypt:     (fromUserId, payloadB64, myUserId)    => ipcRenderer.invoke('messenger:decrypt', fromUserId, payloadB64, myUserId),
    publishKey:   (userId)           => ipcRenderer.invoke('messenger:publishKey', userId),
    generateMask: (text, history)   => ipcRenderer.invoke('messenger:generateMask', text, history),
})

contextBridge.exposeInMainWorld('tg', {
    start:          ()         => ipcRenderer.invoke('tg:start'),
    startQrLogin:   ()         => ipcRenderer.invoke('tg:startQrLogin'),
    getMe:          ()         => ipcRenderer.invoke('tg:getMe'),
    getFullMe:      ()         => ipcRenderer.invoke('tg:getFullMe'),
    updateProfile:  (data)     => ipcRenderer.invoke('tg:updateProfile', data),
    updateUsername: (username) => ipcRenderer.invoke('tg:updateUsername', username),
    sendPhone:   (phone)          => ipcRenderer.invoke('tg:sendPhone', phone),
    sendCode:    (code)           => ipcRenderer.invoke('tg:sendCode', code),
    sendPassword:(password)       => ipcRenderer.invoke('tg:sendPassword', password),
    logout:      ()               => ipcRenderer.invoke('tg:logout'),
    getDialogs:  ()               => ipcRenderer.invoke('tg:getDialogs'),
    getMessages: (chatId, limit)  => ipcRenderer.invoke('tg:getMessages', chatId, limit),
    markAsRead:  (chatId)         => ipcRenderer.invoke('tg:markAsRead', chatId),
    sendMessage: (chatId, text)   => ipcRenderer.invoke('tg:sendMessage', chatId, text),
    getAvatar:     (id)            => ipcRenderer.invoke('tg:getAvatar', id),
    getUserStatus: (chatId)        => ipcRenderer.invoke('tg:getUserStatus', chatId),
    getUserInfo:   (id)            => ipcRenderer.invoke('tg:getUserInfo', id),
    // Subscribe to push updates from main process (new messages, auth state changes)
    onUpdate: (cb) => {
        const handler = (_event, data) => cb(data)
        ipcRenderer.on('tg:update', handler)
        return () => ipcRenderer.removeListener('tg:update', handler)
    },
})
