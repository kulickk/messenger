import { useState } from 'react'
import styles from './TelegramAuth.module.css'

const TelegramAuth = ({ authState, authError, onPhone, onCode, onPassword, onQrLogin, qrDataUrl, onOpenSettings }) => {
    const [phone,    setPhone]    = useState('')
    const [code,     setCode]     = useState('')
    const [password, setPassword] = useState('')
    const [err,      setErr]      = useState('')

    const wrap = (fn) => async () => {
        setErr('')
        try { await fn() } catch (e) { setErr(String(e)) }
    }

    const handleKey = (cb) => (e) => { if (e.key === 'Enter') cb() }

    if (authState === 'loading') {
        return (
            <div className={styles.wrap}>
                <div className={styles.card}>
                    <div className={styles.spinner}>⏳</div>
                    <div className={styles.title}>Подключение к Telegram…</div>
                </div>
            </div>
        )
    }

    if (authState === 'phone') {
        const submit = wrap(() => { if (phone.trim()) onPhone(phone.trim()) })
        return (
            <div className={styles.wrap}>
                <div className={styles.card}>
                    <div className={styles.logo}>📱</div>
                    <div className={styles.title}>Войти в Telegram</div>
                    <div className={styles.hint}>Введите номер телефона в международном формате</div>
                    <input
                        className={styles.input}
                        placeholder="+79001234567"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        onKeyDown={handleKey(submit)}
                        autoFocus
                    />
                    <div className={styles.error}>{err || authError}</div>
                    <button className={styles.btn} onClick={submit} disabled={!phone.trim()}>
                        Далее
                    </button>
                    <button className={styles.btnSecondary} onClick={onQrLogin}>
                        Войти по QR-коду
                    </button>
                </div>
            </div>
        )
    }

    if (authState === 'qr') {
        return (
            <div className={styles.wrap}>
                <div className={styles.card}>
                    <div className={styles.title}>Войти по QR-коду</div>
                    <div className={styles.qrWrap}>
                        {qrDataUrl
                            ? <img src={qrDataUrl} className={styles.qrImg} alt="QR код" />
                            : <div className={styles.qrPlaceholder}>
                                <div className={styles.qrSpinner} />
                              </div>
                        }
                    </div>
                    <ol className={styles.steps}>
                        <li>Откройте <b>Telegram</b> на телефоне</li>
                        <li>Настройки → <b>Устройства</b></li>
                        <li>Нажмите <b>Подключить устройство</b></li>
                        <li>Наведите камеру на QR-код</li>
                    </ol>
                    <div className={styles.error}>{authError}</div>
                </div>
            </div>
        )
    }

    if (authState === 'code') {
        const submit = wrap(() => { if (code.trim()) onCode(code.trim()) })
        return (
            <div className={styles.wrap}>
                <div className={styles.card}>
                    <div className={styles.logo}>💬</div>
                    <div className={styles.title}>Код подтверждения</div>
                    <div className={styles.hint}>Telegram отправил код в приложение или SMS</div>
                    <input
                        className={styles.input}
                        placeholder="12345"
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        onKeyDown={handleKey(submit)}
                        autoFocus
                    />
                    <div className={styles.error}>{err || authError}</div>
                    <button className={styles.btn} onClick={submit} disabled={!code.trim()}>
                        Подтвердить
                    </button>
                </div>
            </div>
        )
    }

    if (authState === 'password') {
        const submit = wrap(() => { if (password.trim()) onPassword(password.trim()) })
        return (
            <div className={styles.wrap}>
                <div className={styles.card}>
                    <div className={styles.logo}>🔒</div>
                    <div className={styles.title}>Двухфакторная аутентификация</div>
                    <div className={styles.hint}>Введите пароль двухфакторной защиты</div>
                    <input
                        className={styles.input}
                        type="password"
                        placeholder="Пароль 2FA"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={handleKey(submit)}
                        autoFocus
                    />
                    <div className={styles.error}>{err || authError}</div>
                    <button className={styles.btn} onClick={submit} disabled={!password.trim()}>
                        Войти
                    </button>
                </div>
            </div>
        )
    }

    if (authState === 'error') {
        return (
            <div className={styles.wrap}>
                <div className={styles.card}>
                    <div className={styles.logo}>⚠️</div>
                    <div className={styles.title}>Ошибка TDLib</div>
                    <div className={styles.hint} style={{ color: '#FF3B30' }}>{authError}</div>
                    <button className={styles.btn} onClick={onOpenSettings}>Проверить настройки</button>
                </div>
            </div>
        )
    }

    return null
}

export default TelegramAuth
