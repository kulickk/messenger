import { useState } from 'react';
import styles from "./SideBar.module.css";
import SideBarHeader from "./SidebarHeader/SideBarHeader.jsx";
import SideBarItem from "./SidebarItem/SidebarItem.jsx";
import { useResizeSidebar } from "../../hooks/useResizeSidebar.js";

const SideBar = ({ chats = [], onSidebarClick, activeItem, onProfileClick }) => {
    const [navigation, handleMouseDown] = useResizeSidebar();
    const [search, setSearch] = useState('');

    const visibleChats = search.trim()
        ? chats.filter((c) =>
              (c.title || '').toLowerCase().includes(search.trim().toLowerCase())
          )
        : chats;

    return (
        <div className={styles.sidemenu} ref={navigation}>
            <SideBarHeader searchQuery={search} onSearch={setSearch} />
            <div className={styles.sideContent}>
                {visibleChats.length === 0 ? (
                    <div className={styles.emptyChats}>{search ? 'Ничего не найдено' : 'Нет чатов'}</div>
                ) : (
                    visibleChats.map((chat) => (
                        <SideBarItem
                            key={chat.id}
                            onClick={() => activeItem !== chat.id && onSidebarClick(chat)}
                            title={chat.title || 'Без названия'}
                            previewMessage={chat.last_message?.content?.text?.text || ''}
                            isActive={activeItem === chat.id}
                        />
                    ))
                )}
            </div>
            <div className={styles.sideFooter}>
                <button className={styles.profileBtn} onClick={onProfileClick}>
                    Профиль
                </button>
            </div>
            <div className={styles.draggableRightPart} onMouseDown={handleMouseDown} />
        </div>
    );
};

export default SideBar;
