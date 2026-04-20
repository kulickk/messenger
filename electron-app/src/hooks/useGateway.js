import { useState, useEffect, useRef, useCallback } from 'react'
import { saveMessage } from '../lib/storage.js'

export function useGateway(config) {
    const wsRef         = useRef(null)
    const retryRef      = useRef(1000)   // reconnect delay ms
    const mountedRef    = useRef(true)
    const [connected, setConnected] = useState(false)
    const [sent, setSent]           = useState({})   // { contactId: [msg] } — in-memory for session

    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false; wsRef.current?.close() }
    }, [])

    useEffect(() => {
        if (!config) return
        let cancelled = false

        const connect = async () => {
            if (cancelled) return
            const ws = new WebSocket(`${config.gatewayUrl}/ws?user_id=${config.userId}`)
            wsRef.current = ws

            ws.onopen = async () => {
                try {
                    const keys = await window.messenger.getKeys(config.userId)
                    // publish key (fire-and-forget)
                    fetch(`${config.keyServerUrl}/publish`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: config.userId, public_key: keys.pubKeyB64 }),
                    }).catch(() => {})
                    ws.send(JSON.stringify({ type: 'auth', priv_key: keys.privKeyB64 }))
                } catch (e) {
                    console.error('[gateway] auth error:', e)
                    ws.close()
                }
            }

            ws.onmessage = (e) => {
                const msg = JSON.parse(e.data)
                if (msg.type === 'auth_ok') {
                    retryRef.current = 1000
                    if (mountedRef.current) setConnected(true)
                }
            }

            ws.onerror = (e) => console.warn('[gateway] ws error:', e)

            ws.onclose = () => {
                if (!mountedRef.current || cancelled) return
                setConnected(false)
                const delay = retryRef.current
                retryRef.current = Math.min(delay * 2, 30000)
                setTimeout(connect, delay)
            }
        }

        connect()
        return () => { cancelled = true; wsRef.current?.close() }
    }, [config])

    const sendMessage = useCallback((toUserId, text) => {
        if (!wsRef.current || !connected) return false
        wsRef.current.send(JSON.stringify({
            type:      'send_message',
            to:        toUserId,
            text,
            cipher_id: config?.cipherId || 'harry_potter',
        }))
        const msg = { id: Date.now(), text, self: true, time: Date.now() }
        saveMessage(toUserId, msg)
        setSent(prev => ({ ...prev, [toUserId]: [...(prev[toUserId] || []), msg] }))
        return true
    }, [connected, config])

    return { sendMessage, connected, sent }
}
