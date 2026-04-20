import ThreeDotsSvg from "../../assets/svg/ThreeDotsSvg.jsx";
import styles from "./MainContentHeader.module.css"

const MainContentHeader = ({title}) => {

    return(
        <div className={styles.headerWrapper}>
            {(title) ? 
            <>
            <div className={styles.titleWrapper}>
                <p className={styles.title}>{title}</p>
                <p className={styles.status}>Онлайн</p>
            </div>
            <ThreeDotsSvg className={styles.threeDotsSvg}/>
            </>
            : ""}
        </div>
    );
};

export default MainContentHeader;