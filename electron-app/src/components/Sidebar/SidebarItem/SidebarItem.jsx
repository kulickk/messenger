import styles from './SideBarItem.module.css'

const SideBarItem = ({ isActive = false, title = '', previewMessage = '', unread = 0, onClick }) => {
    return (
        <div onClick={onClick} className={`${styles.sidebarItem} ${isActive ? styles.isActive : ''}`}>
            <div className={styles.sidebarAvatar} />
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
