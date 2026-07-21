# План: Исправление средних проблем MVP

## M1: CORS → restrict origin ✅
- [x] Ограничить CORS на GitHub Pages + Telegram
- Файл: `server/server.js`

## M2: Debug endpoints → удалить ✅
- [x] Удалить `/api/debug/whoami` и `/api/debug/initdata-check`
- Файл: `server/server.js`

## M3: Admin username → env ✅ (частично)
- [x] Вынести `ADMIN_USERNAME` в `process.env.ADMIN_USERNAME`
- [x] Добавить `/api/config` эндпоинт
- [ ] Фронтенд: загружать username с сервера (оставлено hardcoded для MVP)

## M5: rentTerms миграция ✅
- [x] Добавить `parseLabelToMs()` для конвертации "6 часов" → 21600000
- [x] Миграция при загрузке: `durationMs = parseLabelToMs(label)`
- Файл: `server/server.js`

## M7: Dead code в App.jsx
- [ ] Удалить неиспользуемые импорты (ЧАСТИЧНО — убраны createOrder, checkOrder, confirmSbp, verifyInvoice)
- [ ] Удалить неиспользуемые state (ОСТАВЛЕНО для MVP — может сломать ProfileTab)

## M8: multer dead code + busboy dep ✅
- [x] Удалить импорт и конфиг multer
- [x] Добавить busboy в package.json
- [x] Удалить multer из package.json
- Файлы: `server/server.js`, `server/package.json`

## M9: Duplicate convertPrice ✅
- [x] Создать `src/utils/currency.js`
- [x] Импортировать в AccountCard и PaymentFlow
- [x] Удалить локальные функции
