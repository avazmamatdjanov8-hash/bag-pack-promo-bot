# Bag & Pack Promo Bot

Telegram-бот для промо-акции Bag & Pack с локальной админ-панелью.

Что умеет система:

- регистрирует участника по номеру телефона;
- не даёт пользоваться ботом, пока номер телефона не сохранён;
- принимает уникальные промокоды с товаров;
- скрывает общий рейтинг от участников;
- показывает администратору полную статистику;
- позволяет управлять кодами через локальную админку в браузере.

## Что есть в проекте

- [src/bot.js](C:\Users\yaaza\OneDrive\Desktop\bag&pack_promo\src\bot.js) — Telegram-бот.
- [src/admin.js](C:\Users\yaaza\OneDrive\Desktop\bag&pack_promo\src\admin.js) — локальная админка.
- [src/db.js](C:\Users\yaaza\OneDrive\Desktop\bag&pack_promo\src\db.js) — работа с SQLite базой.
- [scripts/generate-codes.js](C:\Users\yaaza\OneDrive\Desktop\bag&pack_promo\scripts\generate-codes.js) — генерация промокодов.
- [scripts/import-codes.js](C:\Users\yaaza\OneDrive\Desktop\bag&pack_promo\scripts\import-codes.js) — импорт кодов из CSV.
- [Dockerfile.bot](C:\Users\yaaza\OneDrive\Desktop\bag&pack_promo\Dockerfile.bot) — отдельная сборка только для публичного бота.
- [DEPLOY_BOT_ONLY.md](C:\Users\yaaza\OneDrive\Desktop\bag&pack_promo\DEPLOY_BOT_ONLY.md) — короткий сценарий для вынесения только бота на хостинг.

## Формат промокодов

Теперь код выглядит примерно так:

```text
PAK-7M4-Q2R
STR-D8Q-T4M
MLK-Q7N-X5R
```

Префикс сохраняет тип товара:

- `PAK` — пакеты
- `STR` — стрейч-пленки
- `MLK` — мешки для лука

Остальная часть случайная, поэтому код трудно угадать.

## Быстрый запуск

1. Откройте PowerShell.
2. Перейдите в проект:

```powershell
cd "C:\Users\yaaza\OneDrive\Desktop\bag&pack_promo"
```

3. Установите зависимости:

```powershell
npm.cmd install
```

4. Сгенерируйте тестовые коды:

```powershell
npm.cmd run generate:codes
```

5. Загрузите их в базу:

```powershell
npm.cmd run import:codes -- .\codes.generated.csv
```

6. Запустите админку:

```powershell
npm.cmd run admin
```

7. Откройте в браузере:

```text
http://localhost:3000
```

8. Если нужен сам бот, отдельно запустите:

```powershell
npm.cmd start
```

## Админка

Админка работает только локально на этом компьютере.

Адрес:

```text
http://localhost:3000
```

Вход:

- логин: `admin`
- пароль: `change_this_password`

Лучше сразу поменять пароль в [.env](C:\Users\yaaza\OneDrive\Desktop\bag&pack_promo\.env).

## Что есть в админке

- `Обзор` — общая статистика;
- `Участники` — список и карточки участников;
- `Промокоды` — поиск, фильтр, освобождение и удаление кодов;
- `Вводы` — история ввода кодов;
- `Управление` — генерация серий, ручное добавление и импорт списков.

## Где находится база

SQLite-файл:

```text
C:\Users\yaaza\OneDrive\Desktop\bag&pack_promo\data\promo.sqlite
```

Основные таблицы:

- `participants` — участники;
- `promo_codes` — все допустимые промокоды;
- `code_entries` — история ввода кодов.

## Переменные окружения

Файл конфигурации:
[.env](C:\Users\yaaza\OneDrive\Desktop\bag&pack_promo\.env)

Главные параметры:

- `BOT_TOKEN` — токен Telegram-бота;
- `SUBSCRIPTION_REQUIRED` — обязательна ли подписка на канал;
- `REQUIRED_CHANNEL_ID` — id или `@username` канала;
- `REQUIRED_CHANNEL_URL` — ссылка на канал;
- `ADMIN_IDS` — Telegram ID администраторов;
- `DATABASE_PATH` — путь к SQLite базе;
- `ADMIN_PORT` — порт админки;
- `ADMIN_HOST` — адрес локального запуска, сейчас `127.0.0.1`;
- `ADMIN_USERNAME` — логин админки;
- `ADMIN_PASSWORD` — пароль админки.

## Полезные команды

Текстовый отчёт по базе:

```powershell
npm.cmd run db:report
```

Если PowerShell ругается на `npm`, используйте `npm.cmd`.

## Важно

Если токен бота уже попадал в переписку или показывался кому-то ещё, лучше перевыпустить его через `@BotFather`.
