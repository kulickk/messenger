const P = 'messenger:'

export const get     = (key)       => localStorage.getItem(P + key)
export const set     = (key, val)  => localStorage.setItem(P + key, val)
export const remove  = (key)       => localStorage.removeItem(P + key)
export const getJson = (key, def)  => { try { const v = get(key); return v ? JSON.parse(v) : def } catch { return def } }
export const setJson = (key, val)  => set(key, JSON.stringify(val))

// Messages capped at 500 per contact
const MSG_LIMIT = 500

export function loadMessages(contactId) {
    return getJson(`msgs:${contactId}`, [])
}

export function saveMessage(contactId, msg) {
    const msgs = loadMessages(contactId)
    msgs.push(msg)
    if (msgs.length > MSG_LIMIT) msgs.splice(0, msgs.length - MSG_LIMIT)
    setJson(`msgs:${contactId}`, msgs)
}

export function loadContacts() {
    return getJson('contacts', [])
}

export function saveContacts(contacts) {
    setJson('contacts', contacts)
}

export function loadUserId() {
    let id = get('userId')
    if (!id) {
        id = crypto.randomUUID()
        set('userId', id)
    }
    return id
}

export function saveUserId(id) {
    set('userId', id)
}

export function loadSettings() {
    return getJson('settings', {
        keyServerUrl:   'http://localhost:8081',
        gatewayUrl:     'ws://localhost:8080',
        gatewayHttpUrl: 'http://localhost:8080',
        cipherId:       'harry_potter',
    })
}

export function saveSettings(s) {
    setJson('settings', s)
}

export function getUnread(contactId) {
    return getJson(`unread:${contactId}`, 0)
}

export function setUnread(contactId, n) {
    setJson(`unread:${contactId}`, n)
}

export function clearUnread(contactId) {
    remove(`unread:${contactId}`)
}
