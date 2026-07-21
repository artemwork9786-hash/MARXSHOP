# План: Исправление критических и высоких проблем MVP

## Критические (C1-C3)

### C1: .gitignore — секреты ✅
- [x] Добавить `server/.env` в `.gitignore`

### C2: HMAC validation для admin auth ✅
- [x] Добавить функцию `verifyTelegramInitData(initData, botToken)` — проверка HMAC-SHA256
- [x] Обновить `requireAdmin` — вызывать верификацию
- [x] Использовать `TG_BOT_TOKEN` из env

### C3: Crypto webhook signature
- [ ] Добавить проверку подписи в `/api/webhook/crypto`
- [ ] Использовать `CRYPTO_BOT_TOKEN` для HMAC

## Высокие (H1-H6)

### H1: test-pay авторизация
- [x] Пропущено — test-pay используется пользователем, админ проверяет оплату

### H2: Пароли
- [ ] Генерировать случайный пароль при выдаче аккаунта
- [ ] Сохранять в БД
- [ ] Убрать из фронтенда вычисление пароля

### H3: check-order без авторизации
- [ ] Добавить проверку: запрашивает ли владелец заказа

### H4: Rate limiting
- [ ] Установить `express-rate-limit`
- [ ] Лимит на чувствительные эндпоинты

### H5: create-order — неверный статус ✅
- [x] Заменить `"В наличии"` на `"available"` в проверке

### H6: verify-order без requireAdmin ✅
- [x] Добавить `requireAdmin` на `/api/admin/verify-order`

## Средние

### M4: Миграция — не сбрасывать busy ✅
- [x] Убрал сброс "Занят" → "available"
- [x] "Занят" → "waiting_payment"

### M6: reserveAccount — English статусы ✅
- [x] Заменил "В наличии" → "available", "Занят" → "waiting_payment"
