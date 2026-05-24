import { useState } from 'react'
import styles from './SideBar.module.css'
import SideBarHeader from './SidebarHeader/SideBarHeader.jsx'
import SideBarItem from './SidebarItem/SidebarItem.jsx'
import { useResizeSidebar } from '../../hooks/useResizeSidebar.js'

function colorFor(str) {
    const palette = ['#F4845F','#5B9BD5','#56B38E','#E8775C','#A78BFA','#F59E0B','#10B981','#3B82F6','#EC4899','#8B5CF6']
    let h = 0
    for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
    return palette[h % palette.length]
}

const SideBar = ({
    onOpenSettings,
    tgData, onTgChatClick, activeTgChatId,
    avatars,
    myProfile, myAvatarUrl,
}) => {
    const [navigation, handleMouseDown] = useResizeSidebar()
    const [query, setQuery] = useState('')

    const q = query.trim().toLowerCase()
    const filtered = (tgData || []).filter(chat =>
        !q || (chat.title || '').toLowerCase().includes(q)
    )

    const displayName = myProfile
        ? (myProfile.firstName || myProfile.username || 'Профиль')
        : 'Профиль'
    const bg = colorFor(displayName)

    return (
        <div className={styles.sidemenu} ref={navigation}>
            <SideBarHeader
                onOpenSettings={onOpenSettings}
                query={query}
                onQuery={setQuery}
            />

            <div className={styles.sideContent}>
                {filtered.map(chat => (
                    <SideBarItem
                        key={chat.id}
                        onClick={() => { if (activeTgChatId !== chat.id) onTgChatClick(chat) }}
                        title={chat.title || `Chat ${chat.id}`}
                        previewMessage={chat.lastMessage?.text || ''}
                        isActive={activeTgChatId === chat.id}
                        unread={chat.unreadCount || 0}
                        avatarUrl={avatars?.[chat.id] || null}
                    />
                ))}

                {(tgData || []).length === 0 && (
                    <div className={styles.emptyHint}>Чаты загружаются…</div>
                )}
                {(tgData || []).length > 0 && filtered.length === 0 && (
                    <div className={styles.emptyHint}>Ничего не найдено</div>
                )}
            </div>

            <div className={styles.profileBar} onClick={onOpenSettings}>
                <div
                    className={styles.profileAvatar}
                    style={{ background: myAvatarUrl ? 'transparent' : bg }}
                >
                    {myAvatarUrl
                        ? <img src={myAvatarUrl} className={styles.profileAvatarImg} alt="" />
                        : <span className={styles.profileAvatarInitial}>{displayName[0].toUpperCase()}</span>
                    }
                </div>
                <div className={styles.profileInfo}>
                    <span className={styles.profileName}>{displayName}</span>
                    {myProfile?.username && (
                        <span className={styles.profileUsername}>@{myProfile.username}</span>
                    )}
                </div>
                <button className={styles.settingsBtn} title="Настройки">⚙️</button>
            </div>

            <div className={styles.draggableRightPart} onMouseDown={handleMouseDown} />
        </div>
    )
}

export default SideBar
