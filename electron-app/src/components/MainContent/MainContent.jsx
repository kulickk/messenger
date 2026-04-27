import MainContentHeader from "../MainContentHeader/MainContentHeader.jsx";
import styles from "./MainContent.module.css"

const MainContent = ({data, activeItem}) => {

    return(
        <>
        <MainContentHeader title={activeItem?.title}/>
        <div className={ styles.contentWrapper }>
            {activeItem?.previewMessage}
        </div>
        </>
    );
};

export default MainContent;