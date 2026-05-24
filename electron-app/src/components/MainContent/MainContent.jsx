import { useState, useEffect, useRef } from 'react'
import MainContentHeader from '../MainContentHeader/MainContentHeader.jsx'
import UserProfileModal from '../UserProfileModal/UserProfileModal.jsx'
import styles from './MainContent.module.css'
import { hasZwPayload, zwDecode, visibleText } from '../../lib/zwSteganography.js'

const ENC_PREFIX = '[enc]'

function isEncrypted(text) {
    if (typeof text !== 'string') return false
    // Support legacy [enc] prefix and new ZW-encoded messages
    return text.includes(ENC_PREFIX) || hasZwPayload(text)
}

function encPayload(text) {
    // New format: ZW-encoded payload hidden in text
    if (hasZwPayload(text)) {
        const decoded = zwDecode(text)
        if (decoded?.startsWith(ENC_PREFIX)) return decoded.slice(ENC_PREFIX.length)
    }
    // Legacy: [enc] in plaintext
    const i = text.indexOf(ENC_PREFIX)
    return i >= 0 ? text.slice(i + ENC_PREFIX.length) : ''
}

function maskText(text) {
    // Visible part is text with ZW chars stripped
    if (hasZwPayload(text)) {
        const visible = visibleText(text).trim()
        return visible || null
    }
    // Legacy: text before [enc]
    const i = text.indexOf(ENC_PREFIX)
    return i > 0 ? text.slice(0, i).trim() : null
}

function formatTime(date) {
    const ms = date > 1e10 ? date : date * 1000
    return new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function colorFor(str) {
    const palette = ['#F4845F','#5B9BD5','#56B38E','#E8775C','#A78BFA','#F59E0B','#10B981','#3B82F6','#EC4899','#8B5CF6']
    let h = 0
    for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
    return palette[h % palette.length]
}

function MsgAvatar({ id, name, url }) {
    const initial = (name || '?')[0].toUpperCase()
    const bg      = colorFor(name || id)
    return (
        <div className={styles.msgAvatar} style={{ background: url ? 'transparent' : bg }}>
            {url
                ? <img src={url} className={styles.msgAvatarImg} alt="" />
                : <span className={styles.msgAvatarInitial}>{initial}</span>
            }
        </div>
    )
}

function Checks({ read }) {
    return (
        <span className={`${styles.checks} ${read ? styles.checksRead : ''}`}>
            {read ? '✓✓' : '✓'}
        </span>
    )
}

function EncryptedMessage({ text, mask, senderId, peerTgId, myTgId, outgoing }) {
    const [state, setState] = useState('locked')  // locked | loading | open | error
    const [plain, setPlain] = useState('')

    const decrypt = async () => {
        setState('loading')
        const otherId = outgoing ? peerTgId : (senderId || peerTgId)
        if (!otherId || !myTgId) { setState('error'); setPlain('нет ID для расшифровки'); return }
        try {
            const result = await window.messenger.decrypt(otherId, encPayload(text), myTgId)
            setPlain(result)
            setState('open')
        } catch (e) {
            setPlain(e.message || 'ошибка расшифровки')
            setState('error')
        }
    }

    // Auto-decrypt own outgoing messages
    useEffect(() => {
        if (outgoing && peerTgId && myTgId) decrypt()
    }, [outgoing, peerTgId, myTgId])

    if (state === 'open') return (
        <span className={styles.encDecrypted}>
            🔒 {plain}
            {mask && <span className={styles.encMask}>«{mask}»</span>}
        </span>
    )
    if (state === 'error')   return <span className={styles.encError}>⚠ {plain}</span>
    if (state === 'loading') return <span className={styles.encLocked}>🔒 расшифровка…</span>
    return (
        <span className={styles.encLocked}>
            {mask ? `«${mask}»` : '🔒 Зашифровано'}
            <button className={styles.decryptBtn} onClick={decrypt}>🔓</button>
        </span>
    )
}

const MainContent = ({
    activeItem, messages = [], connected, onSend,
    avatars = {}, onNeedAvatar, isGroup,
    status, readOutboxMaxId = 0,
    encryptedMode, onToggleEncrypted,
    myTgId, peerTgId,
    showProfile, onShowProfile,
}) => {
    const [text, setText] = useState('')
    const bottomRef = useRef(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        if (!onNeedAvatar) return
        messages.forEach(m => {
            if (!m.self && m.senderId) onNeedAvatar(m.senderId)
        })
    }, [messages, onNeedAvatar])

    const handleSend = () => {
        const t = text.trim()
        if (!t || !connected) return
        onSend(t)
        setText('')
    }

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    }

    if (!activeItem) {
        return (
            <div className={styles.contentWrapper}>
                <div className={styles.placeholder}>Выберите чат</div>
            </div>
        )
    }

    return (
        <div className={styles.contentWrapper}>
            {showProfile && (
                <UserProfileModal
                    userId={activeItem.id}
                    title={activeItem.title}
                    avatarUrl={avatars[activeItem.id] ?? null}
                    onClose={() => onShowProfile(false)}
                />
            )}
            <MainContentHeader
                title={activeItem.title}
                connected={connected}
                status={status}
                onDotsClick={() => onShowProfile(true)}
            />

            <div className={styles.messageList}>
                {messages.map(m => {
                    const avatarId   = (isGroup && m.senderId) ? m.senderId : activeItem.id
                    const avatarUrl  = !m.self ? (avatars[avatarId] ?? null) : null
                    const avatarName = (isGroup && m.senderName) ? m.senderName : activeItem.title
                    const isRead     = (m.self || m.outgoing) && m.id <= readOutboxMaxId && m.id < 1e12
                    const encrypted  = isEncrypted(m.text)

                    return (
                        <div key={m.id} className={`${styles.bubbleRow} ${m.self || m.outgoing ? styles.bubbleRowSelf : styles.bubbleRowOther}`}>
                            {!(m.self || m.outgoing) && (
                                <MsgAvatar id={avatarId} name={avatarName} url={avatarUrl} />
                            )}
                            <div className={styles.bubbleWrap}>
                                {isGroup && !(m.self || m.outgoing) && m.senderName && (
                                    <span className={styles.senderName} style={{ color: colorFor(m.senderName) }}>
                                        {m.senderName}
                                    </span>
                                )}
                                <div className={`${styles.bubble} ${(m.self || m.outgoing) ? styles.bubbleSelf : styles.bubbleOther}`}>
                                    {encrypted ? (
                                        <EncryptedMessage
                                            text={m.text}
                                            mask={maskText(m.text)}
                                            senderId={m.senderId}
                                            peerTgId={peerTgId}
                                            myTgId={myTgId}
                                            outgoing={!!(m.self || m.outgoing)}
                                        />
                                    ) : m.text}
                                    <div className={styles.bubbleMeta}>
                                        <span className={styles.time}>{formatTime(m.date || m.id)}</span>
                                        {(m.self || m.outgoing) && <Checks read={isRead} />}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
                <div ref={bottomRef} />
            </div>

            <div className={styles.inputArea}>
                <button
                    className={`${styles.encToggle} ${encryptedMode ? styles.encToggleOn : ''}`}
                    onClick={onToggleEncrypted}
                    title={encryptedMode ? 'Шифрование включено' : 'Включить шифрование'}
                >
                    🔒
                </button>
                <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder={encryptedMode ? '🔒 Зашифрованное сообщение…' : 'Сообщение'}
                    disabled={!connected}
                />
                <button onClick={handleSend} disabled={!connected || !text.trim()}>
                    Отправить
                </button>
            </div>
        </div>
    )
}

export default MainContent
