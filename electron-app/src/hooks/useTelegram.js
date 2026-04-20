import { useState, useEffect, useRef, useCallback } from 'react'
import { init, send, destroy } from '../lib/telegram.js'
import { getJson, setJson } from '../lib/storage.js'

const TG_SETTINGS_KEY = 'tgCredentials'

export function getTgCredentials() { return getJson(TG_SETTINGS_KEY, null) }
export function saveTgCredentials(c) { setJson(TG_SETTINGS_KEY, c) }

// authState values:
//   'idle'               — not started yet
//   'loading'            — tdweb initializing
//   'needs_credentials'  — api_id / api_hash not set
//   'phone'              — waiting for phone number
//   'code'               — waiting for SMS/app code
//   'password'           — waiting for 2-FA password
//   'ready'              — logged in
//   'error'              — fatal error

export function useTelegram() {
    const [authState,  setAuthState]  = useState('idle')
    const [authError,  setAuthError]  = useState('')
    const [chats,      setChats]      = useState([])       // sorted chat list
    const chatMapRef = useRef({})                          // { id: chat }
    const [messages,   setMessages]   = useState({})       // { chatId: msg[] }
    const [activeChatId, setActiveChatId] = useState(null)
    const initDoneRef = useRef(false)

    // ── update handler ────────────────────────────────────────────────────────
    const handleUpdate = useCallback(async (update) => {
        const t = update['@type']

        if (t === 'updateAuthorizationState') {
            const state = update.authorization_state['@type']

            if (state === 'authorizationStateWaitTdlibParameters') {
                const creds = getTgCredentials()
                if (!creds?.apiId) { setAuthState('needs_credentials'); return }
                try {
                    await send({
                        '@type':                  'setTdlibParameters',
                        api_id:                    Number(creds.apiId),
                        api_hash:                  creds.apiHash,
                        system_language_code:      'ru',
                        device_model:              'Desktop',
                        application_version:       '1.0',
                        use_message_database:       true,
                        use_secret_chats:           false,
                        use_storage_optimizer:      true,
                        ignore_file_names:          false,
                    })
                } catch (e) { setAuthError(String(e)); setAuthState('error') }
                return
            }

            if (state === 'authorizationStateWaitPhoneNumber') { setAuthState('phone'); return }
            if (state === 'authorizationStateWaitCode')         { setAuthState('code');  return }
            if (state === 'authorizationStateWaitPassword')     { setAuthState('password'); return }

            if (state === 'authorizationStateReady') {
                setAuthState('ready')
                await fetchChats()
                return
            }

            if (state === 'authorizationStateClosed' || state === 'authorizationStateLoggingOut') {
                setAuthState('phone')
                return
            }
        }

        if (t === 'updateNewChat') {
            const chat = update.chat
            chatMapRef.current[chat.id] = chat
            setChats(prev => {
                const exists = prev.find(c => c.id === chat.id)
                return exists ? prev : [chat, ...prev]
            })
        }

        if (t === 'updateChatLastMessage') {
            chatMapRef.current[update.chat_id] = {
                ...(chatMapRef.current[update.chat_id] || {}),
                last_message: update.last_message,
                positions:    update.positions,
            }
            setChats(prev => {
                const updated = prev.map(c =>
                    c.id === update.chat_id
                        ? { ...c, last_message: update.last_message }
                        : c
                )
                return updated
            })
        }

        if (t === 'updateChatReadInbox') {
            setChats(prev => prev.map(c =>
                c.id === update.chat_id
                    ? { ...c, unread_count: update.unread_count }
                    : c
            ))
        }

        if (t === 'updateNewMessage') {
            const msg = update.message
            setMessages(prev => ({
                ...prev,
                [msg.chat_id]: [...(prev[msg.chat_id] || []), msg],
            }))
        }

        if (t === 'error') {
            console.error('[tdlib error]', update)
        }
    }, [])

    // ── init ──────────────────────────────────────────────────────────────────
    const start = useCallback(async () => {
        if (initDoneRef.current) return
        initDoneRef.current = true

        const creds = getTgCredentials()
        if (!creds?.apiId) { setAuthState('needs_credentials'); return }

        setAuthState('loading')
        try {
            await init(handleUpdate)
        } catch (e) {
            console.error('[telegram] init failed:', e)
            setAuthState('error')
            setAuthError(String(e))
            initDoneRef.current = false
        }
    }, [handleUpdate])

    useEffect(() => {
        start()
        return () => {}
    }, [start])

    // ── fetch chats ───────────────────────────────────────────────────────────
    const fetchChats = useCallback(async () => {
        try {
            // loadChats triggers updateNewChat updates for known chats
            await send({ '@type': 'loadChats', chat_list: { '@type': 'chatListMain' }, limit: 100 })
        } catch (e) {
            console.warn('[tg] loadChats:', e)
        }
    }, [])

    // ── load messages for a chat ──────────────────────────────────────────────
    const openChat = useCallback(async (chatId) => {
        setActiveChatId(chatId)
        try {
            await send({ '@type': 'openChat', chat_id: chatId })
            const res = await send({
                '@type':           'getChatHistory',
                chat_id:           chatId,
                limit:             50,
                from_message_id:   0,
                offset:            0,
            })
            if (res?.messages) {
                setMessages(prev => ({ ...prev, [chatId]: [...res.messages].reverse() }))
            }
        } catch (e) {
            console.warn('[tg] openChat:', e)
        }
    }, [])

    // ── auth actions ──────────────────────────────────────────────────────────
    const sendPhone = useCallback(async (phone) => {
        try {
            await send({ '@type': 'setAuthenticationPhoneNumber', phone_number: phone })
        } catch (e) { setAuthError(String(e)) }
    }, [])

    const sendCode = useCallback(async (code) => {
        try {
            await send({ '@type': 'checkAuthenticationCode', code })
        } catch (e) { setAuthError(String(e)) }
    }, [])

    const sendPassword = useCallback(async (password) => {
        try {
            await send({ '@type': 'checkAuthenticationPassword', password })
        } catch (e) { setAuthError(String(e)) }
    }, [])

    const logout = useCallback(() => {
        send({ '@type': 'logOut' }).catch(() => {})
        destroy()
        setAuthState('idle')
        setChats([])
        setMessages({})
        initDoneRef.current = false
    }, [])

    // ── send TG message (plain or stego) ──────────────────────────────────────
    const sendTgMessage = useCallback((chatId, text) => {
        return send({
            '@type':   'sendMessage',
            chat_id:   chatId,
            input_message_content: {
                '@type': 'inputMessageText',
                text:    { '@type': 'formattedText', text },
            },
        })
    }, [])

    // ── re-init after credentials saved ──────────────────────────────────────
    const reinit = useCallback(() => {
        initDoneRef.current = false
        start()
    }, [start])

    return {
        authState, authError,
        chats, messages, activeChatId,
        sendPhone, sendCode, sendPassword,
        openChat, sendTgMessage, logout, reinit,
    }
}
