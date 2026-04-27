// src/lib/telegram/client.js
import TdClient from "tdweb";

class TelegramClient {
    constructor() {
        this.client = null;
        this.isInitialized = false;
        this.isInitializing = false;
        this.initPromise = null;
        this._instanceId = null;
        this.onAuthStateChange = null;
        this._currentAuthState = null;
    }

    async init() {
        if (this.isInitialized && this.client) {
            console.log("✅ Клиент уже инициализирован");
            return this.client;
        }

        if (this.isInitializing) {
            console.log("⏳ Ожидание инициализации...");
            return this.initPromise;
        }

        this.isInitializing = true;
        this._instanceId = Date.now().toString();

        this.initPromise = this._init();

        try {
            const client = await this.initPromise;
            this.isInitialized = true;
            return client;
        } finally {
            this.isInitializing = false;
        }
    }

    async _init() {
        const apiId = Number(import.meta.env.VITE_TELEGRAM_API_ID);
        const apiHash = import.meta.env.VITE_TELEGRAM_API_HASH;

        console.log("🚀 Инициализация Telegram клиента...");

        await this.close();

        return new Promise((resolve, reject) => {
            try {
                this.client = new TdClient({
                    apiId,
                    apiHash,
                    instanceName: `telegram-client-${this._instanceId}`,
                    logVerbosityLevel: 2,
                    jsLogVerbosityLevel: "info",
                    useDatabase: true,
                });

                let resolved = false;

                this.client.onUpdate = (update) => {
                    // Всегда обрабатываем обновления
                    this.handleUpdate(update);

                    // Проверяем состояние авторизации
                    if (update["@type"] === "updateAuthorizationState") {
                        const state = update.authorization_state;
                        const stateType = state["@type"];
                        this._currentAuthState = stateType;

                        console.log("📋 Состояние:", stateType);

                        // Отправляем callback
                        if (this.onAuthStateChange) {
                            this.onAuthStateChange(state);
                        }

                        // Резолвим ТОЛЬКО когда дойдем до состояний,
                        // требующих действий пользователя или готовности
                        if (!resolved) {
                            if (
                                stateType === "authorizationStateReady" ||
                                stateType ===
                                    "authorizationStateWaitPhoneNumber" ||
                                stateType === "authorizationStateWaitCode" ||
                                stateType === "authorizationStateWaitPassword"
                            ) {
                                resolved = true;
                                console.log(
                                    "✅ Резолв на состоянии:",
                                    stateType,
                                );
                                resolve(this.client);
                            }
                        }
                    }
                };

                // Таймаут на случай проблем
                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        console.warn(
                            "⚠️ Таймаут инициализации, резолвим принудительно",
                        );
                        resolve(this.client);
                    }
                }, 60000);
            } catch (error) {
                reject(error);
            }
        });
    }

    handleUpdate(update) {
        const type = update["@type"];

        if (type === "updateAuthorizationState") {
            this.handleAuthState(update.authorization_state);
        }
    }

    async handleAuthState(state) {
        const stateType = state["@type"];

        switch (stateType) {
            case "authorizationStateWaitTdlibParameters":
                console.log("📤 Отправка параметров TDLib...");
                try {
                    await this.send({
                        "@type": "setTdlibParameters",
                        use_test_dc: false,
                        database_directory: "/tdlib",
                        files_directory: "/tdlib",
                        use_file_database: true,
                        use_chat_info_database: true,
                        use_message_database: true,
                        api_id: Number(import.meta.env.VITE_TELEGRAM_API_ID),
                        api_hash: import.meta.env.VITE_TELEGRAM_API_HASH,
                        system_language_code: "ru",
                        device_model: "Desktop",
                        system_version: "Windows",
                        application_version: "1.0.0",
                        enable_storage_optimizer: true,
                        ignore_file_names: false,
                    });
                    console.log("✅ Параметры отправлены");
                } catch (error) {
                    console.error("❌ Ошибка отправки параметров:", error);
                }
                break;

            case "authorizationStateWaitEncryptionKey":
                console.log("🔑 Проверка ключа шифрования...");
                try {
                    await this.send({
                        "@type": "checkDatabaseEncryptionKey",
                        encryption_key: "",
                    });
                    console.log("✅ Ключ проверен");
                } catch (error) {
                    console.error("❌ Ошибка ключа шифрования:", error);
                }
                break;

            case "authorizationStateWaitPhoneNumber":
                console.log("📱 Ожидание номера телефона");
                break;

            case "authorizationStateWaitCode":
                console.log("🔐 Ожидание кода подтверждения");
                break;

            case "authorizationStateWaitPassword":
                console.log("🔑 Ожидание пароля 2FA");
                break;

            case "authorizationStateReady":
                console.log("✅ Успешная авторизация!");
                break;

            case "authorizationStateClosing":
            case "authorizationStateClosed":
                console.log("🔒 Клиент закрыт");
                break;

            default:
                console.log("❓ Неизвестное состояние:", stateType);
        }
    }

    async send(query) {
        if (!this.client) {
            throw new Error("Клиент не инициализирован");
        }

        return new Promise((resolve, reject) => {
            this.client.send(query, (result) => {
                if (result["@type"] === "error") {
                    reject(new Error(`${result.code}: ${result.message}`));
                } else {
                    resolve(result);
                }
            });
        });
    }

    async setPhoneNumber(phoneNumber) {
        console.log("📱 Отправка номера:", phoneNumber);
        return await this.send({
            "@type": "setAuthenticationPhoneNumber",
            phone_number: phoneNumber,
            settings: {
                "@type": "phoneNumberAuthenticationSettings",
                allow_flash_call: false,
                allow_missed_call: false,
                is_current_phone_number: false,
                allow_sms_retriever_api: false,
            },
        });
    }

    async checkCode(code) {
        console.log("🔐 Отправка кода...");
        return await this.send({
            "@type": "checkAuthenticationCode",
            code: code,
        });
    }

    async checkPassword(password) {
        console.log("🔑 Отправка пароля...");
        return await this.send({
            "@type": "checkAuthenticationPassword",
            password: password,
        });
    }

    async getMe() {
        return await this.send({
            "@type": "getMe",
        });
    }

    async getChats(limit = 100) {
        const result = await this.send({
            "@type": "getChats",
            limit: limit,
            chat_list: { "@type": "chatListMain" },
        });

        const chats = [];
        if (result.chat_ids) {
            for (const chatId of result.chat_ids) {
                try {
                    const chat = await this.getChat(chatId);
                    chats.push(chat);
                } catch (error) {
                    console.error(`Ошибка чата ${chatId}:`, error);
                }
            }
        }

        return chats;
    }

    async getChat(chatId) {
        return await this.send({
            "@type": "getChat",
            chat_id: chatId,
        });
    }

    async close() {
        if (this.client) {
            try {
                await this.send({ "@type": "close" });
            } catch (e) {
                // Игнорируем
            }
            this.client = null;
            this.isInitialized = false;
        }
    }

    async logout() {
        return await this.send({
            "@type": "logOut",
        });
    }
}

let instance = null;

export function getTelegramClient() {
    if (!instance) {
        instance = new TelegramClient();
    }
    return instance;
}

export default TelegramClient;
