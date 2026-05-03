// Thin hook wrapping TDLibService for components that need direct Telegram access.
// For the main app flow, state is managed in App.jsx directly.
import { useState, useEffect, useCallback, useRef } from "react";
import TDLibService from "../lib/telegram/TDLibService";

export const useTelegram = () => {
    const [authState, setAuthState] = useState(null);
    const [chats, setChats]         = useState([]);
    const [me, setMe]               = useState(null);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState(null);

    const tdRef   = useRef(null);
    const initRef = useRef(false);

    const initialize = useCallback(async () => {
        if (initRef.current) return;
        initRef.current = true;
        setLoading(true);
        setError(null);

        const td = new TDLibService();
        tdRef.current = td;

        td.on("update", (update) => {
            if (update["@type"] === "updateAuthorizationState") {
                setAuthState(update.authorization_state["@type"]);
            }
        });

        try {
            await td.init();
        } catch (err) {
            console.error("[useTelegram] init failed:", err);
            setError(err.message);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        initialize();
        return () => {
            tdRef.current?.destroy();
        };
    }, [initialize]);

    const setPhoneNumber = useCallback((phone) => tdRef.current.setPhoneNumber(phone), []);
    const checkCode      = useCallback((code) => tdRef.current.checkCode(code), []);
    const checkPassword  = useCallback((pass) => tdRef.current.checkPassword(pass), []);
    const getChats       = useCallback(async (limit = 20) => {
        const list = await tdRef.current.getChats(limit);
        setChats(list);
        setLoading(false);
        return list;
    }, []);
    const logout         = useCallback(() => tdRef.current.logout(), []);

    return { authState, chats, me, loading, error, setPhoneNumber, checkCode, checkPassword, getChats, logout };
};
