import styles from './SideBar.module.css'
import SideBarHeader from './SidebarHeader/SideBarHeader.jsx'
import SideBarItem from './SidebarItem/SidebarItem.jsx'
import { useResizeSidebar } from '../../hooks/useResizeSidebar.js'

const SideBar = ({
    data, onSidebarClick, activeItem, unread, onAddContact,
    tab, onTabChange, onOpenSettings,
    tgData, onTgChatClick, activeTgChatId,
}) => {
    const [navigation, handleMouseDown] = useResizeSidebar()

    return (
        <div className={styles.sidemenu} ref={navigation}>
            <SideBarHeader onAddContact={tab === 'encrypted' ? onAddContact : null} />

            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${tab === 'encrypted' ? styles.tabActive : ''}`}
                    onClick={() => onTabChange('encrypted')}
                >
                    🔐 Зашифр.
                </button>
                <button
                    className={`${styles.tab} ${tab === 'telegram' ? styles.tabActive : ''}`}
                    onClick={() => onTabChange('telegram')}
                >
                    ✈️ Telegram
                </button>
            </div>

            <div className={styles.sideContent}>
                {tab === 'encrypted' && (data || []).map((chat) => (
                    <SideBarItem
                        key={chat.id}
                        onClick={() => { if (activeItem !== chat.id) onSidebarClick(chat) }}
                        title={chat.title}
                        previewMessage={chat.previewMessage}
                        isActive={activeItem === chat.id}
                        unread={unread?.[chat.id] || 0}
                    />
                ))}

                {tab === 'telegram' && (tgData || []).map((chat) => (
                    <SideBarItem
                        key={chat.id}
                        onClick={() => { if (activeTgChatId !== chat.id) onTgChatClick(chat) }}
                        title={chat.title || `Chat ${chat.id}`}
                        previewMessage={chat.last_message?.content?.text?.text || ''}
                        isActive={activeTgChatId === chat.id}
                        unread={chat.unread_count || 0}
                    />
                ))}

                {tab === 'telegram' && (tgData || []).length === 0 && (
                    <div className={styles.emptyHint}>Чаты загружаются…</div>
                )}
            </div>

            <div className={styles.toolbar}>
                <button className={styles.toolbarBtn} title="Профиль">👤</button>
                <button className={styles.toolbarBtn} title="Чаты">💬</button>
                <button
                    className={styles.toolbarBtn}
                    title="Настройки Telegram"
                    onClick={onOpenSettings}
                >
                    ⚙️
                </button>
            </div>

            <div className={styles.draggableRightPart} onMouseDown={handleMouseDown} />
        </div>
    )
}

export default SideBar
