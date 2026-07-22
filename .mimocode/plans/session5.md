# Session 5 — Адаптив, blur, безопасность, бекапы

**Сессия:** `ses_080dfea7effetE6PuDSxz0GaLW`
**Запуск:** `mimo` в папке проекта

---

## Деплой фронтенда

```bash
npm run deploy
```
Это делает `vite build` + `gh-pages -d dist`. Деплоит на GitHub Pages.

**Перед деплоем ВСЕГДА коммитить изменения!**

---

## Деплой бэкенда

1. Собрать Docker образ:
```bash
docker build -t marx-shop-server .
```

2. Запушить в Yandex Cloud Container Registry:
```bash
docker push cr.yandex/.../marx-shop-server:latest
```

3. Обновить ревизию в Yandex Cloud Console → Serverless Containers → marx-shop-server → Create new revision

---

## Бекапы (Git)

### Правила коммитов
- **ВСЕГДА** коммитить перед `npm run deploy`
- **НИКОГДА** не коммитить: `.env`, `server/.env`, `server/data/products.json`
- Использовать `git add` с конкретными файлами, НЕ `git add -A`

### Коммит и пуш
```bash
git add src/ server/server.js server/package.json Dockerfile .gitignore
git commit -m "описание"
git push origin main
```

### Откат
```bash
git log --oneline -5          # найти нужный коммит
git checkout <hash> -- src/   # откатить конкретные файлы
npm run deploy                # задеплоить
```

### Очистка истории (если попали секреты)
```bash
git filter-repo --invert-paths --path server/.env --path .env --force
git remote add origin https://github.com/artemwork9786-hash/MARXSHOP.git
git push origin main --force
```

---

## URL

| Сервис | URL |
|--------|-----|
| Фронтенд | https://artemwork9786-hash.github.io/MARXSHOP |
| Бэкенд | https://bbaq0jmusbs0rseu0f1g.containers.yandexcloud.net |
| S3 видео | https://storage.yandexcloud.net/marx-shop-videos |
| GitHub | https://github.com/artemwork9786-hash/MARXSHOP |

---

## .env файлы

**Фронтенд** (`.env` в корне):
```
VITE_API_URL=https://bbaq0jmusbs0rseu0f1g.containers.yandexcloud.net
```

**Бэкенд** (`server/.env` — НЕ коммитить!):
```
PORT=5000
TG_BOT_TOKEN=...
CRYPTO_BOT_TOKEN=...
FRONTEND_URL=https://artemwork9786-hash.github.io/MARXSHOP
YC_BUCKET=marx-shop-videos
YC_REGION=ru-central1
YC_ACCESS_KEY=...
YC_SECRET_KEY=...
YC_PUBLIC_URL=https://storage.yandexcloud.net/marx-shop-videos
```

---

## Ключевые находки сессии

- `overflow-hidden` ломает `backdrop-filter` (blur) — используем `clip-path` или убираем
- `clip-path` на контейнере ломает fullscreen видео (z-index stacking context)
- Решение: НЕ использовать `overflow-hidden` и `clip-path` на корневом контейнере карточки
- Telegram WebView не поддерживает CDN для `telegram-web-app.js` — хостим локально
- `ResizeObserver` для динамического layout (порог 280px)
- Вкладки админки — drag-скролл с fade-эффектами (как теги в карточке)
