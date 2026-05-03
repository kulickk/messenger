import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './Chat.module.css';
import ChatMessage from './ChatMessage.jsx';
import ContextMenu from './ContextMenu.jsx';

const Chat = ({ chat, td }) => {
    const [messages, setMessages]         = useState([]);
    const [loading, setLoading]           = useState(true);
    const [contextMenu, setContextMenu]   = useState(null); // { x, y, message }
    const [replyTo, setReplyTo]           = useState(null); // message being replied to
    const [selected, setSelected]         = useState(new Set());
    const [masks, setMasks]               = useState({}); // { [messageId]: { loading, text } }
    const [inputText, setInputText]       = useState('');

    const endRef    = useRef(null);
    const mountedRef = useRef(true);

    // ── Open/close chat for read receipts ─────────────────────────────────────
    useEffect(() => {
        if (!chat || !td) return;
        td.openChat(chat.id).catch(() => {});
        return () => { td.closeChat(chat.id).catch(() => {}); };
    }, [chat?.id, td]);

    // ── Load history ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!chat || !td) return;
        mountedRef.current = true;
        setMessages([]);
        setLoading(true);
        setContextMenu(null);
        setReplyTo(null);
        setSelected(new Set());
        setMasks({});

        td.getChatHistory(chat.id, 0, 0, 50)
            .then((result) => {
                if (!mountedRef.current) return;
                // TDLib returns newest first; reverse so oldest is at top
                setMessages((result.messages ?? []).slice().reverse());
            })
            .catch((err) => console.error('[Chat] getChatHistory:', err.message))
            .finally(() => { if (mountedRef.current) setLoading(false); });

        return () => { mountedRef.current = false; };
    }, [chat?.id, td]);

    // ── Live updates ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!chat || !td) return;
        const id = chat.id;

        const handler = (update) => {
            if (update['@type'] === 'updateNewMessage' && update.message.chat_id === id) {
                setMessages((prev) => [...prev, update.message]);
            }
            if (update['@type'] === 'updateMessageContent' && update.chat_id === id) {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === update.message_id ? { ...m, content: update.new_content } : m
                    )
                );
            }
            if (update['@type'] === 'updateDeleteMessages' && update.chat_id === id && !update.from_cache) {
                setMessages((prev) => prev.filter((m) => !update.message_ids.includes(m.id)));
            }
        };

        td.on('update', handler);
        return () => td.off('update', handler);
    }, [chat?.id, td]);

    // ── Scroll to bottom ──────────────────────────────────────────────────────
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: messages.length <= 50 ? 'instant' : 'smooth' });
    }, [messages]);

    // ── Context menu handlers ─────────────────────────────────────────────────
    const handleContextMenu = useCallback((e, message) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, message });
    }, []);

    const handleSelect = useCallback((message) => {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(message.id) ? next.delete(message.id) : next.add(message.id);
            return next;
        });
    }, []);

    const handleShowMask = useCallback(async (messageId, text) => {
        setMasks((prev) => ({ ...prev, [messageId]: { loading: true, text: null } }));
        try {
            // Stub: replace with real backend call when ready
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const result = `[Маска применена: "${(text || '').slice(0, 30)}${text?.length > 30 ? '...' : ''}"]`;
            setMasks((prev) => ({ ...prev, [messageId]: { loading: false, text: result } }));
        } catch {
            setMasks((prev) => ({ ...prev, [messageId]: { loading: false, text: null } }));
        }
    }, []);

    const handleHideMask = useCallback((messageId) => {
        setMasks((prev) => {
            const next = { ...prev };
            delete next[messageId];
            return next;
        });
    }, []);

    const handleSend = async () => {
        const text = inputText.trim();
        if (!text || !td || !chat) return;
        setInputText('');
        try {
            await td.sendMessage(chat.id, text, replyTo?.id ?? 0);
            setReplyTo(null);
        } catch (e) {
            console.warn('[Chat] sendMessage:', e.message);
        }
    };

    const handleInputKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!chat) return null;

    return (
        <div className={styles.container} onClick={() => setContextMenu(null)}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerAvatar} />
                <div className={styles.headerInfo}>
                    <span className={styles.headerTitle}>{chat.title}</span>
                    <span className={styles.headerSub}>
                        {chat.type?.['@type']?.replace('chatType', '') || ''}
                    </span>
                </div>
                {selected.size > 0 && (
                    <span className={styles.selectionCount}>{selected.size} выбрано</span>
                )}
            </div>

            {/* Messages */}
            <div className={styles.messages}>
                {loading && <div className={styles.loadingMsg}>Загрузка сообщений...</div>}
                {!loading && messages.length === 0 && (
                    <div className={styles.emptyMsg}>Нет сообщений</div>
                )}
                {messages.map((msg) => (
                    <ChatMessage
                        key={msg.id}
                        message={msg}
                        td={td}
                        override={masks[msg.id]}
                        isSelected={selected.has(msg.id)}
                        onContextMenu={(e) => handleContextMenu(e, msg)}
                    />
                ))}
                <div ref={endRef} />
            </div>

            {/* Reply bar */}
            {replyTo && (
                <div className={styles.replyBar}>
                    <div className={styles.replyContent}>
                        <span className={styles.replyLabel}>Ответить:</span>
                        <span className={styles.replyText}>
                            {replyTo.content?.text?.text?.slice(0, 60) ||
                             replyTo.content?.['@type']?.replace('message', '') ||
                             'Сообщение'}
                        </span>
                    </div>
                    <button className={styles.replyClose} onClick={() => setReplyTo(null)}>✕</button>
                </div>
            )}

            {/* Message input */}
            <div className={styles.inputBar}>
                <textarea
                    className={styles.inputField}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Сообщение"
                    rows={1}
                />
                <button
                    className={styles.sendBtn}
                    onClick={handleSend}
                    disabled={!inputText.trim()}
                >
                    ➤
                </button>
            </div>

            {/* Context menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    message={contextMenu.message}
                    chatId={chat.id}
                    td={td}
                    onClose={() => setContextMenu(null)}
                    onReply={setReplyTo}
                    onSelect={handleSelect}
                    onShowMask={handleShowMask}
                    onHideMask={handleHideMask}
                    hasMask={!!masks[contextMenu.message.id]?.text}
                />
            )}
        </div>
    );
};

export default Chat;
