/**
 * GramJS (Telegram MTProto) client — Electron main process.
 * Sessions persisted to userData/tg_session.txt.
 * Push updates to renderer via webContents.send('tg:update').
 */
const { TelegramClient } = require('telegram')
const { StringSession }  = require('telegram/sessions')
const { Api, utils }     = require('telegram')
const { NewMessage, Raw } = require('telegram/events')
const path               = require('path')
const fs                 = require('fs')

let userDataPath = null
let client       = null
let wcRef        = null

let phoneCodeHash            = null
let lastPhone                = null
let pendingQrPasswordResolve = null

const entityCache  = {}   // id-string → entity object
const avatarCache  = {}   // id-string → 'data:image/jpeg;base64,...' | null
const readOutboxMap = {}  // chatId-string → maxId (highest outgoing msg read by peer)

// ── helpers ───────────────────────────────────────────────────────────────────

function sessionPath() { return path.join(userDataPath, 'tg_session.txt') }

function loadSession() {
    try {
        const p = sessionPath()
        if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim()
    } catch {}
    return ''
}

function saveSession() {
    try { fs.writeFileSync(sessionPath(), client.session.save(), 'utf8') } catch {}
}

function push(type, payload) {
    if (wcRef && !wcRef.isDestroyed()) wcRef.send('tg:update', { type, ...payload })
}

function safeId(v) {
    if (v === null || v === undefined) return null
    return v.toString()
}

function mediaLabel(m) {
    const cls = m.media?.className
    if (!cls) return ''
    if (cls === 'MessageMediaPhoto')    return '📷 Фото'
    if (cls === 'MessageMediaSticker')  return '🩻 Стикер'
    if (cls === 'MessageMediaPoll')     return '📊 Опрос'
    if (cls === 'MessageMediaGeo' || cls === 'MessageMediaGeoLive') return '📍 Геолокация'
    if (cls === 'MessageMediaContact')  return '👤 Контакт'
    if (cls === 'MessageMediaVenue')    return '📍 Место'
    if (cls === 'MessageMediaDocument') {
        const mime = m.media?.document?.mimeType || ''
        if (mime.startsWith('video/'))          return '🎥 Видео'
        if (mime.startsWith('audio/'))          return '🎵 Аудио'
        if (mime === 'image/gif')               return '🎞 GIF'
        if (mime === 'application/x-tgsticker') return '🩻 Стикер'
        return '📎 Файл'
    }
    return '📎 Вложение'
}

function serializeMsg(m) {
    const text   = m.message || mediaLabel(m)
    const sender = m.sender
    const sid    = safeId(sender?.id)
    if (sid && sender) entityCache[sid] = sender

    const chatId = m.peerId ? safeId(utils.getPeerId(m.peerId)) : null

    return {
        id:         m.id,
        text,
        outgoing:   !!m.out,
        date:       m.date,
        chatId,
        senderId:   sid,
        senderName: sender?.firstName
                  ? (sender.firstName + (sender.lastName ? ' ' + sender.lastName : ''))
                  : (sender?.title || null),
    }
}

// ── user status ───────────────────────────────────────────────────────────────

function serializeStatus(status) {
    if (!status) return { type: 'empty', text: '' }
    const cls = status.className || status.constructor?.name || ''
    if (cls === 'UserStatusOnline')     return { type: 'online',     text: 'в сети' }
    if (cls === 'UserStatusRecently')   return { type: 'recently',   text: 'был(а) недавно' }
    if (cls === 'UserStatusLastWeek')   return { type: 'lastweek',   text: 'был(а) на этой неделе' }
    if (cls === 'UserStatusLastMonth')  return { type: 'lastmonth',  text: 'был(а) в этом месяце' }
    if (cls === 'UserStatusOffline') {
        const wo  = status.wasOnline
        const now = Math.floor(Date.now() / 1000)
        const d   = now - wo
        let text
        if      (d < 60)    text = 'только что'
        else if (d < 3600)  text = `${Math.floor(d / 60)} мин. назад`
        else if (d < 86400) text = `сегодня в ${new Date(wo * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
        else                text = new Date(wo * 1000).toLocaleDateString('ru-RU')
        return { type: 'offline', text }
    }
    return { type: 'empty', text: '' }
}

async function getUserStatus(chatIdStr) {
    const entity = entityCache[chatIdStr]
    if (!entity || !client) return null

    if (entity instanceof Api.User) {
        try {
            const result = await client.invoke(new Api.users.GetFullUser({ id: entity }))
            const user   = result.users?.[0]
            return { ...serializeStatus(user?.status), isBot: !!user?.bot }
        } catch {
            return serializeStatus(entity.status)
        }
    }

    // Group / channel — return member count
    try {
        if (entity instanceof Api.Channel) {
            const full  = await client.invoke(new Api.channels.GetFullChannel({ channel: entity }))
            const count = full.fullChat?.participantsCount
            const isChannel = entity.broadcast
            return { type: 'group', text: count
                ? `${count.toLocaleString('ru-RU')} ${isChannel ? 'подписчиков' : 'участников'}`
                : (isChannel ? 'канал' : 'группа') }
        }
        if (entity instanceof Api.Chat) {
            return { type: 'group', text: `${entity.participantsCount || ''} участников`.trim() }
        }
    } catch {}
    return { type: 'group', text: 'группа' }
}

// ── dialog helpers ────────────────────────────────────────────────────────────

function serializeDialog(d) {
    const id      = safeId(d.id)
    const entity  = d.entity || d.inputEntity
    const isGroup = entity && !(entity instanceof Api.User)

    // readOutboxMaxId: highest msg id from us that the peer has read
    const readOutboxMaxId = d.dialog?.readOutboxMaxId ?? 0
    readOutboxMap[id] = readOutboxMaxId

    return {
        id,
        title:          d.title || d.name || `Chat ${id}`,
        unreadCount:    d.unreadCount || 0,
        isGroup,
        readOutboxMaxId,
        lastMessage:    d.message
            ? { text: d.message.message || mediaLabel(d.message), date: d.message.date }
            : null,
    }
}

// ── lifecycle ─────────────────────────────────────────────────────────────────

function init(dataPath) { userDataPath = dataPath }

async function start(wc, apiId, apiHash) {
    wcRef = wc
    const session = new StringSession(loadSession())
    client = new TelegramClient(session, Number(apiId), apiHash, {
        connectionRetries: 5,
        baseLogger: { warn: ()=>{}, error: ()=>{}, info: ()=>{}, debug: ()=>{} },
    })
    await client.connect()

    // New messages (both directions)
    client.addEventHandler((event) => {
        const msg = event.message
        if (!msg) return
        push('newMessage', { message: serializeMsg(msg) })
    }, new NewMessage({ incoming: true, outgoing: true }))

    // Raw updates: read receipts + user status changes
    client.addEventHandler((update) => {
        // Outbox read in private/group chats
        if (update instanceof Api.UpdateReadHistoryOutbox) {
            const chatId = safeId(utils.getPeerId(update.peer))
            readOutboxMap[chatId] = update.maxId
            push('readOutbox', { chatId, maxId: update.maxId })
            return
        }
        // Outbox read in channels/supergroups
        if (update instanceof Api.UpdateReadChannelOutbox) {
            const chatId = safeId(utils.getPeerId(new Api.PeerChannel({ channelId: update.channelId })))
            readOutboxMap[chatId] = update.maxId
            push('readOutbox', { chatId, maxId: update.maxId })
            return
        }
        // User online/offline status change
        if (update instanceof Api.UpdateUserStatus) {
            push('userStatus', {
                userId: safeId(update.userId),
                status: serializeStatus(update.status),
            })
            return
        }
    }, new Raw({}))

    if (await client.isUserAuthorized()) {
        push('authState', { state: 'ready' })
        return { status: 'ready' }
    }
    push('authState', { state: 'phone' })
    return { status: 'needs_phone' }
}

async function sendPhone(phone) {
    lastPhone = phone
    const result = await client.sendCode(
        { apiId: client.apiId, apiHash: client.apiHash }, phone,
    )
    phoneCodeHash = result.phoneCodeHash
    console.log('[tg] sendCode result:', JSON.stringify(result, null, 2))
    push('authState', { state: 'code' })
    return { status: 'needs_code' }
}

async function sendCode(code) {
    try {
        await client.invoke(new Api.auth.SignIn({ phoneNumber: lastPhone, phoneCodeHash, phoneCode: code }))
        saveSession()
        push('authState', { state: 'ready' })
        return { status: 'ready' }
    } catch (err) {
        if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
            push('authState', { state: 'password' })
            return { status: 'needs_password' }
        }
        throw err
    }
}

async function sendPassword(password) {
    // QR-login flow: GramJS is waiting for password via promise
    if (pendingQrPasswordResolve) {
        pendingQrPasswordResolve(password)
        pendingQrPasswordResolve = null
        return { status: 'ok' }
    }
    // Phone-login flow
    const { computeCheck } = require('telegram/Password')
    const pwdInfo = await client.invoke(new Api.account.GetPassword())
    const check   = await computeCheck(pwdInfo, password)
    await client.invoke(new Api.auth.CheckPassword({ password: check }))
    saveSession()
    push('authState', { state: 'ready' })
    return { status: 'ready' }
}

async function startQrLogin(wc) {
    wcRef = wc
    const QRCode = require('qrcode')
    push('authState', { state: 'qr' })
    try {
        await client.signInUserWithQrCode(
            { apiId: client.apiId, apiHash: client.apiHash },
            {
                qrCode: async (code) => {
                    const token  = code.token.toString('base64url')
                    const url    = `tg://login?token=${token}`
                    const dataUrl = await QRCode.toDataURL(url, { width: 240, margin: 1 })
                    push('qrCode', { dataUrl })
                },
                password: async (_hint) => {
                    push('authState', { state: 'password' })
                    return new Promise((resolve) => { pendingQrPasswordResolve = resolve })
                },
                onError: (err) => {
                    console.error('[tg] QR error:', err)
                    return true
                },
            }
        )
        saveSession()
        push('authState', { state: 'ready' })
    } catch (err) {
        console.error('[tg] QR login failed:', err)
        push('authState', { state: 'phone' })
    }
}

async function logout() {
    try { await client.invoke(new Api.auth.LogOut()) } catch {}
    try { fs.unlinkSync(sessionPath()) } catch {}
    client = null
    push('authState', { state: 'phone' })
}

// ── data ──────────────────────────────────────────────────────────────────────

async function getDialogs() {
    const dialogs = await client.getDialogs({ limit: 100 })
    return dialogs
        .filter(d => !d.archived && (d.dialog?.folderId ?? 0) === 0)
        .map(d => {
            const s      = serializeDialog(d)
            const entity = d.entity || d.inputEntity
            if (entity) entityCache[s.id] = entity
            return s
        })
}

async function getMessages(chatIdStr, limit = 50) {
    const entity = entityCache[chatIdStr]
    if (!entity) throw new Error('Unknown chat id: ' + chatIdStr)
    const msgs = await client.getMessages(entity, { limit })
    return msgs.map(serializeMsg).reverse()
}

async function markAsRead(chatIdStr) {
    const entity = entityCache[chatIdStr]
    if (!entity || !client) return
    try {
        await client.invoke(new Api.messages.ReadHistory({ peer: entity, maxId: 0 }))
    } catch {}
}

async function sendMessage(chatIdStr, text) {
    const entity = entityCache[chatIdStr]
    if (!entity) throw new Error('Unknown chat id: ' + chatIdStr)
    await client.sendMessage(entity, { message: text })
}

// ── avatars ───────────────────────────────────────────────────────────────────

async function getAvatar(idStr) {
    if (avatarCache[idStr] !== undefined) return avatarCache[idStr]
    let entity = entityCache[idStr]
    // Fallback: own user entity may not be in cache — fetch it directly
    if (!entity && client) {
        try {
            const me = await client.getMe()
            if (safeId(me.id) === idStr) {
                entity = me
                entityCache[idStr] = me
            }
        } catch {}
    }
    if (!entity || !client) { avatarCache[idStr] = null; return null }
    try {
        const buf = await client.downloadProfilePhoto(entity, { isBig: false })
        if (!buf || buf.length === 0) { avatarCache[idStr] = null; return null }
        avatarCache[idStr] = 'data:image/jpeg;base64,' + buf.toString('base64')
        return avatarCache[idStr]
    } catch {
        avatarCache[idStr] = null
        return null
    }
}

async function getMe() {
    const me = await client.getMe()
    return {
        id:        safeId(me.id),
        firstName: me.firstName  || '',
        lastName:  me.lastName   || '',
        username:  me.username   || '',
        about:     '',
    }
}

async function getFullMe() {
    const me     = await client.getMe()
    const full   = await client.invoke(new Api.users.GetFullUser({ id: me }))
    const user   = full.users?.[0] || me
    return {
        id:        safeId(me.id),
        firstName: user.firstName || '',
        lastName:  user.lastName  || '',
        username:  user.username  || '',
        about:     full.fullUser?.about || '',
    }
}

async function updateProfile({ firstName, lastName, about }) {
    await client.invoke(new Api.account.UpdateProfile({
        firstName: String(firstName ?? ''),
        lastName:  String(lastName  ?? ''),
        about:     String(about     ?? ''),
    }))
}

async function updateUsername(username) {
    await client.invoke(new Api.account.UpdateUsername({ username }))
}

async function getUserInfo(idStr) {
    let entity = entityCache[idStr]
    if (!entity || !client) return null
    try {
        if (entity instanceof Api.User) {
            const full = await client.invoke(new Api.users.GetFullUser({ id: entity }))
            const user = full.users?.[0] || entity
            const bday = full.fullUser?.birthday
            return {
                id:        idStr,
                firstName: user.firstName || '',
                lastName:  user.lastName  || '',
                username:  user.username  || '',
                about:     full.fullUser?.about || '',
                phone:     user.phone || '',
                birthday:  bday ? { day: bday.day, month: bday.month, year: bday.year ?? null } : null,
            }
        }
        // Group / channel
        if (entity instanceof Api.Channel) {
            const full = await client.invoke(new Api.channels.GetFullChannel({ channel: entity }))
            return {
                id:        idStr,
                firstName: entity.title || '',
                lastName:  '',
                username:  entity.username || '',
                about:     full.fullChat?.about || '',
                phone:     '',
                memberCount: full.fullChat?.participantsCount || null,
                isChannel:   !!entity.broadcast,
            }
        }
        if (entity instanceof Api.Chat) {
            return {
                id:        idStr,
                firstName: entity.title || '',
                lastName:  '',
                username:  '',
                about:     '',
                phone:     '',
                memberCount: entity.participantsCount || null,
            }
        }
    } catch {}
    return null
}

module.exports = {
    init, start,
    sendPhone, sendCode, sendPassword, startQrLogin, logout,
    getDialogs, getMessages, sendMessage, markAsRead,
    getAvatar, getUserStatus, getMe, getFullMe,
    updateProfile, updateUsername, getUserInfo,
}
