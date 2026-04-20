import styles from './SideBarHeader.module.css'
import ThreeLinesSvg from '../../../assets/svg/ThreeLinesSvg.jsx'

const SideBarHeader = ({ onAddContact }) => {
    return (
        <div className={styles.headerContaner}>
            <button className={styles.svgButton} title="Меню">
                <ThreeLinesSvg />
            </button>
            <input type="text" placeholder="Поиск" className={styles.searchLine} />
            <button className={styles.addBtn} onClick={onAddContact} title="Добавить контакт">＋</button>
        </div>
    )
}

export default SideBarHeader
