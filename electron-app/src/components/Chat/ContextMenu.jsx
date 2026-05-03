import { useEffect, useRef } from 'react';
import styles from './ContextMenu.module.css';

const MENU_W = 210;
const MENU_H = 290;

function getMessageText(message) {
    const c = message?.content;
    if (!c) return '';
    switch (c['@type']) {
        case 'messageText':     return c.text?.text ?? '';
        case 'messagePhoto':    return c.caption?.text ?? '';
        case 'messageVideo':    return c.caption?.text ?? '';
        case 'messageDocument': return c.document?.file_name ?? '';
        default:                return '';
    }
}

const ContextMenu = ({ x, y, message, chatId, td, onClose, onReply, onSelect, onShowMask, onHideMask, hasMask }) => {
    const menuRef = useRef(null);

    // Adjust position to stay within viewport
    const adjX = x + MENU_W > window.innerWidth  ? x - MENU_W : x;
    const adjY = y + MENU_H > window.innerHeight ? y - MENU_H : y;

    // Dismiss on Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const actions = [
        {
            label: 'Выбрать',
            icon: '◻',
            onClick: () => { onSelect(message); onClose(); },
        },
        {
            label: 'Ответить',
            icon: '↩',
            onClick: () => { onReply(message); onClose(); },
        },
        {
            label: 'Копировать',
            icon: '⧉',
            onClick: () => {
                const text = getMessageText(message);
                if (text) navigator.clipboard.writeText(text).catch(() => {});
                onClose();
            },
        },
        {
            label: 'Закрепить',
            icon: '📌',
            onClick: async () => {
                onClose();
                try {
                    await td.pinChatMessage(chatId, message.id);
                } catch (e) {
                    console.warn('[ContextMenu] pin failed:', e.message);
                }
            },
        },
        {
            label: hasMask ? 'Скрыть маску' : 'Показать маску',
            icon: '🎭',
            accent: true,
            onClick: () => {
                if (hasMask) {
                    onHideMask(message.id);
                } else {
                    onShowMask(message.id, getMessageText(message));
                }
                onClose();
            },
        },
    ];

    return (
        <>
            <div className={styles.overlay} onClick={onClose} />
            <div
                ref={menuRef}
                className={styles.menu}
                style={{ left: adjX, top: adjY }}
                onClick={(e) => e.stopPropagation()}
            >
                {actions.map((action) => (
                    <button
                        key={action.label}
                        className={`${styles.item} ${action.accent ? styles.accent : ''}`}
                        onClick={action.onClick}
                    >
                        <span className={styles.icon}>{action.icon}</span>
                        {action.label}
                    </button>
                ))}
            </div>
        </>
    );
};

export default ContextMenu;
