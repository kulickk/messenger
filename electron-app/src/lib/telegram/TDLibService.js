import createTdwebModule from 'tdlib-wasm';
import EventEmitter from 'events';

const DB_DIR = '/tdlib/db';
const FILES_DIR = '/tdlib/files';

class TDLibService extends EventEmitter {
    constructor() {
        super();
        this._module = null;
        this._clientId = null;
        this._fn = null;
        this._pending = new Map();
        this._nextExtra = 1;
        this._running = false;
        this._idbfs = false;
        this._syncTimer = null;
        this.apiId = parseInt(import.meta.env.VITE_TELEGRAM_API_ID, 10);
        this.apiHash = import.meta.env.VITE_TELEGRAM_API_HASH;
    }

    async init() {
        if (this._module) return;

        console.log('[TDLib] Loading WASM module...');
        this._module = await createTdwebModule({
            locateFile: (file) => (file.endsWith('.wasm') ? '/td_wasm.wasm' : file),
        });
        console.log('[TDLib] WASM loaded');

        await this._setupFS();

        this._fn = {
            create:     this._module.cwrap('td_emscripten_create_client_id', 'number', []),
            send:       this._module.cwrap('td_emscripten_send', null, ['number', 'string']),
            receive:    this._module.cwrap('td_emscripten_receive', 'string', []),
            getTimeout: this._module.cwrap('td_emscripten_get_timeout', 'number', []),
            execute:    this._module.cwrap('td_emscripten_execute', 'string', ['string']),
        };

        this._fn.execute(JSON.stringify({ '@type': 'setLogVerbosityLevel', new_verbosity_level: 1 }));

        this._clientId = this._fn.create();
        console.log('[TDLib] Client created, id:', this._clientId);

        this._running = true;
        this._runLoop();
        this._sendParams();

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('TDLib init timeout')), 30_000);
            const handler = (update) => {
                if (update['@type'] === 'updateAuthorizationState') {
                    clearTimeout(timeout);
                    this.off('update', handler);
                    resolve();
                }
            };
            this.on('update', handler);
        });
    }

    async _setupFS() {
        const { FS } = this._module;

        try { FS.mkdir('/tdlib'); } catch {}

        const IDBFS = FS.filesystems?.IDBFS;
        if (IDBFS) {
            try {
                FS.mount(IDBFS, {}, '/tdlib');
                // Populate in-memory FS from IndexedDB (restores previous session DB files)
                await new Promise((resolve) => {
                    FS.syncfs(true, (err) => {
                        if (err) console.warn('[TDLib] Initial FS sync failed:', err);
                        resolve();
                    });
                });
                this._idbfs = true;
                console.log('[TDLib] IDBFS mounted — session persistence enabled');
            } catch (e) {
                console.warn('[TDLib] IDBFS unavailable, using MEMFS (no persistence):', e.message);
            }
        } else {
            console.warn('[TDLib] IDBFS not available — session will not persist across reloads');
        }

        for (const dir of [DB_DIR, FILES_DIR]) {
            try { FS.mkdir(dir); } catch {}
        }
    }

    _persistFS() {
        if (!this._idbfs || !this._module) return;
        this._module.FS.syncfs(false, (err) => {
            if (err) console.warn('[TDLib] FS persist failed:', err);
        });
    }

    _runLoop() {
        if (!this._running) return;

        let json;
        while ((json = this._fn.receive())) {
            try {
                this._dispatch(JSON.parse(json));
            } catch (e) {
                console.warn('[TDLib] Failed to parse update:', e);
            }
        }

        const wait = Math.min(Math.max(this._fn.getTimeout() * 1000, 10), 100);
        setTimeout(() => this._runLoop(), wait);
    }

    _dispatch(update) {
        const extra = update['@extra'];

        if (extra !== undefined) {
            const cb = this._pending.get(extra);
            if (cb) {
                this._pending.delete(extra);
                if (update['@type'] === 'error') {
                    cb.reject(new Error(`${update.code}: ${update.message}`));
                } else {
                    cb.resolve(update);
                }
                return;
            }
        }

        this.emit('update', update);

        if (update['@type'] === 'updateAuthorizationState') {
            const state = update.authorization_state['@type'];
            console.log('[TDLib] Auth state:', state);

            if (state === 'authorizationStateWaitTdlibParameters') {
                this._sendParams();
            }

            if (state === 'authorizationStateReady') {
                // Give TDLib a moment to finish DB writes, then persist to IndexedDB
                setTimeout(() => {
                    this._persistFS();
                    this._syncTimer = setInterval(() => this._persistFS(), 30_000);
                }, 2000);
            }
        }
    }

    _sendParams() {
        this._fn.send(this._clientId, JSON.stringify({
            '@type': 'setTdlibParameters',
            api_id: this.apiId,
            api_hash: this.apiHash,
            database_directory: DB_DIR,
            files_directory: FILES_DIR,
            use_file_database: true,
            use_chat_info_database: true,
            use_message_database: true,
            use_secret_chats: false,
            system_language_code: 'ru',
            device_model: 'Desktop',
            system_version: 'Windows 10',
            application_version: '1.0.0',
        }));
    }

    invoke(query) {
        return new Promise((resolve, reject) => {
            const extra = this._nextExtra++;
            this._pending.set(extra, { resolve, reject });
            this._fn.send(this._clientId, JSON.stringify({ ...query, '@extra': extra }));
            setTimeout(() => {
                if (this._pending.has(extra)) {
                    this._pending.delete(extra);
                    reject(new Error(`Timeout: ${query['@type']}`));
                }
            }, 30_000);
        });
    }

    // ── Auth ──────────────────────────────────────────────────────────────────
    setPhoneNumber(phone) {
        return this.invoke({
            '@type': 'setAuthenticationPhoneNumber',
            phone_number: phone,
            settings: {
                '@type': 'phoneNumberAuthenticationSettings',
                allow_flash_call: false,
                allow_missed_call: false,
                is_current_phone_number: false,
            },
        });
    }
    checkCode(code)         { return this.invoke({ '@type': 'checkAuthenticationCode', code }); }
    checkPassword(password) { return this.invoke({ '@type': 'checkAuthenticationPassword', password }); }
    logout()                { return this.invoke({ '@type': 'logOut' }); }

    // ── User ──────────────────────────────────────────────────────────────────
    getMe()                 { return this.invoke({ '@type': 'getMe' }); }
    getUserFullInfo(userId) { return this.invoke({ '@type': 'getUserFullInfo', user_id: userId }); }
    setName(first, last)    { return this.invoke({ '@type': 'setName', first_name: first, last_name: last || '' }); }
    setBio(bio)             { return this.invoke({ '@type': 'setBio', bio }); }

    // ── Chats ─────────────────────────────────────────────────────────────────
    openChat(chatId)        { return this.invoke({ '@type': 'openChat',  chat_id: chatId }); }
    closeChat(chatId)       { return this.invoke({ '@type': 'closeChat', chat_id: chatId }); }

    getChatHistory(chatId, fromMessageId = 0, offset = 0, limit = 50) {
        return this.invoke({
            '@type': 'getChatHistory',
            chat_id: chatId,
            from_message_id: fromMessageId,
            offset,
            limit,
            only_local: false,
        });
    }

    sendMessage(chatId, text, replyToMessageId = 0) {
        const replyTo = replyToMessageId
            ? { '@type': 'inputMessageReplyToMessage', message_id: replyToMessageId }
            : undefined;
        return this.invoke({
            '@type': 'sendMessage',
            chat_id: chatId,
            reply_to: replyTo,
            input_message_content: {
                '@type': 'inputMessageText',
                text: { '@type': 'formattedText', text },
            },
        });
    }

    pinChatMessage(chatId, messageId, disableNotification = false) {
        return this.invoke({
            '@type': 'pinChatMessage',
            chat_id: chatId,
            message_id: messageId,
            disable_notification: disableNotification,
            only_for_self: false,
        });
    }

    async loadChats(limit = 50) {
        try {
            await this.invoke({ '@type': 'loadChats', chat_list: { '@type': 'chatListMain' }, limit });
        } catch {}
    }

    // ── Files ─────────────────────────────────────────────────────────────────
    downloadFile(fileId, priority = 1) {
        return this.invoke({
            '@type': 'downloadFile',
            file_id: fileId,
            priority,
            offset: 0,
            limit: 0,
            synchronous: false,
        });
    }

    readFileBytes(path) {
        try {
            return this._module.FS.readFile(path);
        } catch {
            return null;
        }
    }

    destroy() {
        this._running = false;
        if (this._syncTimer) clearInterval(this._syncTimer);
        this._persistFS();
        this._pending.clear();
        this.removeAllListeners();
        this._fn = null;
    }
}

export default TDLibService;
