import { useState, useEffect, useRef } from 'react'
import MainContentHeader from '../MainContentHeader/MainContentHeader.jsx'
import styles from './MainContent.module.css'

function formatTime(id) {
    const d = new Date(id > 1e12 ? id : Date.now())
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

const MainContent = ({ activeItem, messages = [], connected, onSend }) => {
    const [text, setText]  = useState('')
    const bottomRef        = useRef(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

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
            <MainContentHeader title={activeItem.title} connected={connected} />

            <div className={styles.messageList}>
                {messages.map(m => (
                    <div key={m.id} className={`${styles.bubbleRow} ${m.self ? styles.bubbleRowSelf : styles.bubbleRowOther}`}>
                        <div className={`${styles.bubble} ${m.self ? styles.bubbleSelf : styles.bubbleOther}`}>
                            {m.text}
                            <div className={styles.bubbleMeta}>
                                <span className={styles.time}>{formatTime(m.id)}</span>
                            </div>
                        </div>
                        {!m.self && m.mask && (
                            <span className={styles.mask}>«{m.mask}»</span>
                        )}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            <div className={styles.inputArea}>
                <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Сообщение"
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
