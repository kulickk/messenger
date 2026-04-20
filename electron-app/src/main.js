const { app, BrowserWindow, ipcMain, session } = require('electron')

if (require('electron-squirrel-startup')) app.quit()

const { getOrCreateKeyPair, ecdhDerive, aesDecrypt, fetchAndCachePubKey } = require('./lib/nodeCrypto')

const isDev = process.env.NODE_ENV !== 'production'

const defaults = {
    keyServerUrl:   process.env.KEY_SERVER_URL   || 'http://localhost:8081',
    gatewayUrl:     process.env.GATEWAY_URL      || 'ws://localhost:8080',
    gatewayHttpUrl: process.env.GATEWAY_HTTP_URL || 'http://localhost:8080',
    cipherId:       process.env.CIPHER_ID        || 'harry_potter',
}

// ── IPC ───────────────────────────────────────────────────────────────────────

ipcMain.handle('messenger:getDefaults', () => defaults)

ipcMain.handle('messenger:getKeys', (_e, userId) => getOrCreateKeyPair(userId))

ipcMain.handle('messenger:decrypt', async (_e, fromUserId, payloadB64, myUserId) => {
    const { privKeyB64 } = getOrCreateKeyPair(myUserId)
    const privRaw    = Buffer.from(privKeyB64, 'base64')
    const peerPubRaw = await fetchAndCachePubKey(fromUserId, defaults.keyServerUrl)
    const shared     = ecdhDerive(privRaw, peerPubRaw)
    return aesDecrypt(shared, Buffer.from(payloadB64, 'base64'))
})

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
    // Allow fetch/WS to localhost
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' ws://localhost:* http://localhost:* blob:; worker-src 'self' blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:;",
                ],
                'Cross-Origin-Opener-Policy':   ['same-origin'],
                'Cross-Origin-Embedder-Policy': ['require-corp'],
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
