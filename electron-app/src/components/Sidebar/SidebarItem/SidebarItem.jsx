import styles from './SideBarItem.module.css'

// Deterministic pastel color from a string
function colorFor(str) {
    const palette = ['#F4845F','#5B9BD5','#56B38E','#E8775C','#A78BFA','#F59E0B','#10B981','#3B82F6','#EC4899','#8B5CF6']
    let h = 0
    for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
    return palette[h % palette.length]
}

const SideBarItem = ({ isActive = false, title = '', previewMessage = '', unread = 0, onClick, avatarUrl }) => {
    const initial = (title || '?')[0].toUpperCase()
    const bg      = colorFor(title)

    return (
        <div onClick={onClick} className={`${styles.sidebarItem} ${isActive ? styles.isActive : ''}`}>
            <div className={styles.sidebarAvatar} style={!avatarUrl ? { background: bg } : {}}>
                {avatarUrl
                    ? <img src={avatarUrl} className={styles.avatarImg} alt="" />
                    : <span className={styles.avatarInitial}>{initial}</span>
                }
            </div>
            <div className={styles.sidebarItemTextContainer}>
                <span className={styles.sidebarItemTitle}>{title}</span>
                <span className={styles.sidebarItemPreview}>{previewMessage}</span>
            </div>
            {unread > 0 && !isActive && (
                <div className={styles.badge}>{unread > 99 ? '99+' : unread}</div>
            )}
        </div>
    )
}

export default SideBarItem
