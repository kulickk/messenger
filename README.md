# Messenger System — Directory Architecture

```
messenger/
├── client/                                  # Desktop Client (Electron)
│   ├── src/
│   │   ├── renderer/                        # Render Process — React UI
│   │   │   ├── components/
│   │   │   │   ├── ConversationList.tsx     # Список диалогов
│   │   │   │   ├── MessageInput.tsx         # Ввод сообщения, выбор шифра
│   │   │   │   └── ChatWindow.tsx           # MessageBubble, отображение чата
│   │   │   ├── store/
│   │   │   │   └── store.ts                 # Zustand — стейт сообщений
│   │   │   └── index.tsx                    # Точка входа React
│   │   ├── main/                            # Main Process — Node.js
│   │   │   ├── main.js                      # Electron entry point
│   │   │   ├── preload.js                   # contextBridge — экспозиция API в renderer
│   │   │   ├── ipc_bridge.js                # IPC Render ↔ Main
│   │   │   ├── process_manager.js           # Spawn / управление Python sidecar
│   │   │   ├── session_manager.js           # Auth, настройки, HTTP к backend
│   │   │   └── notification_ctrl.js         # OS-уведомления
│   │   └── sidecar/                         # Python Sidecar — Telethon + crypto
│   │       ├── telethon_client.py           # MTProto, events, отправка/приём
│   │       └── crypto/
│   │           ├── aes.py                   # AES-256 шифрование / дешифрование
│   │           └── zero_width.py            # Стеганография — zero-width Unicode
│   ├── package.json
│   ├── requirements.txt
│   └── Dockerfile
│
├── api-gateway/                             # API Gateway (Golang, WebSocket)
│   ├── cmd/
│   │   └── gateway/
│   │       └── main.go                      # Точка входа сервиса
│   ├── internal/
│   │   ├── handler/
│   │   │   ├── ws_handler.go                # WebSocket — приём / отправка сообщений
│   │   │   └── routes.go                    # Регистрация маршрутов
│   │   ├── service/
│   │   │   ├── message_service.go           # Оркестрация: ключ → маска → шифр → отправка
│   │   │   └── crypto_service.go            # ECDH shared key + AES-256 + стеганография
│   │   ├── client/
│   │   │   ├── key_server_client.go         # HTTP-клиент → Key Server
│   │   │   └── mask_generator_client.go     # HTTP-клиент → Mask Generator
│   │   └── repository/
│   │       ├── postgres.go                  # pgx — users, ciphers
│   │       └── redis.go                     # Сессии, кэш ключей
│   ├── pkg/
│   │   └── crypto/
│   │       ├── ecdh.go                      # X25519 — вычисление общего ключа
│   │       ├── aes.go                       # AES-256-GCM шифрование
│   │       └── steganography.go             # Склейка маски и шифртекста
│   ├── go.mod
│   └── Dockerfile
│
├── key-server/                              # Key Server (Golang, ECDH)
│   ├── cmd/
│   │   └── keyserver/
│   │       └── main.go
│   ├── internal/
│   │   ├── handler/
│   │   │   └── keys_handler.go             # POST /publish  GET /{user_id}  DELETE /revoke
│   │   ├── service/
│   │   │   └── keys_service.go             # Бизнес-логика: валидация → кэш → репозиторий
│   │   ├── validator/
│   │   │   └── crypto_validator.go         # X25519: 32 bytes, base64 decode, format check
│   │   ├── cache/
│   │   │   ├── cache.go                    # Cache-aside: Redis → fallback DB → populate
│   │   │   └── redis.go                    # go-redis: pub_key:{user_id}, TTL 1h
│   │   └── repository/
│   │       └── keys_repository.go          # pgx/v5: INSERT / SELECT / ON CONFLICT UPDATE
│   ├── go.mod
│   └── Dockerfile
│
├── mask-generator/                          # Mask Generator Service (Golang, Ollama)
│   ├── cmd/
│   │   └── maskgen/
│   │       └── main.go
│   ├── internal/
│   │   ├── handler/
│   │   │   └── mask_handler.go             # POST /generate-mask
│   │   ├── analyser/
│   │   │   └── message_analyser.go         # Тон, срочность, длина, язык сообщения
│   │   ├── loader/
│   │   │   └── cipher_loader.go            # Шифры из PostgreSQL, in-memory LRU cache
│   │   ├── builder/
│   │   │   └── prompt_builder.go           # system (стиль + правила) + user (сообщение)
│   │   ├── ollama/
│   │   │   └── client.go                   # POST /api/generate, model: mistral, temp: 0.85
│   │   └── validator/
│   │       └── mask_validator.go           # Длина 10–300 символов, retry ×3
│   ├── go.mod
│   └── Dockerfile
│
├── infra/
│   ├── docker-compose.yml                  # Prod: все сервисы + PostgreSQL + Redis + Ollama
│   ├── docker-compose.dev.yml              # Dev: hot-reload, порты наружу
│   ├── postgres/
│   │   └── migrations/
│   │       ├── 001_create_users.sql
│   │       ├── 002_create_keys.sql
│   │       └── 003_create_ciphers.sql
│   └── redis/
│       └── redis.conf
│
└── docs/
    └── architecture/
        ├── messenger_c4.puml               # C4 диаграммы (Context / Container / Component / Flow)
        ├── context.md
        ├── containers.md
        └── components.md                   # ← этот файл
```

---

## Компоненты и ответственности

### Client — Desktop App (Electron)

| Слой | Файл | Ответственность |
|---|---|---|
| Render | `ConversationList.tsx` | Список диалогов, выбор чата |
| Render | `MessageInput.tsx` | Ввод текста, выбор cipher-стиля |
| Render | `ChatWindow.tsx` | Рендер пузырей, plaintext после дешифровки |
| Render | `store.ts` | Zustand — глобальный стейт сообщений |
| Main | `preload.js` | contextBridge — безопасная экспозиция API в renderer |
| Main | `ipc_bridge.js` | IPC-маршрутизация Render ↔ Main |
| Main | `process_manager.js` | Spawn / kill Python sidecar |
| Main | `session_manager.js` | Auth-токены, настройки, HTTP к backend |
| Main | `notification_ctrl.js` | OS-уведомления о входящих |
| Sidecar | `telethon_client.py` | MTProto: подписка на events, отправка |
| Sidecar | `aes.py` | AES-256-GCM дешифровка входящих |
| Sidecar | `zero_width.py` | Парсинг zero-width символов → извлечение шифртекста |

### API Gateway

| Файл | Ответственность |
|---|---|
| `ws_handler.go` | WebSocket upgrade, read/write pump |
| `message_service.go` | Оркестрация всего flow отправки |
| `crypto_service.go` | ECDH → shared key → AES encrypt → stego embed |
| `key_server_client.go` | GET /{user_id} к Key Server |
| `mask_generator_client.go` | POST /generate-mask к Mask Generator |
| `pkg/crypto/steganography.go` | Склейка: mask + zero-width(ciphertext) |

### Key Server

| Файл | Ответственность |
|---|---|
| `keys_handler.go` | REST: `POST /publish`, `GET /{user_id}`, `DELETE /revoke` |
| `crypto_validator.go` | X25519 проверка: 32 bytes, base64, формат |
| `cache/cache.go` | Cache-aside: Redis hit → return; miss → DB → populate Redis |
| `cache/redis.go` | `pub_key:{user_id}`, TTL 1h, go-redis |
| `keys_repository.go` | pgx/v5: `INSERT … ON CONFLICT UPDATE`, `SELECT` |

### Mask Generator Service

| Файл | Ответственность |
|---|---|
| `mask_handler.go` | `POST /generate-mask` — точка входа |
| `message_analyser.go` | Определяет тон, срочность, длину, язык |
| `cipher_loader.go` | Загружает cipher-стили из БД, in-memory LRU cache |
| `prompt_builder.go` | Собирает system-промпт (стиль) + user-промпт (текст) |
| `ollama/client.go` | `POST /api/generate`, mistral, temp 0.85, num_predict 80 |
| `mask_validator.go` | Проверяет длину 10–300 символов, retry ×3 |
