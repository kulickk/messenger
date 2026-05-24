const { app, BrowserWindow, ipcMain, session } = require('electron')

process.on('uncaughtException', (err) => {
    if (err.code === 'EPIPE') return
    console.error('Uncaught Exception:', err)
})

if (require('electron-squirrel-startup')) app.quit()

// Support multiple profiles: PROFILE=alice npm start
// Each profile gets its own userData dir → separate TG session, keys, settings.
const profile = process.env.PROFILE
if (profile) {
    const path = require('path')
    app.setPath('userData', path.join(app.getPath('appData'), `messenger-${profile}`))
}

const { getOrCreateKeyPair, ecdhDerive, aesEncrypt, aesDecrypt, fetchAndCachePubKey, publishPubKey } = require('./lib/nodeCrypto')
const tg = require('./lib/tgMain')

const isDev = process.env.NODE_ENV !== 'production'

const defaults = {
    keyServerUrl:   process.env.KEY_SERVER_URL   || 'http://localhost:8081',
    gatewayUrl:     process.env.GATEWAY_URL      || 'ws://localhost:8080',
    gatewayHttpUrl: process.env.GATEWAY_HTTP_URL || 'http://localhost:8080',
    cipherId:       process.env.CIPHER_ID        || 'harry_potter',
    tgApiId:           process.env.TG_API_ID           || '35472613',
    tgApiHash:         process.env.TG_API_HASH         || 'fb621a1ecae578f86090428e86d5dd53',
    maskGeneratorUrl:  process.env.MASK_GENERATOR_URL  || 'http://localhost:8082',
    cipherId:          process.env.CIPHER_ID           || 'war_and_peace',
}

// ── Encrypted messenger IPC ───────────────────────────────────────────────────

ipcMain.handle('messenger:getDefaults', () => defaults)

ipcMain.handle('messenger:getKeys', (_e, userId) => getOrCreateKeyPair(userId))

ipcMain.handle('messenger:encrypt', async (_e, peerUserId, plaintext, myUserId) => {
    const { privKeyB64 } = getOrCreateKeyPair(myUserId)
    const privRaw    = Buffer.from(privKeyB64, 'base64')
    const peerPubRaw = await fetchAndCachePubKey(peerUserId, defaults.keyServerUrl)
    const shared     = ecdhDerive(privRaw, peerPubRaw)
    return aesEncrypt(shared, plaintext).toString('base64')
})

ipcMain.handle('messenger:decrypt', async (_e, fromUserId, payloadB64, myUserId) => {
    const { privKeyB64 } = getOrCreateKeyPair(myUserId)
    const privRaw    = Buffer.from(privKeyB64, 'base64')
    const peerPubRaw = await fetchAndCachePubKey(fromUserId, defaults.keyServerUrl)
    const shared     = ecdhDerive(privRaw, peerPubRaw)
    return aesDecrypt(shared, Buffer.from(payloadB64, 'base64'))
})

ipcMain.handle('messenger:publishKey', async (_e, userId) => {
    await publishPubKey(userId, defaults.keyServerUrl)
})

ipcMain.handle('messenger:generateMask', async (_e, text, history) => {
    const res = await fetch(`${defaults.maskGeneratorUrl}/generate-mask`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text, cipher_id: defaults.cipherId, history: history || [] }),
    })
    if (!res.ok) throw new Error(`mask-generator ${res.status}`)
    const data = await res.json()
    return data.mask
})

// ── Telegram IPC ──────────────────────────────────────────────────────────────

// tg:start() → { status: 'ready' | 'needs_phone' }
ipcMain.handle('tg:start', async (e) => {
    try {
        return await tg.start(e.sender, defaults.tgApiId, defaults.tgApiHash)
    } catch (err) {
        return { status: 'error', error: err.message }
    }
})

// tg:startQrLogin() → запускает QR-поток, пушит qrCode/authState обновления
ipcMain.handle('tg:startQrLogin', (e) => {
    tg.startQrLogin(e.sender)   // fire-and-forget
    return { status: 'started' }
})

// tg:sendPhone(phone) → { status: 'needs_code' }
ipcMain.handle('tg:sendPhone', async (_e, phone) => {
    try {
        return await tg.sendPhone(phone)
    } catch (err) {
        return { status: 'error', error: err.message }
    }
})

// tg:sendCode(code) → { status: 'ready' | 'needs_password' }
ipcMain.handle('tg:sendCode', async (_e, code) => {
    try {
        return await tg.sendCode(code)
    } catch (err) {
        return { status: 'error', error: err.message }
    }
})

// tg:sendPassword(password) → { status: 'ready' }
ipcMain.handle('tg:sendPassword', async (_e, password) => {
    try {
        return await tg.sendPassword(password)
    } catch (err) {
        return { status: 'error', error: err.message }
    }
})

ipcMain.handle('tg:getMe',         async ()           => tg.getMe())
ipcMain.handle('tg:getFullMe',     async ()           => tg.getFullMe())
ipcMain.handle('tg:getUserInfo',   async (_e, id)     => tg.getUserInfo(id))
ipcMain.handle('tg:updateProfile', async (_e, data)   => tg.updateProfile(data))
ipcMain.handle('tg:updateUsername',async (_e, username) => tg.updateUsername(username))
ipcMain.handle('tg:logout',      async ()                   => tg.logout())
ipcMain.handle('tg:getDialogs',  async ()                   => tg.getDialogs())
ipcMain.handle('tg:getMessages', async (_e, chatId, limit)  => tg.getMessages(chatId, limit))
ipcMain.handle('tg:markAsRead', async (_e, chatId)          => tg.markAsRead(chatId))
ipcMain.handle('tg:sendMessage', async (_e, chatId, text)   => tg.sendMessage(chatId, text))
ipcMain.handle('tg:getAvatar',     async (_e, id)            => tg.getAvatar(id))
ipcMain.handle('tg:getUserStatus', async (_e, chatId)        => tg.getUserStatus(chatId))

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
    const win = new BrowserWindow({
        width:  1200,
        height: 800,
        minWidth:  800,
        minHeight: 600,
        title: 'Messenger',
        webPreferences: {
            preload:          MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
            contextIsolation: true,
        },
    })

    win.loadURL(MAIN_WINDOW_WEBPACK_ENTRY)

    if (isDev) win.webContents.openDevTools()
}

app.whenReady().then(() => {
    tg.init(app.getPath('userData'))

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' ws://localhost:* http://localhost:*; img-src 'self' data: blob:;",
                ],
            },
        })
    })

    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
