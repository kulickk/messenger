import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import styles from './App.module.css'
import SideBar from '../Sidebar/Sidebar.jsx'
import MainContent from '../MainContent/MainContent.jsx'
import SettingsModal from '../SettingsModal/SettingsModal.jsx'
import TelegramAuth from '../TelegramAuth/TelegramAuth.jsx'
import { useTelegram } from '../../hooks/useTelegram.js'
import { zwEncode } from '../../lib/zwSteganography.js'

const App = () => {
    const [showSettings,   setShowSettings]   = useState(false)
    const [showProfile,    setShowProfile]    = useState(false)
    const [activeTgChat,   setActiveTgChat]   = useState(null)
    const [avatars,        setAvatars]        = useState({})
    const [encryptedMode,  setEncryptedMode]  = useState(false)
    const maskHistory = useRef({})   // chatId → string[] (last 8 masks)
    const avatarLoading = useRef(new Set())

    // ── telegram hook ─────────────────────────────────────────────────────────
    const {
        authState, authError, myTgId, myProfile,
        qrDataUrl,
        chats: tgChats, messages: tgMessages,
        userStatuses, readOutbox,
        sendPhone, sendCode, sendPassword, startQrLogin,
        openChat: openTgChat, sendTgMessage, logout,
    } = useTelegram()

    // ── ESC navigation ───────────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (e.key !== 'Escape') return
            if (showSettings)     { setShowSettings(false); return }
            if (showProfile)      { setShowProfile(false);  return }
            if (activeTgChat)     { setActiveTgChat(null);  return }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [showSettings, showProfile, activeTgChat])

    // ── avatar lazy loader ────────────────────────────────────────────────────
    const loadAvatar = useCallback((id) => {
        if (!id || avatars[id] !== undefined || avatarLoading.current.has(id)) return
        avatarLoading.current.add(id)
        window.tg.getAvatar(id).then(url => {
            setAvatars(prev => ({ ...prev, [id]: url }))
        }).catch(() => {
            setAvatars(prev => ({ ...prev, [id]: null }))
        })
    }, [avatars])

    useEffect(() => {
        tgChats.forEach(c => loadAvatar(c.id))
    }, [tgChats])

    useEffect(() => {
        if (myTgId) loadAvatar(myTgId)
    }, [myTgId])

    // ── handlers ──────────────────────────────────────────────────────────────
    const handleTgChatClick = (chat) => {
        setActiveTgChat(chat)
        openTgChat(chat.id)
        setEncryptedMode(false)
        setShowProfile(false)
    }

    const handleSend = useCallback(async (text) => {
        if (!activeTgChat) return
        if (encryptedMode && myTgId) {
            try {
                const chatId  = activeTgChat.id
                const history = maskHistory.current[chatId] || []
                const [payload, mask] = await Promise.all([
                    window.messenger.encrypt(chatId, text, myTgId),
                    window.messenger.generateMask(text, history).catch(() => null),
                ])
                if (mask) {
                    const prev = maskHistory.current[chatId] || []
                    maskHistory.current[chatId] = [...prev, mask].slice(-8)
                }
                const hidden = zwEncode(`[enc]${payload}`)
                const body   = mask ? `${mask}${hidden}` : hidden
                sendTgMessage(chatId, body)
            } catch (e) {
                console.error('encrypt failed:', e)
            }
        } else {
            sendTgMessage(activeTgChat.id, text)
        }
    }, [activeTgChat, encryptedMode, myTgId, sendTgMessage])

    // ── active chat data ──────────────────────────────────────────────────────
    const messages = useMemo(() => {
        if (!activeTgChat) return []
        return (tgMessages[activeTgChat.id] || []).map(m => ({
            id:         m.id,
            text:       m.text || '',
            self:       !!m.outgoing,
            outgoing:   !!m.outgoing,
            date:       m.date,
            senderId:   m.senderId,
            senderName: m.senderName,
        }))
    }, [activeTgChat, tgMessages])

    const status       = activeTgChat ? (userStatuses[activeTgChat.id] ?? null) : null
    const readOutboxId = activeTgChat ? (readOutbox[activeTgChat.id]   ?? 0)    : 0
    const connected    = authState === 'ready'
    const needsAuth    = authState !== 'ready' && authState !== 'idle'

    // ── render ────────────────────────────────────────────────────────────────
    return (
        <div className={styles.contentContainer}>
            {showSettings && (
                <SettingsModal
                    onClose={() => setShowSettings(false)}
                    myProfile={myProfile}
                    myAvatarUrl={avatars[myTgId] ?? null}
                    onLogout={logout}
                />
            )}

            <SideBar
                onOpenSettings={() => setShowSettings(true)}
                tgData={tgChats}
                onTgChatClick={handleTgChatClick}
                activeTgChatId={activeTgChat?.id}
                avatars={avatars}
                myProfile={myProfile}
                myAvatarUrl={avatars[myTgId] ?? null}
            />

            <div className={styles.mainContent}>
                {needsAuth ? (
                    <TelegramAuth
                        authState={authState}
                        authError={authError}
                        onPhone={sendPhone}
                        onCode={sendCode}
                        onPassword={sendPassword}
                        onQrLogin={startQrLogin}
                        qrDataUrl={qrDataUrl}
                        onOpenSettings={() => setShowSettings(true)}
                    />
                ) : (
                    <MainContent
                        activeItem={activeTgChat}
                        messages={messages}
                        connected={connected}
                        onSend={handleSend}
                        avatars={avatars}
                        onNeedAvatar={loadAvatar}
                        isGroup={activeTgChat?.isGroup}
                        status={status}
                        readOutboxMaxId={readOutboxId}
                        encryptedMode={encryptedMode}
                        onToggleEncrypted={() => setEncryptedMode(v => !v)}
                        myTgId={myTgId}
                        peerTgId={activeTgChat?.id}
                        showProfile={showProfile}
                        onShowProfile={setShowProfile}
                    />
                )}
            </div>
        </div>
    )
}

export default App
