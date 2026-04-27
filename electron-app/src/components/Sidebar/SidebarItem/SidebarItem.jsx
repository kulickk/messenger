import styles from "./SideBarItem.module.css"

const SideBarItem = ({isActive=false, title="", previewMessage="", onClick, ac}) => {
    return(
        <div onClick={onClick} className={ `${styles.sidebarItem} ${(isActive) ? styles.isActive : ''}` }>
            <div className={ styles.sidebarAvatar }/>
            <div className={ styles.sidebarItemTextContainer }>
                <span className={ styles.sidebarItemTitle }>{title}</span>
                <span>{previewMessage}</span>
            </div>
        </div>
    );
};

export default SideBarItem;