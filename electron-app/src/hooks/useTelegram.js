import { useState, useEffect, useCallback, useRef } from 'react'

export function useTelegram() {
    const [authState,    setAuthState]    = useState('idle')
    const [authError,    setAuthError]    = useState('')
    const [chats,        setChats]        = useState([])
    const [messages,     setMessages]     = useState({})       // { chatId: msg[] }
    const [activeChatId, setActiveChatId] = useState(null)
    const [userStatuses, setUserStatuses] = useState({})       // { userId: statusObj }
    const [readOutbox,   setReadOutbox]   = useState({})       // { chatId: maxId }
    const [myTgId,       setMyTgId]       = useState(null)
    const [myProfile,    setMyProfile]    = useState(null)
    const [qrDataUrl,    setQrDataUrl]    = useState(null)
    const startedRef = useRef(false)

    const onReady = useCallback(() => {
        loadDialogs()
        window.tg.getMe().then(me => {
            setMyTgId(me.id)
            setMyProfile(me)
            window.messenger.publishKey(me.id).catch(() => {})
        }).catch(() => {})
    }, [])

    // ── bootstrap ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (startedRef.current) return
        startedRef.current = true
        setAuthState('loading')
        window.tg.start().then(res => {
            if (res.status === 'ready') { setAuthState('ready'); onReady() }
            else if (res.status === 'needs_phone') setAuthState('phone')
            else { setAuthError(res.error || ''); setAuthState('error') }
        }).catch(e => { setAuthError(String(e)); setAuthState('error') })
    }, [])

    // ── push updates from main process ────────────────────────────────────────
    useEffect(() => {
        const unsub = window.tg.onUpdate((data) => {
            if (data.type === 'authState') {
                setAuthState(data.state)
                if (data.state === 'ready') onReady()
            }

            if (data.type === 'qrCode') {
                setQrDataUrl(data.dataUrl)
            }

            if (data.type === 'newMessage') {
                const msg = data.message
                if (!msg || !msg.chatId) return
                setMessages(prev => {
                    const cid      = msg.chatId
                    const existing = prev[cid] || []
                    const filtered = existing.filter(m =>
                        m.id !== msg.id &&
                        !(m.id > 1e12 && msg.outgoing && m.text === msg.text)
                    )
                    return { ...prev, [cid]: [...filtered, msg] }
                })
            }

            // Real-time read receipt: peer read our outgoing messages up to maxId
            if (data.type === 'readOutbox') {
                setReadOutbox(prev => {
                    const cur = prev[data.chatId] ?? 0
                    if (data.maxId <= cur) return prev
                    return { ...prev, [data.chatId]: data.maxId }
                })
            }

            // Real-time user status change
            if (data.type === 'userStatus') {
                setUserStatuses(prev => ({ ...prev, [data.userId]: data.status }))
            }
        })
        return unsub
    }, [])

    // ── load dialogs ──────────────────────────────────────────────────────────
    const loadDialogs = useCallback(async () => {
        try {
            const dialogs = await window.tg.getDialogs()
            setChats(dialogs)
            // Seed readOutbox from dialog data
            const seed = {}
            dialogs.forEach(d => { if (d.readOutboxMaxId) seed[d.id] = d.readOutboxMaxId })
            setReadOutbox(prev => ({ ...seed, ...prev }))
        } catch (e) {
            console.warn('[tg] getDialogs:', e)
        }
    }, [])

    // ── open chat ─────────────────────────────────────────────────────────────
    const openChat = useCallback(async (chatId) => {
        setActiveChatId(chatId)
        // Mark as read immediately and clear badge
        window.tg.markAsRead(chatId).catch(() => {})
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, unreadCount: 0 } : c))
        try {
            const msgs = await window.tg.getMessages(chatId, 50)
            setMessages(prev => ({ ...prev, [chatId]: msgs }))
        } catch (e) {
            console.warn('[tg] getMessages:', e)
        }
        try {
            const status = await window.tg.getUserStatus(chatId)
            if (status) setUserStatuses(prev => ({ ...prev, [chatId]: status }))
        } catch {}
    }, [])

    // ── auth actions ──────────────────────────────────────────────────────────
    const sendPhone = useCallback(async (phone) => {
        setAuthError('')
        const res = await window.tg.sendPhone(phone)
        if (res.status === 'error') setAuthError(res.error)
    }, [])

    const sendCode = useCallback(async (code) => {
        setAuthError('')
        const res = await window.tg.sendCode(code)
        if (res.status === 'error') setAuthError(res.error)
    }, [])

    const sendPassword = useCallback(async (password) => {
        setAuthError('')
        const res = await window.tg.sendPassword(password)
        if (res.status === 'error') setAuthError(res.error)
    }, [])

    const startQrLogin = useCallback(async () => {
        setAuthError('')
        setQrDataUrl(null)
        await window.tg.startQrLogin()
    }, [])

    const logout = useCallback(async () => {
        await window.tg.logout()
        setChats([])
        setMessages({})
        setActiveChatId(null)
        setUserStatuses({})
        setReadOutbox({})
        startedRef.current = false
    }, [])

    // ── send message ──────────────────────────────────────────────────────────
    const sendTgMessage = useCallback(async (chatId, text) => {
        const tempMsg = {
            id:         Date.now(),
            text,
            outgoing:   true,
            date:       Math.floor(Date.now() / 1000),
            chatId,
            senderId:   null,
            senderName: null,
        }
        setMessages(prev => ({ ...prev, [chatId]: [...(prev[chatId] || []), tempMsg] }))
        try {
            await window.tg.sendMessage(chatId, text)
        } catch {
            setMessages(prev => ({
                ...prev,
                [chatId]: (prev[chatId] || []).filter(m => m.id !== tempMsg.id),
            }))
        }
    }, [])

    // ── reinit (e.g. after logout) ────────────────────────────────────────────
    const reinit = useCallback(() => {
        startedRef.current = false
        setAuthState('idle')
        setAuthError('')
        setTimeout(() => {
            startedRef.current = true
            setAuthState('loading')
            window.tg.start().then(res => {
                if (res.status === 'ready') { setAuthState('ready'); loadDialogs() }
                else if (res.status === 'needs_phone') setAuthState('phone')
                else { setAuthError(res.error || ''); setAuthState('error') }
            }).catch(e => { setAuthError(String(e)); setAuthState('error') })
        }, 100)
    }, [loadDialogs])

    return {
        authState, authError, myTgId, myProfile,
        qrDataUrl,
        chats, messages, activeChatId,
        userStatuses, readOutbox,
        sendPhone, sendCode, sendPassword, startQrLogin,
        openChat, sendTgMessage, logout, reinit,
    }
}
