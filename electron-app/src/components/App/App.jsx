import { useEffect, useRef, useState } from "react";
import styles from "./App.module.css";
import SideBar from "../Sidebar/Sidebar.jsx";
import Chat from "../Chat/Chat.jsx";
import Profile from "../Profile/Profile.jsx";
import TDLibService from "../../lib/telegram/TDLibService";

const AUTH = {
    INIT: "initializing",
    PHONE: "wait_phone",
    CODE: "wait_code",
    PASSWORD: "wait_password",
    READY: "authorized",
    ERROR: "error",
};

const App = () => {
    const [authState, setAuthState] = useState(AUTH.INIT);
    const [user, setUser] = useState(null);
    const [chats, setChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [view, setView] = useState("main"); // 'main' | 'profile'
    const [loading, setLoading] = useState(false);
    const [chatsLoading, setChatsLoading] = useState(false);
    const [error, setError] = useState("");
    const [phone, setPhone] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");

    const tdRef = useRef(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        const td = new TDLibService();
        tdRef.current = td;

        td.on("update", (update) => {
            if (!mountedRef.current) return;

            if (update["@type"] === "updateNewChat") {
                const chat = update.chat;
                setChats((prev) =>
                    prev.some((c) => c.id === chat.id) ? prev : [...prev, chat],
                );
                return;
            }

            if (update["@type"] === "updateChatLastMessage") {
                setChats((prev) =>
                    prev.map((c) =>
                        c.id === update.chat_id
                            ? { ...c, last_message: update.last_message }
                            : c,
                    ),
                );
                return;
            }

            if (update["@type"] !== "updateAuthorizationState") return;

            const state = update.authorization_state["@type"];
            switch (state) {
                case "authorizationStateWaitPhoneNumber":
                    setAuthState(AUTH.PHONE);
                    setLoading(false);
                    break;
                case "authorizationStateWaitCode":
                    setAuthState(AUTH.CODE);
                    setLoading(false);
                    break;
                case "authorizationStateWaitPassword":
                    setAuthState(AUTH.PASSWORD);
                    setLoading(false);
                    break;
                case "authorizationStateReady":
                    setAuthState(AUTH.READY);
                    setLoading(false);
                    td.getMe()
                        .then((me) => {
                            if (mountedRef.current) setUser(me);
                        })
                        .catch((e) => console.warn("[App] getMe:", e.message));
                    td.loadChats(50).catch(() => {});
                    break;
                case "authorizationStateClosed":
                    setChats([]);
                    setUser(null);
                    setActiveChat(null);
                    setAuthState(AUTH.PHONE);
                    setLoading(false);
                    break;
            }
        });

        td.init().catch((err) => {
            if (mountedRef.current) {
                console.error("[App] TDLib init failed:", err);
                setError(err.message);
                setAuthState(AUTH.ERROR);
            }
        });

        return () => {
            mountedRef.current = false;
            td.destroy();
        };
    }, []);

    const handleSendPhone = async (e) => {
        e.preventDefault();
        if (!phone.trim()) return;
        setLoading(true);
        setError("");
        try {
            await tdRef.current.setPhoneNumber(phone.trim());
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const handleSendCode = async (e) => {
        e.preventDefault();
        if (!code.trim()) return;
        setLoading(true);
        setError("");
        try {
            await tdRef.current.checkCode(code.trim());
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const handleSendPassword = async (e) => {
        e.preventDefault();
        if (!password.trim()) return;
        setLoading(true);
        setError("");
        try {
            await tdRef.current.checkPassword(password.trim());
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        setLoading(true);
        try {
            await tdRef.current.logout();
        } catch {}
        setUser(null);
        setChats([]);
        setActiveChat(null);
        setPhone("");
        setCode("");
        setPassword("");
        setView("main");
        setLoading(false);
    };

    const handleLoadMore = async () => {
        if (!tdRef.current) return;
        setChatsLoading(true);
        try {
            await tdRef.current.loadChats(100);
        } catch {}
        setChatsLoading(false);
    };

    if (authState !== AUTH.READY) {
        return (
            <div
                style={{
                    height: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {renderAuth(authState, {
                    phone,
                    code,
                    password,
                    loading,
                    error,
                    setPhone,
                    setCode,
                    setPassword,
                    handleSendPhone,
                    handleSendCode,
                    handleSendPassword,
                })}
            </div>
        );
    }

    if (view === "profile") {
        return (
            <Profile
                user={user}
                td={tdRef.current}
                onBack={() => setView("main")}
                onLogout={handleLogout}
            />
        );
    }

    return (
        <div className={styles.contentContainer}>
            <SideBar
                chats={chats}
                onSidebarClick={setActiveChat}
                activeItem={activeChat?.id}
                onProfileClick={() => setView("profile")}
            />
            <div className={styles.mainContent}>
                {activeChat ? (
                    <Chat chat={activeChat} td={tdRef.current} />
                ) : (
                    <div className={styles.welcome}>
                        <div className={styles.welcomeGreeting}>
                            Привет, {user?.first_name}!
                        </div>
                        <p className={styles.welcomeHint}>
                            Выберите чат в списке слева
                        </p>
                        <button
                            className={styles.btn}
                            onClick={handleLoadMore}
                            disabled={chatsLoading}
                        >
                            {chatsLoading
                                ? "Загрузка..."
                                : `Загрузить ещё чатов (${chats.length})`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

function renderAuth(
    authState,
    {
        phone,
        code,
        password,
        loading,
        error,
        setPhone,
        setCode,
        setPassword,
        handleSendPhone,
        handleSendCode,
        handleSendPassword,
    },
) {
    if (authState === AUTH.INIT) {
        return (
            <div className="loadingScreen">
                <div className="spinner" />
                <p>Инициализация...</p>
            </div>
        );
    }

    const errEl = error && (
        <p style={{ color: "#e74c3c", fontSize: 13, margin: "0 0 4px" }}>
            {error}
        </p>
    );

    if (authState === AUTH.PHONE) {
        return (
            <div className="authForm">
                <h3>Вход в Telegram</h3>
                <form onSubmit={handleSendPhone}>
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+79001234567"
                        disabled={loading}
                        className="inputField"
                        autoFocus
                    />
                    {errEl}
                    <button type="submit" disabled={loading} className="btn">
                        {loading ? "Отправка..." : "Получить код"}
                    </button>
                </form>
            </div>
        );
    }

    if (authState === AUTH.CODE) {
        return (
            <div className="authForm">
                <h3>Введите код</h3>
                <p style={{ color: "#666", fontSize: 14, margin: 0 }}>
                    Код отправлен в Telegram
                </p>
                <form onSubmit={handleSendCode}>
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="12345"
                        disabled={loading}
                        className="inputField"
                        autoFocus
                    />
                    {errEl}
                    <button type="submit" disabled={loading} className="btn">
                        {loading ? "Проверка..." : "Подтвердить"}
                    </button>
                </form>
            </div>
        );
    }

    if (authState === AUTH.PASSWORD) {
        return (
            <div className="authForm">
                <h3>Двухфакторная аутентификация</h3>
                <form onSubmit={handleSendPassword}>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Пароль"
                        disabled={loading}
                        className="inputField"
                        autoFocus
                    />
                    {errEl}
                    <button type="submit" disabled={loading} className="btn">
                        {loading ? "Вход..." : "Войти"}
                    </button>
                </form>
            </div>
        );
    }

    if (authState === AUTH.ERROR) {
        return (
            <div className="errorScreen">
                <h3>Ошибка инициализации</h3>
                <p>{error || "Неизвестная ошибка"}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="btn"
                >
                    Попробовать снова
                </button>
            </div>
        );
    }

    return null;
}

export default App;
