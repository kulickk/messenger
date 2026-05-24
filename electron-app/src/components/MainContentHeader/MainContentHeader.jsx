import ThreeDotsSvg from "../../assets/svg/ThreeDotsSvg.jsx"
import styles from "./MainContentHeader.module.css"

const MainContentHeader = ({ title, connected, status, onDotsClick }) => {
    let statusText
    let isOnline = false

    if (status) {
        statusText = status.text
        isOnline   = status.type === 'online'
    } else {
        statusText = connected ? 'подключено' : 'нет соединения'
        isOnline   = connected
    }

    return (
        <div className={styles.headerWrapper}>
            {title && <>
                <div className={styles.titleWrapper}>
                    <p className={styles.title}>{title}</p>
                    <p className={`${styles.status} ${isOnline ? styles.statusOnline : ''}`}>
                        {statusText}
                    </p>
                </div>
                <ThreeDotsSvg className={styles.threeDotsSvg} onClick={onDotsClick} />
            </>}
        </div>
    )
}

export default MainContentHeader
