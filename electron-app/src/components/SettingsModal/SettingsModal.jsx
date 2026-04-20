import { useState } from 'react'
import styles from './SettingsModal.module.css'
import { saveTgCredentials, getTgCredentials } from '../../hooks/useTelegram.js'

const SettingsModal = ({ onClose, onSaved }) => {
    const existing = getTgCredentials() || {}
    const [apiId,   setApiId]   = useState(existing.apiId   || '')
    const [apiHash, setApiHash] = useState(existing.apiHash || '')
    const [error,   setError]   = useState('')

    const handleSave = () => {
        const id   = apiId.trim()
        const hash = apiHash.trim()
        if (!id || !/^\d+$/.test(id))          { setError('api_id — только цифры'); return }
        if (!hash || hash.length < 10)          { setError('api_hash слишком короткий'); return }
        saveTgCredentials({ apiId: id, apiHash: hash })
        onSaved?.()
        onClose()
    }

    const handleKey = (e) => { if (e.key === 'Enter') handleSave() }

    return (
        <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className={styles.modal}>
                <div className={styles.logo}>⚙️</div>
                <div className={styles.title}>Настройки Telegram</div>
                <div className={styles.subtitle}>
                    Получите <strong>api_id</strong> и <strong>api_hash</strong> на{' '}
                    <strong>my.telegram.org</strong> → API development tools.
                </div>

                <label className={styles.label}>api_id</label>
                <input
                    className={styles.input}
                    placeholder="123456"
                    value={apiId}
                    onChange={e => { setApiId(e.target.value); setError('') }}
                    onKeyDown={handleKey}
                    autoFocus
                />

                <label className={styles.label}>api_hash</label>
                <input
                    className={styles.input}
                    placeholder="abcdef1234567890abcdef1234567890"
                    value={apiHash}
                    onChange={e => { setApiHash(e.target.value); setError('') }}
                    onKeyDown={handleKey}
                />

                <div className={styles.error}>{error}</div>

                <div className={styles.actions}>
                    <button className={styles.cancelBtn} onClick={onClose}>Отмена</button>
                    <button className={styles.btn} onClick={handleSave} disabled={!apiId.trim() || !apiHash.trim()}>
                        Сохранить
                    </button>
                </div>
            </div>
        </div>
    )
}

export default SettingsModal
