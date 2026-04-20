import { useState, useEffect, useRef } from 'react'
import { extract, visiblePart } from '../lib/zeroWidth.js'
import { saveMessage, setUnread, getUnread } from '../lib/storage.js'

function bytesToBase64(bytes) {
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin)
}

function notify(fromId, text) {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'granted') {
        new Notification(fromId, { body: text, silent: false })
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => {
            if (p === 'granted') new Notification(fromId, { body: text })
        })
    }
}

export function useInbox(config, activeContactId) {
    // { [fromUserId]: [msg] } — decoded messages for this session
    const [inbox,    setInbox]    = useState({})
    const [unread,   setUnreadMap] = useState({})
    const lastIdRef  = useRef(0)

    useEffect(() => {
        if (!config) return

        const poll = async () => {
            try {
                const res = await fetch(
                    `${config.gatewayHttpUrl}/inbox/${config.userId}?after=${lastIdRef.current}`
                )
                if (!res.ok) return
                const msgs = await res.json()
                if (!msgs?.length) return

                for (const raw of msgs) {
                    lastIdRef.current = Math.max(lastIdRef.current, raw.id)

                    const payload = extract(raw.stego)
                    if (!payload) continue

                    try {
                        const plaintext = await window.messenger.decrypt(
                            raw.from_user_id, bytesToBase64(payload), config.userId
                        )
                        const mask = visiblePart(raw.stego)
                        const msg  = { id: raw.id, text: plaintext, mask, self: false, time: Date.now() }

                        saveMessage(raw.from_user_id, msg)

                        setInbox(prev => ({
                            ...prev,
                            [raw.from_user_id]: [...(prev[raw.from_user_id] || []), msg],
                        }))

                        // unread + notify if not the active chat
                        if (raw.from_user_id !== activeContactId) {
                            const n = getUnread(raw.from_user_id) + 1
                            setUnread(raw.from_user_id, n)
                            setUnreadMap(prev => ({ ...prev, [raw.from_user_id]: n }))
                            notify(raw.from_user_id, plaintext)
                        }
                    } catch (e) {
                        console.warn('[inbox] decrypt failed msg', raw.id, e)
                    }
                }
            } catch (_) {}
        }

        const t = setInterval(poll, 2000)
        return () => clearInterval(t)
    }, [config, activeContactId])

    return { inbox, unread }
}
