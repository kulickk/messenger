import styles from "./SideBarHeader.module.css"
import ThreeLinesSvg from "../../../assets/svg/ThreeLinesSvg.jsx"


const SideBarHeader = () => {
    return(
        <div className={ styles.headerContaner }>
            <button className={ styles.svgButton }>
                <ThreeLinesSvg className={ styles.svgContainer }/>
            </button>
            <input type="text" placeholder="Поиск" className={ styles.searchLine }/>
        </div>
    );
};

export default SideBarHeader;