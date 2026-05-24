import { useState, useEffect } from 'react'
import styles from './UserProfileModal.module.css'

function colorFor(str) {
    const palette = ['#F4845F','#5B9BD5','#56B38E','#E8775C','#A78BFA','#F59E0B','#10B981','#3B82F6','#EC4899','#8B5CF6']
    let h = 0
    for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
    return palette[h % palette.length]
}

const UserProfileModal = ({ userId, title, avatarUrl, onClose }) => {
    const [info,    setInfo]    = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!userId) { setLoading(false); return }
        window.tg.getUserInfo(userId).then(data => {
            setInfo(data)
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [userId])

    const displayName = info
        ? [info.firstName, info.lastName].filter(Boolean).join(' ') || title
        : title
    const username    = info?.username || ''
    const about       = info?.about || ''
    const phone       = info?.phone || ''
    const memberCount = info?.memberCount ?? null
    const isChannel   = info?.isChannel ?? false

    const birthdayStr = (() => {
        const b = info?.birthday
        if (!b) return ''
        const months = ['января','февраля','марта','апреля','мая','июня',
                        'июля','августа','сентября','октября','ноября','декабря']
        const month = months[b.month - 1] ?? ''
        return b.year ? `${b.day} ${month} ${b.year}` : `${b.day} ${month}`
    })()

    const bg = colorFor(displayName)
    const initial = (displayName || '?')[0].toUpperCase()

    return (
        <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className={styles.modal}>
                <button className={styles.closeBtn} onClick={onClose}>✕</button>

                <div className={styles.avatarWrap}>
                    <div className={styles.avatar} style={{ background: avatarUrl ? 'transparent' : bg }}>
                        {avatarUrl
                            ? <img src={avatarUrl} className={styles.avatarImg} alt="" />
                            : <span className={styles.avatarInitial}>{initial}</span>
                        }
                    </div>
                    <h2 className={styles.name}>{displayName}</h2>
                    {username && <p className={styles.username}>@{username}</p>}
                </div>

                {loading && <p className={styles.hint}>Загрузка…</p>}

                {!loading && (
                    <div className={styles.infoList}>
                        {about && (
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>О себе</span>
                                <span className={styles.infoValue}>{about}</span>
                            </div>
                        )}
                        {phone && (
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>Телефон</span>
                                <span className={styles.infoValue}>{phone}</span>
                            </div>
                        )}
                        {birthdayStr && (
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>День рождения</span>
                                <span className={styles.infoValue}>{birthdayStr}</span>
                            </div>
                        )}
                        {memberCount !== null && (
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>{isChannel ? 'Подписчиков' : 'Участников'}</span>
                                <span className={styles.infoValue}>{memberCount.toLocaleString('ru-RU')}</span>
                            </div>
                        )}
                        {!about && !phone && !birthdayStr && memberCount === null && (
                            <p className={styles.hint}>Нет дополнительной информации</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default UserProfileModal
