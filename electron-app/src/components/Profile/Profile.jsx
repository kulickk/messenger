import { useState, useEffect, useRef } from 'react';
import styles from './Profile.module.css';
import { useTDLibFile } from '../../hooks/useTDLibFile.js';

function getStatusText(status) {
    if (!status) return '';
    switch (status['@type']) {
        case 'userStatusOnline':    return 'Онлайн';
        case 'userStatusOffline': {
            const d = new Date(status.was_online * 1000);
            return `Был(а) ${d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
        }
        case 'userStatusRecently':   return 'Был(а) недавно';
        case 'userStatusLastWeek':   return 'Был(а) на этой неделе';
        case 'userStatusLastMonth':  return 'Был(а) в этом месяце';
        default:                     return '';
    }
}

function CopyField({ label, value }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className={styles.field}>
            <span className={styles.fieldLabel}>{label}</span>
            <div className={styles.fieldRow}>
                <span className={styles.fieldValue}>{value}</span>
                <button className={styles.copyBtn} onClick={handleCopy} title="Копировать">
                    {copied ? '✓' : '⧉'}
                </button>
            </div>
        </div>
    );
}

const Profile = ({ user, td, onBack, onLogout }) => {
    const [fullInfo, setFullInfo]   = useState(null);
    const [editing, setEditing]     = useState(false);
    const [firstName, setFirstName] = useState(user.first_name ?? '');
    const [lastName, setLastName]   = useState(user.last_name  ?? '');
    const [bio, setBio]             = useState('');
    const [saving, setSaving]       = useState(false);
    const [saveError, setSaveError] = useState('');

    const avatarFile = user.profile_photo?.small ?? null;
    const avatarUrl  = useTDLibFile(avatarFile, td, 'image/jpeg');

    const username = user.username
        ?? user.usernames?.activeUsernames?.[0]
        ?? null;

    // Load full info (bio, birthdate)
    useEffect(() => {
        td.getUserFullInfo(user.id)
            .then((info) => {
                setFullInfo(info);
                setBio(info.bio?.text ?? '');
            })
            .catch(() => {});
    }, [user.id, td]);

    const handleSave = async () => {
        setSaving(true);
        setSaveError('');
        try {
            await td.setName(firstName.trim(), lastName.trim());
            await td.setBio(bio);
            setEditing(false);
        } catch (e) {
            setSaveError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setFirstName(user.first_name ?? '');
        setLastName(user.last_name  ?? '');
        setBio(fullInfo?.bio?.text ?? '');
        setSaveError('');
        setEditing(false);
    };

    const birthdate = fullInfo?.birthdate;
    const birthdateStr = birthdate
        ? [birthdate.day, birthdate.month, birthdate.year].filter(Boolean).join('.')
        : null;

    return (
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.header}>
                <button className={styles.backBtn} onClick={onBack}>← Назад</button>
                <h2 className={styles.headerTitle}>Профиль</h2>
                {!editing ? (
                    <button className={styles.editBtn} onClick={() => setEditing(true)}>Изменить</button>
                ) : (
                    <div className={styles.editActions}>
                        <button className={styles.cancelBtn} onClick={handleCancel}>Отмена</button>
                        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                            {saving ? '...' : 'Сохранить'}
                        </button>
                    </div>
                )}
            </div>

            <div className={styles.content}>
                {/* Avatar + name */}
                <div className={styles.hero}>
                    <div className={styles.avatarWrap}>
                        {avatarUrl ? (
                            <img src={avatarUrl} className={styles.avatar} alt="Avatar" />
                        ) : (
                            <div className={styles.avatarFallback}>
                                {(user.first_name?.[0] ?? '?').toUpperCase()}
                            </div>
                        )}
                        <div className={`${styles.statusDot} ${user.status?.['@type'] === 'userStatusOnline' ? styles.online : ''}`} />
                    </div>

                    {editing ? (
                        <div className={styles.nameEdit}>
                            <input
                                className={styles.nameInput}
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="Имя"
                            />
                            <input
                                className={styles.nameInput}
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="Фамилия"
                            />
                        </div>
                    ) : (
                        <div className={styles.heroInfo}>
                            <div className={styles.fullName}>
                                {user.first_name} {user.last_name}
                            </div>
                            <div className={styles.status}>{getStatusText(user.status)}</div>
                        </div>
                    )}
                </div>

                {/* Bio */}
                {editing ? (
                    <div className={styles.section}>
                        <div className={styles.sectionLabel}>О себе</div>
                        <textarea
                            className={styles.bioInput}
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Расскажите о себе..."
                            rows={3}
                        />
                    </div>
                ) : (
                    bio && (
                        <div className={styles.section}>
                            <div className={styles.sectionLabel}>О себе</div>
                            <p className={styles.bioText}>{bio}</p>
                        </div>
                    )
                )}

                {saveError && <p className={styles.error}>{saveError}</p>}

                {/* Detail fields */}
                <div className={styles.section}>
                    {username && (
                        <CopyField label="Имя пользователя" value={`@${username}`} />
                    )}
                    {user.phone_number && (
                        <CopyField label="Номер телефона" value={`+${user.phone_number}`} />
                    )}
                    {birthdateStr && (
                        <div className={styles.field}>
                            <span className={styles.fieldLabel}>День рождения</span>
                            <span className={styles.fieldValue}>{birthdateStr}</span>
                        </div>
                    )}
                </div>

                <button className={styles.logoutBtn} onClick={onLogout}>
                    Выйти из аккаунта
                </button>
            </div>
        </div>
    );
};

export default Profile;
