import { useState, useEffect } from 'react'
import styles from './SettingsModal.module.css'

function colorFor(str) {
    const palette = ['#F4845F','#5B9BD5','#56B38E','#E8775C','#A78BFA','#F59E0B','#10B981','#3B82F6','#EC4899','#8B5CF6']
    let h = 0
    for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
    return palette[h % palette.length]
}

const SettingsModal = ({ onClose, myProfile, myAvatarUrl, onLogout }) => {
    const [firstName,      setFirstName]      = useState('')
    const [lastName,       setLastName]       = useState('')
    const [username,       setUsername]       = useState('')
    const [about,          setAbout]          = useState('')
    const [initialUsername, setInitialUsername] = useState('')
    const [loading,        setLoading]        = useState(true)
    const [saving,         setSaving]         = useState(false)
    const [status,         setStatus]         = useState('')

    useEffect(() => {
        window.tg.getFullMe().then(me => {
            setFirstName(me.firstName || '')
            setLastName(me.lastName   || '')
            setUsername(me.username   || '')
            setInitialUsername(me.username || '')
            setAbout(me.about         || '')
            setLoading(false)
        }).catch(() => {
            if (myProfile) {
                setFirstName(myProfile.firstName || '')
                setUsername(myProfile.username   || '')
                setInitialUsername(myProfile.username || '')
            }
            setLoading(false)
        })
    }, [])

    const handleSave = async () => {
        setSaving(true)
        setStatus('')
        try {
            await window.tg.updateProfile({ firstName, lastName, about })

            const trimmed = username.trim().toLowerCase()
            if (trimmed !== initialUsername.trim().toLowerCase()) {
                try {
                    await window.tg.updateUsername(trimmed)
                    setInitialUsername(trimmed)
                    setUsername(trimmed)
                } catch (e) {
                    const msg = e.message || ''
                    if (msg.includes('USERNAME_OCCUPIED'))
                        setStatus('error:Имя пользователя @' + trimmed + ' уже занято')
                    else if (msg.includes('USERNAME_INVALID'))
                        setStatus('error:Недопустимое имя пользователя')
                    else
                        setStatus('error:' + msg)
                    setSaving(false)
                    return
                }
            }
            setStatus('saved')
        } catch (e) {
            setStatus('error:' + (e.message || 'ошибка'))
        } finally {
            setSaving(false)
        }
    }

    const handleLogout = () => { onLogout?.(); onClose() }

    const displayName = firstName || myProfile?.firstName || '?'
    const bg = colorFor(displayName)

    return (
        <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className={styles.modal}>
                <div className={styles.profileCard}>
                    <div className={styles.profileAvatar} style={{ background: myAvatarUrl ? 'transparent' : bg }}>
                        {myAvatarUrl
                            ? <img src={myAvatarUrl} className={styles.profileAvatarImg} alt="" />
                            : <span className={styles.profileAvatarInitial}>{displayName[0].toUpperCase()}</span>
                        }
                    </div>
                    <div className={styles.profileInfo}>
                        <span className={styles.profileName}>{displayName} {lastName}</span>
                        {myProfile?.username && (
                            <span className={styles.profileUsername}>@{myProfile.username}</span>
                        )}
                    </div>
                </div>

                <div className={styles.divider} />

                {loading ? (
                    <div className={styles.loadingHint}>Загрузка…</div>
                ) : (
                    <>
                        <div className={styles.row}>
                            <div className={styles.field}>
                                <label className={styles.label}>Имя</label>
                                <input className={styles.input} value={firstName}
                                    onChange={e => setFirstName(e.target.value)} placeholder="Имя" />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>Фамилия</label>
                                <input className={styles.input} value={lastName}
                                    onChange={e => setLastName(e.target.value)} placeholder="Фамилия" />
                            </div>
                        </div>

                        <label className={styles.label}>Имя пользователя</label>
                        <div className={styles.usernameWrap}>
                            <span className={styles.usernameAt}>@</span>
                            <input className={`${styles.input} ${styles.usernameInput}`} value={username}
                                onChange={e => setUsername(e.target.value)} placeholder="username" />
                        </div>

                        <label className={styles.label}>О себе</label>
                        <textarea className={styles.textarea} value={about}
                            onChange={e => setAbout(e.target.value)}
                            placeholder="Напишите о себе…" rows={3} />

                        {status === 'saved' && (
                            <div className={styles.successMsg}>✓ Профиль обновлён</div>
                        )}
                        {status.startsWith('error:') && (
                            <div className={styles.errorMsg}>{status.slice(6)}</div>
                        )}

                        <div className={styles.actions}>
                            <button className={styles.cancelBtn} onClick={onClose}>Закрыть</button>
                            <button className={styles.btn} onClick={handleSave} disabled={saving}>
                                {saving ? 'Сохранение…' : 'Сохранить'}
                            </button>
                        </div>
                    </>
                )}

                <div className={styles.divider} />
                <button className={styles.logoutBtn} onClick={handleLogout}>Выйти из аккаунта</button>
            </div>
        </div>
    )
}

export default SettingsModal
