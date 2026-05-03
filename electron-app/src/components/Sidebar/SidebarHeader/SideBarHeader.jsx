import styles from "./SideBarHeader.module.css"
import ThreeLinesSvg from "../../../assets/svg/ThreeLinesSvg.jsx"


const SideBarHeader = ({ searchQuery = '', onSearch }) => {
    return(
        <div className={ styles.headerContaner }>
            <button className={ styles.svgButton }>
                <ThreeLinesSvg className={ styles.svgContainer }/>
            </button>
            <input
                type="text"
                placeholder="Поиск"
                className={ styles.searchLine }
                value={searchQuery}
                onChange={(e) => onSearch?.(e.target.value)}
            />
        </div>
    );
};

export default SideBarHeader;