import { useEffect, useState } from "react";
import chats from "../mock/sidebar";

export function useData(url) {
    const [data, setData] = useState(null);

    useEffect(() => {
        if (url === "mock") {
            setData(chats);
        }
    }, [url]);
    
    return data;
}