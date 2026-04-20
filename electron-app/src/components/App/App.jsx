import { useState, useEffect, useMemo } from 'react'
import styles from './App.module.css'
import SideBar from '../Sidebar/Sidebar.jsx'
import MainContent from '../MainContent/MainContent.jsx'
import SetupModal from '../SetupModal/SetupModal.jsx'
import AddContactModal from '../AddContactModal/AddContactModal.jsx'
import SettingsModal from '../SettingsModal/SettingsModal.jsx'
import TelegramAuth from '../TelegramAuth/TelegramAuth.jsx'
import { useGateway } from '../../hooks/useGateway.js'
import { useInbox } from '../../hooks/useInbox.js'
import { useTelegram } from '../../hooks/useTelegram.js'
import {
    loadUserId, saveUserId,
    loadContacts, saveContacts,
    loadMessages,
    clearUnread,
} from '../../lib/storage.js'

const App = () => {
    const [userId,        setUserId]        = useState(null)
    const [contacts,      setContacts]      = useState([])
    const [activeContact, setActive]        = useState(null)
    const [showAdd,       setShowAdd]       = useState(false)
    const [showSettings,  setShowSettings]  = useState(false)
    const [defaults,      setDefaults]      = useState(null)
    const [tab,           setTab]           = useState('encrypted')  // 'encrypted' | 'telegram'
    const [activeTgChat,  setActiveTgChat]  = useState(null)

    // ── bootstrap ─────────────────────────────────────────────────────────────
    useEffect(() => {
        window.messenger.getDefaults().then(d => setDefaults(d))
        const uid = loadUserId()
        setUserId(uid)
        setContacts(loadContacts())
    }, [])

    // ── config ────────────────────────────────────────────────────────────────
    const config = useMemo(() => {
        if (!userId || !defaults) return null
        return {
            userId,
            keyServerUrl:   defaults.keyServerUrl,
            gatewayUrl:     defaults.gatewayUrl,
            gatewayHttpUrl: defaults.gatewayHttpUrl,
            cipherId:       defaults.cipherId,
        }
    }, [userId, defaults])

    // ── encrypted messenger hooks ─────────────────────────────────────────────
    const { sendMessage, connected, sent } = useGateway(config)
    const { inbox, unread }                = useInbox(config, activeContact?.id)

    // ── telegram hook ─────────────────────────────────────────────────────────
    const {
        authState, authError,
        chats: tgChats, messages: tgMessages,
        activeChatId: tgActiveChatId,
        sendPhone, sendCode, sendPassword,
        openChat: openTgChat, sendTgMessage, reinit,
    } = useTelegram()

    // ── auto-add new senders to contacts ─────────────────────────────────────
    useEffect(() => {
        Object.keys(inbox).forEach(uid => {
            if (!contacts.find(c => c.id === uid)) {
                const updated = [...contacts, { id: uid, title: uid, previewMessage: '' }]
                setContacts(updated)
                saveContacts(updated)
            }
        })
    }, [inbox])

    // ── handlers (encrypted) ──────────────────────────────────────────────────
    const handleSelectContact = (chat) => {
        setActive(chat)
        clearUnread(chat.id)
    }

    const handleSetupDone = (id) => {
        saveUserId(id)
        setUserId(id)
    }

    const handleAddContact = (contact) => {
        if (contacts.find(c => c.id === contact.id)) return
        const updated = [...contacts, contact]
        setContacts(updated)
        saveContacts(updated)
    }

    const handleSend = (text) => {
        if (tab === 'telegram') {
            if (activeTgChat) sendTgMessage(activeTgChat.id, text)
        } else {
            if (activeContact) sendMessage(activeContact.id, text)
        }
    }

    // ── handlers (telegram) ───────────────────────────────────────────────────
    const handleTgChatClick = (chat) => {
        setActiveTgChat(chat)
        openTgChat(chat.id)
    }

    // ── settings saved → re-init TDLib ───────────────────────────────────────
    const handleSettingsSaved = () => { reinit() }

    // ── encrypted message list ────────────────────────────────────────────────
    const activeMessages = useMemo(() => {
        if (!activeContact) return []
        const persisted  = loadMessages(activeContact.id)
        const sessionIn  = inbox[activeContact.id]  || []
        const sessionOut = sent[activeContact.id]   || []
        const seen       = new Set(persisted.map(m => m.id))
        const extra      = [...sessionIn, ...sessionOut].filter(m => !seen.has(m.id))
        return [...persisted, ...extra].sort((a, b) => a.id - b.id)
    }, [activeContact, inbox, sent])

    // ── telegram message list ─────────────────────────────────────────────────
    const activeTgMessages = useMemo(() => {
        if (!activeTgChat) return []
        return (tgMessages[activeTgChat.id] || []).map(m => ({
            id:   m.id,
            text: m.content?.text?.text || '[медиа]',
            self: m.is_outgoing,
            mask: '',
        }))
    }, [activeTgChat, tgMessages])

    // ── sidebar data with preview ─────────────────────────────────────────────
    const contactsWithPreview = useMemo(() => contacts.map(c => {
        const msgs = loadMessages(c.id)
        const last = msgs[msgs.length - 1]
        return {
            ...c,
            previewMessage: last
                ? (last.self ? `Вы: ${last.text}` : last.text)
                : c.previewMessage,
        }
    }), [contacts, inbox, sent])

    // ── active chat for MainContent ───────────────────────────────────────────
    const mainActiveItem  = tab === 'telegram' ? activeTgChat   : activeContact
    const mainMessages    = tab === 'telegram' ? activeTgMessages : activeMessages
    const mainConnected   = tab === 'telegram' ? (authState === 'ready') : connected

    // ── render ────────────────────────────────────────────────────────────────
    if (userId === null && defaults !== null) {
        return <SetupModal onDone={handleSetupDone} />
    }

    // Telegram auth flow occupies the content area when on telegram tab
    const needsTgAuth = tab === 'telegram' && authState !== 'ready' && authState !== 'idle'

    return (
        <div className={styles.contentContainer}>
            {showAdd && (
                <AddContactModal
                    keyServerUrl={config?.keyServerUrl || 'http://localhost:8081'}
                    onAdd={handleAddContact}
                    onClose={() => setShowAdd(false)}
                />
            )}
            {showSettings && (
                <SettingsModal
                    onClose={() => setShowSettings(false)}
                    onSaved={handleSettingsSaved}
                />
            )}

            <SideBar
                data={contactsWithPreview}
                onSidebarClick={handleSelectContact}
                activeItem={activeContact?.id}
                unread={unread}
                onAddContact={() => setShowAdd(true)}
                tab={tab}
                onTabChange={setTab}
                onOpenSettings={() => setShowSettings(true)}
                tgData={tgChats}
                onTgChatClick={handleTgChatClick}
                activeTgChatId={activeTgChat?.id}
            />

            <div className={styles.mainContent}>
                {needsTgAuth ? (
                    <TelegramAuth
                        authState={authState}
                        authError={authError}
                        onPhone={sendPhone}
                        onCode={sendCode}
                        onPassword={sendPassword}
                        onOpenSettings={() => setShowSettings(true)}
                    />
                ) : (
                    <MainContent
                        activeItem={mainActiveItem}
                        messages={mainMessages}
                        connected={mainConnected}
                        onSend={handleSend}
                    />
                )}
            </div>
        </div>
    )
}

export default App
