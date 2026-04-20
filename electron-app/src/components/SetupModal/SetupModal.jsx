import { useState } from 'react'
import styles from './SetupModal.module.css'

const SetupModal = ({ onDone }) => {
    const [value, setValue] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = () => {
        const id = value.trim()
        if (!id) { setError('Введите идентификатор'); return }
        if (!/^[a-zA-Z0-9_\-]+$/.test(id)) { setError('Только латинские буквы, цифры, _ и -'); return }
        onDone(id)
    }

    const handleKey = (e) => { if (e.key === 'Enter') handleSubmit() }

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.logo}>🔐</div>
                <div className={styles.title}>Добро пожаловать</div>
                <div className={styles.subtitle}>
                    Придумайте свой идентификатор — по нему вас найдут собеседники.<br/>
                    Например: <strong>alice</strong>, <strong>ivan_99</strong>
                </div>
                <input
                    className={styles.input}
                    placeholder="Ваш ID (например: alice)"
                    value={value}
                    onChange={e => { setValue(e.target.value); setError('') }}
                    onKeyDown={handleKey}
                    autoFocus
                />
                <div className={styles.error}>{error}</div>
                <button className={styles.btn} onClick={handleSubmit} disabled={!value.trim()}>
                    Начать
                </button>
            </div>
        </div>
    )
}

export default SetupModal
