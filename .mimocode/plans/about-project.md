# MARX SHOP — Telegram Mini App MVP

## Что это

Telegram Mini App для продажи и аренды аккаунтов PUBG Mobile с видеопревью, платёжным симулятором и админ-панелью.

## Архитектура

```
┌─────────────────┐    ┌──────────────────────────┐    ┌─────────────────┐
│  GitHub Pages   │    │  Yandex Cloud            │    │  Yandex S3      │
│  (фронтенд)     │    │  Serverless Containers   │    │  (видео/данные)  │
│  React + Vite   │    │  (бэкенд API)            │    │                 │
└────────┬────────┘    └────────────┬─────────────┘    └────────┬────────┘
         │                         │                           │
         │   https://artemwork...  │  https://bbaq...          │
         │   .github.io/MARXSHOP   │  .containers.yandex...    │
         └─────────────────────────┴───────────────────────────┘
```

### URL
- **Фронтенд:** https://artemwork9786-hash.github.io/MARXSHOP
- **Бэкенд:** https://bbaq0jmusbs0rseu0f1g.containers.yandexcloud.net
- **Видео/Данные:** https://storage.yandexcloud.net/marx-shop-videos

---

## Стек технологий

### Фронтенд
- React 19 + Vite 8
- Tailwind CSS 4
- Telegram WebApp SDK (хостится локально в `public/`)
- Deploy: gh-pages на GitHub Pages

### Бэкенд
- Node.js 20 + Express 5
- ffmpeg (для извлечения превью видео)
- S3 (Yandex Object Storage) для видео и данных
- Deploy: Docker → Yandex Cloud Serverless Containers

### Данные
- `products.json` в S3 — аккаунты
- Видео в S3 — загружаются через админку
- Превью в S3 — генерируются автоматически через ffmpeg
- Заказы — в памяти контейнера (теряются при рестарте)

---

## Возможности

### Для пользователей
- Просмотр аккаунтов с видеопревью
- Покупка (симуляция оплаты)
- Аренда с выбором тарифа и обратным таймером
- Профиль с активными аккаунтами и логинами/паролями
- Тёмная тема

### Для админа (@verykindandfriendlyguy)
- CRUD аккаунтов (аренда и магазин)
- Загрузка видео с автогенерацией превью
- Управление статусами (В наличии, В работе, Продан, Занят)
- Панель проверки оплат (approve/reject)
- Активные аренды с кнопкой завершения
- Двухуровневая защита: фронтенд (username) + сервер (Telegram Init Data)

### Платёжный флоу
```
available → waiting_payment → test-pay → paid_verifying → approve/reject → active
```

---

## Структура проекта

```
MARX SHOP/
├── public/
│   └── telegram-web-app.js      # Telegram SDK (хостится локально)
├── src/
│   ├── App.jsx                   # Главный компонент, табы, платёжный флоу
│   ├── main.jsx                  # Entry point, cache buster
│   ├── api.js                    # API-вызовы с Telegram Init Data
│   ├── components/
│   │   ├── AccountCard.jsx       # Карточка аккаунта + GlassPlayer
│   │   ├── AdminPanel.jsx        # Админка: CRUD, видео, табы
│   │   ├── PaymentFlow.jsx       # Экраны оплаты
│   │   └── ProfileTab.jsx        # Профиль пользователя
│   └── ...
├── server/
│   ├── server.js                 # Express API, все эндпоинты
│   ├── lib/
│   │   ├── yc-s3.js             # S3-клиент (Yandex Cloud)
│   │   ├── storage.js           # Хранилище заказов (память/fail)
│   │   └── crypto-pay.js        # CryptoPay API
│   └── scripts/
│       └── upload-to-s3.js      # Миграция видео в S3
├── Dockerfile                    # Multi-stage: Node 20 + ffmpeg
├── vite.config.js                # base: /MARXSHOP/
└── package.json                  # deploy: gh-pages -d dist
```

---

## Деплой: фронтенд

### Когда
После **любого** изменения в `src/`, `public/`, `vite.config.js`.

### Команда

```bash
cd "E:\Projects\MARX SHOP"
npm run build && npm run deploy
```

### Что происходит
1. `npm run build` — Vite собирает React-приложение в `dist/`
2. `npm run deploy` — gh-pages загружает `dist/` на ветку `gh-pages`

### Настройка Telegram Bot
```
BotFather → /setmenubutton → URL: https://artemwork9786-hash.github.io/MARXSHOP
```

---

## Деплой: бэкенд

### Когда
После изменений в `server/` или при обновлении зависимостей.

### Шаг 1: Собрать и пуш Docker-образ

```bash
cd "E:\Projects\MARX SHOP"

# Собрать образ
docker build -t cr.yandex/<registry-id>/marxshop-backend:latest .

# Пуш в Yandex Container Registry
docker push cr.yandex/<registry-id>/marxshop-backend:latest
```

### Шаг 2: Деплой ревизии

```bash
yc serverless container revision deploy \
  --container-name marxshop-api \
  --image cr.yandex/<registry-id>/marxshop-backend:latest \
  --memory 512MB \
  --concurrency 1 \
  --execution-timeout 60s \
  --service-account-id <service-account-id> \
  --env NODE_ENV=production \
  --env PORT=8080 \
  --env YC_BUCKET=marx-shop-videos \
  --env YC_REGION=ru-central1 \
  --env YC_ACCESS_KEY=<access-key> \
  --env YC_SECRET_KEY=<secret-key> \
  --env YC_PUBLIC_URL=https://storage.yandexcloud.net/marx-shop-videos
```

### Шаг 3: Проверить healthcheck

```bash
curl https://<container-id>.containers.yandexcloud.net/health
# Ответ: {"status":"ok"}
```

### Шаг 4: Обновить фронтенд (если изменился URL бэкенда)

```bash
# Обновить .env
echo VITE_API_URL=https://<container-id>.containers.yandexcloud.net > .env

# Пересобрать и задеплоить
npm run build && npm run deploy
```

---

## Настройка окружения (один раз)

### 1. Yandex Cloud CLI

```powershell
Invoke-WebRequest -Uri https://storage.yandexcloud.net/yandexcloud-yc/install.ps1 -OutFile install.ps1
.\install.ps1
yc init
```

### 2. Service Account

```bash
SA_ID=$(yc iam service-account create --name marxshop-deployer --format json | jq -r '.id')
FOLDER_ID=$(yc resource-manager folder get-by-name --name <имя-folder> --format json | jq -r '.id')

# Роль: Container Registry
yc resource-manager folder add-access-binding \
  $FOLDER_ID --member serviceAccount:$SA_ID \
  --role container-registry.images.pusher

# Роль: Serverless Containers
yc resource-manager folder add-access-binding \
  $FOLDER_ID --member serviceAccount:$SA_ID \
  --role serverless.containers.user

# Роль: Object Storage (для S3)
yc resource-manager folder add-access-binding \
  $FOLDER_ID --member serviceAccount:$SA_ID \
  --role storage.editor
```

### 3. Container Registry

```bash
yc container registry create --name marxshop-registry
REGISTRY_ID=$(yc container registry list --format json | jq -r '.[].id' | head -1)
yc docker-configure --registry-id $REGISTRY_ID
```

### 4. Контейнер

```bash
yc serverless container create --name marxshop-api
```

---

## Переменные окружения

### Фронтенд (`/.env`)
```
VITE_API_URL=https://bbaq0jmusbs0rseu0f1g.containers.yandexcloud.net
```

### Бэкенд (передаются через CLI)
| Переменная | Значение |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `YC_BUCKET` | `marx-shop-videos` |
| `YC_REGION` | `ru-central1` |
| `YC_ACCESS_KEY` | `YCAJEl9M9I...` |
| `YC_SECRET_KEY` | `YCPH0vL8xq...` |
| `YC_PUBLIC_URL` | `https://storage.yandexcloud.net/marx-shop-videos` |

---

## Быстрый деплой (только фронтенд)

```bash
cd "E:\Projects\MARX SHOP"
npm run build && npm run deploy
```

## Полный деплой (фронтенд + бэкенд)

```bash
cd "E:\Projects\MARX SHOP"

# 1. Docker
docker build -t cr.yandex/<registry-id>/marxshop-backend:latest .
docker push cr.yandex/<registry-id>/marxshop-backend:latest

# 2. Контейнер
yc serverless container revision deploy \
  --container-name marxshop-api \
  --image cr.yandex/<registry-id>/marxshop-backend:latest \
  --memory 512MB --concurrency 1 --execution-timeout 60s \
  --service-account-id <sa-id> \
  --env NODE_ENV=production --env PORT=8080 \
  --env YC_BUCKET=marx-shop-videos --env YC_REGION=ru-central1 \
  --env YC_ACCESS_KEY=<key> --env YC_SECRET_KEY=<secret> \
  --env YC_PUBLIC_URL=https://storage.yandexcloud.net/marx-shop-videos

# 3. Фронтенд
npm run build && npm run deploy
```

---

## Откат

### Фронтенд
```bash
git checkout <commit-hash> -- src/
npm run build && npm run deploy
```

### Бэкенд
```bash
docker build -t cr.yandex/<registry-id>/marxshop-backend:<tag> .
docker push cr.yandex/<registry-id>/marxshop-backend:<tag>
yc serverless container revision deploy \
  --container-name marxshop-api \
  --image cr.yandex/<registry-id>/marxshop-backend:<tag> \
  ...
```

---

## Мониторинг

```bash
# Логи контейнера
yc serverless container revision get-logs --container-name marxshop-api

# Статус контейнера
yc serverless container list
```

---

## Известные ограничения

1. **WebSocket не работает** на YC Serverless Containers — используется polling каждые 5 сек
2. **Заказы теряются** при рестарте контейнера (хранились в памяти)
3. **Telegram SDK блокируется** в РФ — хостится локально в `public/telegram-web-app.js`
4. **Cache buster в main.jsx** — не делает hard reload в Telegram WebView

---

## Чек-лист

- [ ] Dockerfile собирается: `docker build .`
- [ ] `.env` содержит правильный `VITE_API_URL`
- [ ] S3-бакет `marx-shop-videos` доступен
- [ ] Service Account имеет роли: `container-registry.images.pusher`, `serverless.containers.user`, `storage.editor`
- [ ] Healthcheck отвечает: `curl https://<url>/health` → `{"status":"ok"}`
- [ ] Фронтенд открывается: https://artemwork9786-hash.github.io/MARXSHOP
- [ ] Telegram Bot настроен на URL фронтенда
