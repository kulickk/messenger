import styles from './SideBarHeader.module.css'
import ThreeLinesSvg from '../../../assets/svg/ThreeLinesSvg.jsx'

const SideBarHeader = ({ onOpenSettings, query, onQuery }) => {
    return (
        <div className={styles.headerContaner}>
            <button className={styles.svgButton} title="Настройки" onClick={onOpenSettings}>
                <ThreeLinesSvg />
            </button>
            <input
                type="text"
                placeholder="Поиск"
                className={styles.searchLine}
                value={query}
                onChange={e => onQuery(e.target.value)}
            />
        </div>
    )
}

export default SideBarHeader
