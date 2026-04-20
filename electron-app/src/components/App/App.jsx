import styles from "./App.module.css"
import SideBar from "../Sidebar/Sidebar.jsx";
import MainContent from "../MainContent/MainContent.jsx";
import { useData } from "../../hooks/useData.js";
import { useState } from "react";


const App = () => {
    const data = useData("mock");
    const [activeItem, setActiveItem] = useState(null);

    const handleClickSidebarItem = (chat) => {
        setActiveItem(chat);
        console.log(chat);
    };

    return(
        <div className={ styles.contentContainer }>
            <SideBar data={data} onSidebarClick={handleClickSidebarItem} activeItem={activeItem?.id}/>
            <div className={ styles.mainContent }>
                <MainContent data={data} activeItem={activeItem}/>
            </div>
        </div>
    );
};

export default App;