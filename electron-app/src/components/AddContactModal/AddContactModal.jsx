import { useState } from 'react'
import styles from './AddContactModal.module.css'

const AddContactModal = ({ keyServerUrl, onAdd, onClose }) => {
    const [value,   setValue]   = useState('')
    const [status,  setStatus]  = useState({ msg: '', ok: null })
    const [loading, setLoading] = useState(false)

    const check = async (id) => {
        if (!id) return
        setLoading(true)
        setStatus({ msg: 'Проверяем...', ok: null })
        try {
            const res = await fetch(`${keyServerUrl}/${id}`)
            if (res.ok) {
                setStatus({ msg: `✓ Пользователь ${id} найден`, ok: true })
            } else {
                setStatus({ msg: 'Пользователь не найден — попросите его запустить приложение', ok: false })
            }
        } catch {
            setStatus({ msg: 'Не удалось подключиться к серверу', ok: false })
        }
        setLoading(false)
    }

    const handleChange = (e) => {
        setValue(e.target.value)
        setStatus({ msg: '', ok: null })
    }

    const handleBlur = () => { if (value.trim()) check(value.trim()) }

    const handleAdd = () => {
        const id = value.trim()
        if (!id || status.ok !== true) return
        onAdd({ id, title: id, previewMessage: '' })
        onClose()
    }

    const handleKey = (e) => {
        if (e.key === 'Enter') { if (status.ok === true) handleAdd(); else check(value.trim()) }
        if (e.key === 'Escape') onClose()
    }

    const statusClass = status.ok === true ? styles.statusOk : status.ok === false ? styles.statusErr : styles.status

    return (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className={styles.modal}>
                <div className={styles.title}>Добавить контакт</div>
                <input
                    className={styles.input}
                    placeholder="ID пользователя (например: bob)"
                    value={value}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKey}
                    autoFocus
                    disabled={loading}
                />
                <div className={`${styles.status} ${statusClass}`}>{status.msg}</div>
                <div className={styles.actions}>
                    <button className={styles.btnCancel} onClick={onClose}>Отмена</button>
                    <button className={styles.btnAdd} onClick={handleAdd} disabled={status.ok !== true}>
                        Добавить
                    </button>
                </div>
            </div>
        </div>
    )
}

export default AddContactModal
