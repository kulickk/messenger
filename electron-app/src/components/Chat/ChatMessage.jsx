import styles from './ChatMessage.module.css';
import { useTDLibFile } from '../../hooks/useTDLibFile.js';

function PhotoContent({ content, td }) {
    const sizes = content.photo?.sizes ?? [];
    // Prefer 'm' size for preview; fall back to first available
    const size = sizes.find((s) => s.type === 'm') ?? sizes[0];
    const url = useTDLibFile(size?.photo, td, 'image/jpeg');
    const mini = content.photo?.minithumbnail;

    const placeholder = mini
        ? `data:image/jpeg;base64,${mini.data}`
        : null;

    return (
        <div className={styles.photoWrapper}>
            {url ? (
                <img src={url} className={styles.photo} alt="" />
            ) : placeholder ? (
                <img src={placeholder} className={`${styles.photo} ${styles.blurred}`} alt="" />
            ) : (
                <div className={styles.mediaPlaceholder}>Фото</div>
            )}
            {content.caption?.text && (
                <span className={styles.caption}>{content.caption.text}</span>
            )}
        </div>
    );
}

function VideoThumbContent({ content, td }) {
    const thumb = content.video?.thumbnail;
    const url = useTDLibFile(thumb?.file, td, 'image/jpeg');
    return (
        <div className={styles.videoWrapper}>
            {url ? (
                <div className={styles.videoThumb}>
                    <img src={url} className={styles.photo} alt="" />
                    <div className={styles.playIcon}>▶</div>
                </div>
            ) : (
                <div className={styles.mediaPlaceholder}>Видео</div>
            )}
            {content.caption?.text && (
                <span className={styles.caption}>{content.caption.text}</span>
            )}
        </div>
    );
}

function renderContent(content, td) {
    switch (content['@type']) {
        case 'messageText':
            return <span className={styles.text}>{content.text.text}</span>;
        case 'messagePhoto':
            return <PhotoContent content={content} td={td} />;
        case 'messageVideo':
            return <VideoThumbContent content={content} td={td} />;
        case 'messageDocument':
            return (
                <span className={styles.media}>
                    📎 {content.document.file_name}
                    {content.caption?.text ? ` — ${content.caption.text}` : ''}
                </span>
            );
        case 'messageSticker':
            return <span className={styles.media}>{content.sticker.emoji} Стикер</span>;
        case 'messageVoiceNote':
            return <span className={styles.media}>🎤 Голосовое сообщение</span>;
        case 'messageVideoNote':
            return <span className={styles.media}>🎥 Видеосообщение</span>;
        case 'messageAnimation':
            return <span className={styles.media}>🎞 GIF</span>;
        case 'messagePoll':
            return <span className={styles.media}>📊 Опрос: {content.poll.question.text}</span>;
        case 'messageCall':
            return <span className={styles.media}>📞 Звонок</span>;
        case 'messageLocation':
            return <span className={styles.media}>📍 Местоположение</span>;
        default:
            return <span className={styles.media}>[{content['@type'].replace('message', '')}]</span>;
    }
}

const ChatMessage = ({ message, td, override, isSelected, onContextMenu }) => {
    const isOutgoing = message.is_outgoing;
    const time = new Date(message.date * 1000).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
    });

    const content = (() => {
        if (override?.loading) {
            return (
                <span className={styles.maskLoading}>
                    <span className={styles.spinner} /> Обработка маски...
                </span>
            );
        }
        if (override?.text != null) {
            return <span className={styles.maskResult}>{override.text}</span>;
        }
        return renderContent(message.content, td);
    })();

    return (
        <div
            className={[
                styles.message,
                isOutgoing ? styles.outgoing : styles.incoming,
                isSelected ? styles.selected : '',
            ].join(' ')}
            onContextMenu={onContextMenu}
        >
            <div className={styles.bubble}>
                {content}
                <span className={styles.time}>{time}</span>
            </div>
        </div>
    );
};

export default ChatMessage;
