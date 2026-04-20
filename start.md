# Запуск проекта

## 1. Инфраструктура (бэкенд)

```bash
cd infra
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Первый запуск качает модель `tinyllama` (~600 MB) — подождать пока все сервисы станут `healthy`.

Порты после запуска:
- `8080` — api-gateway (WebSocket + HTTP)
- `8081` — key-server
- `8082` — mask-generator
- `5432` — PostgreSQL
- `6379` — Redis
- `11434` — Ollama

---

## 2. Electron-приложение

```bash
cd electron-app
npm install       # один раз
```

**Запуск (два окна для переписки):**

```bash
# Окно 1 — Alice
USER_ID=alice npm start

# Окно 2 — Bob
USER_ID=bob npm start
```

Дополнительные переменные (опционально):

```bash
USER_ID=alice \
CIPHER_ID=harry_potter \
KEY_SERVER_URL=http://localhost:8081 \
GATEWAY_URL=ws://localhost:8080 \
GATEWAY_HTTP_URL=http://localhost:8080 \
npm start
```

Доступные `CIPHER_ID`: `harry_potter`, `business`, `casual_chat`

---

## 3. Python CLI-клиент (без Telegram)

```bash
cd client/src/sidecar
pip install aiohttp websockets cryptography   # один раз
```

```bash
# Терминал 1 — Alice
ENV_FILE=.env.alice python direct_client.py

# Терминал 2 — Bob
ENV_FILE=.env.bob python direct_client.py
```

Перед запуском заполнить `.env.alice` и `.env.bob` (файлы уже созданы).

---

## 4. Python CLI-клиент (с Telegram / Telethon)

Требует `api_id` и `api_hash` с [my.telegram.org](https://my.telegram.org).

```bash
cd client/src/sidecar
pip install aiohttp websockets cryptography telethon   # один раз

ENV_FILE=.env.alice python telethon_client.py
```

Заполнить в `.env.alice`:
```
TELEGRAM_API_ID=<твой api_id>
TELEGRAM_API_HASH=<твой api_hash>
TELEGRAM_PHONE=+7...
```

---

## Остановка инфры

```bash
cd infra
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```
