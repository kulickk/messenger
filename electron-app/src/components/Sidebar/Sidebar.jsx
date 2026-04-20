import styles from "./SideBar.module.css"
import SideBarHeader from "./SidebarHeader/SideBarHeader.jsx";
import SideBarItem from "./SidebarItem/SidebarItem.jsx";
// mock
import chats from "../../mock/sidebar.js";
import { useResizeSidebar } from "../../hooks/useResizeSidebar.js";

const SideBar = ({data, onSidebarClick, activeItem}) => {
    const [navigation, handleMouseDown] = useResizeSidebar();

    if (!data) return;

    return(
        <div className={ styles.sidemenu } ref={ navigation }>
            {/* Сайдбар */}
            <SideBarHeader />
            <div className={ styles.sideContent }>
                {/* Контент сайдбара */}
                {data.map((chat) => {
                    const {id, title, previewMessage} = chat;

                    const clickHandler = (e) => {
                        if (activeItem === chat.id) return;
                        onSidebarClick(chat);
                    };
                    return(
                        <SideBarItem 
                        key={id} 
                        onClick={clickHandler} 
                        title={title} 
                        previewMessage={previewMessage} 
                        isActive={(activeItem === chat.id)}
                        />
                    );
                })}
            </div>

            {/* Растягиваемая правая часть */}
            <div className={ styles.draggableRightPart } onMouseDown={ handleMouseDown } />
        </div>
    );
};

export default SideBar;