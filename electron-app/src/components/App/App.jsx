import styles from "./App.module.css";
import SideBar from "../Sidebar/Sidebar.jsx";
import MainContent from "../MainContent/MainContent.jsx";
import { useData } from "../../hooks/useData.js";
import { useEffect, useRef, useState } from "react";
import { getTelegramClient } from "../../lib/telegram/client.js";

const API_ID = Number(import.meta.env.VITE_TELEGRAM_API_ID);
const API_HASH = import.meta.env.VITE_TELEGRAM_API_HASH;

const App = () => {
    const [client, setClient] = useState(null);
    const [error, setError] = useState(null);
    const data = useData("mock");
    const [activeItem, setActiveItem] = useState(null);

    const [loading, setLoading] = useState(false);
    const [authState, setAuthState] = useState("initializing");
    const [user, setUser] = useState(null);
    const [phoneNumber, setPhoneNumber] = useState("");
    const [code, setCode] = useState("");

    const handleClickSidebarItem = (chat) => {
        setActiveItem(chat);
        console.log(chat);
    };

    // Предотвращаем двойную инициализацию
    const initRef = useRef(false);
    const clientRef = useRef(null);

    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        let mounted = true;
        let timeoutId = null;

        const initClient = async () => {
            try {
                const client = getTelegramClient();
                clientRef.current = client;

                // Устанавливаем callback ДО инициализации
                client.onAuthStateChange = (state) => {
                    if (!mounted) return;
                    console.log("📢 Callback вызван:", state["@type"]);
                    updateAuthState(state["@type"]);
                };

                await client.init();

                if (!mounted) return;

                // После инициализации проверяем текущее состояние
                console.log("🔍 Проверка состояния после init...");
                await checkCurrentState();
            } catch (err) {
                console.error("❌ Ошибка:", err);
                if (mounted) {
                    setError(err.message);
                    setAuthState("error");
                }
            }
        };

        const checkCurrentState = async () => {
            try {
                // Пробуем получить текущего пользователя
                const me = await clientRef.current.getMe();
                if (me && mounted) {
                    console.log("✅ Пользователь найден:", me.first_name);
                    setUser(me);
                    setAuthState("authorized");
                }
            } catch (err) {
                // Если не авторизованы - запрашиваем телефон
                console.log("❌ Не авторизованы, ошибка:", err.message);
                if (mounted) {
                    setAuthState("wait_phone");
                }
            }
        };

        const updateAuthState = (stateType) => {
            console.log("🔄 Обновление UI состояния:", stateType);

            switch (stateType) {
                case "authorizationStateWaitPhoneNumber":
                    setAuthState("wait_phone");
                    break;
                case "authorizationStateWaitCode":
                    setAuthState("wait_code");
                    break;
                case "authorizationStateWaitPassword":
                    setAuthState("wait_password");
                    break;
                case "authorizationStateReady":
                    setAuthState("authorized");
                    // Загружаем пользователя
                    clientRef.current
                        ?.getMe()
                        .then((me) => {
                            if (mounted) {
                                setUser(me);
                                console.log(
                                    "👤 Пользователь загружен:",
                                    me.first_name,
                                );
                            }
                        })
                        .catch(console.error);
                    break;
                case "authorizationStateClosed":
                    setAuthState("closed");
                    break;
            }
        };

        initClient();

        return () => {
            mounted = false;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, []);

    // Загрузка данных пользователя после авторизации
    useEffect(() => {
        if (authState === "authorized" && clientRef.current) {
            loadUserInfo();
        }
    }, [authState]);

    const handleSendPhone = async (e) => {
        e.preventDefault();
        if (!phoneNumber.trim()) return;

        console.log("📱 Отправка номера:", phoneNumber);
        setLoading(true);
        setError("");

        try {
            await clientRef.current.setPhoneNumber(phoneNumber);
            console.log("✅ Номер отправлен, ждем код...");

            // Принудительно обновляем состояние через 1 секунду
            setTimeout(() => {
                checkAuthAfterAction();
            }, 1000);
        } catch (err) {
            console.error("❌ Ошибка отправки номера:", err);
            setError(err.message);
            setLoading(false);
        }
    };

    const handleSendCode = async (e) => {
        e.preventDefault();
        if (!code.trim()) return;

        console.log("🔐 Отправка кода...");
        setLoading(true);
        setError("");

        try {
            await clientRef.current.checkCode(code);
            console.log("✅ Код отправлен");

            // Принудительно обновляем состояние
            setTimeout(() => {
                checkAuthAfterAction();
            }, 1000);
        } catch (err) {
            console.error("❌ Ошибка кода:", err);

            // Если ошибка 401 - нужен пароль 2FA
            if (
                err.message.includes("401") ||
                err.message.includes("PASSWORD")
            ) {
                setAuthState("wait_password");
            } else {
                setError(err.message);
            }
            setLoading(false);
        }
    };

    const handleSendPassword = async (e) => {
        e.preventDefault();
        if (!password.trim()) return;

        console.log("🔑 Отправка пароля...");
        setLoading(true);
        setError("");

        try {
            await clientRef.current.checkPassword(password);
            console.log("✅ Пароль принят");

            // Принудительно обновляем состояние
            setTimeout(() => {
                checkAuthAfterAction();
            }, 1000);
        } catch (err) {
            console.error("❌ Ошибка пароля:", err);
            setError(err.message);
            setLoading(false);
        }
    };

    const checkAuthAfterAction = async () => {
        try {
            const me = await clientRef.current.getMe();
            console.log("✅ Авторизация успешна:", me.first_name);
            setUser(me);
            setAuthState("authorized");
        } catch (err) {
            console.log("⏳ Еще не авторизованы, ждем...");

            // Пробуем еще раз через 2 секунды
            setTimeout(async () => {
                try {
                    const me = await clientRef.current.getMe();
                    setUser(me);
                    setAuthState("authorized");
                } catch (err2) {
                    console.log("Ожидание следующего шага...");
                }
                setLoading(false);
            }, 2000);
        }
    };

    // Рендер формы авторизации
    const renderAuthForm = () => {
        if (authState === "initializing") {
            return (
                <div className="loading-screen">
                    <div className="spinner"></div>
                    <p>Инициализация Telegram клиента...</p>
                </div>
            );
        }

        if (authState === "wait_phone") {
            return (
                <div className="auth-form">
                    <h3>📱 Вход в Telegram</h3>
                    <form onSubmit={handleSendPhone}>
                        <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="+71234567890"
                            disabled={loading}
                            className="input-field"
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn"
                        >
                            {loading ? "Отправка..." : "Получить код"}
                        </button>
                    </form>
                </div>
            );
        }

        if (authState === "wait_code") {
            return (
                <div className="auth-form">
                    <h3>🔐 Введите код</h3>
                    <p className="hint">Код отправлен в Telegram</p>
                    <form onSubmit={handleSendCode}>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="12345"
                            disabled={loading}
                            className="input-field"
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn"
                        >
                            {loading ? "Проверка..." : "Подтвердить"}
                        </button>
                    </form>
                </div>
            );
        }

        if (authState === "wait_password") {
            return (
                <div className="auth-form">
                    <h3>🔑 Двухфакторная аутентификация</h3>
                    <form onSubmit={handleSendPassword}>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Ваш пароль"
                            disabled={loading}
                            className="input-field"
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn"
                        >
                            {loading ? "Вход..." : "Войти"}
                        </button>
                    </form>
                </div>
            );
        }

        if (authState === "error") {
            return (
                <div className="error-screen">
                    <h3>❌ Ошибка</h3>
                    <p>{error}</p>
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
    };

    // Рендер основного интерфейса
    const renderMainScreen = () => {
        if (authState !== "authorized" || !user) {
            return renderAuthForm();
        }

        return <MainContent data={data} activeItem={activeItem} />;
    };

    return (
        <div className={styles.contentContainer}>
            <SideBar
                data={data}
                onSidebarClick={handleClickSidebarItem}
                activeItem={activeItem?.id}
            />
            <div className={styles.mainContent}>{renderMainScreen()}</div>
        </div>
    );
};

export default App;
