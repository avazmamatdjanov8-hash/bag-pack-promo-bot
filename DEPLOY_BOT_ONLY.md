# Public Bot Only

Если нужен только общедоступный Telegram-бот, а админку вы хотите оставить локально, используйте этот сценарий.

## Как это будет работать

- бот запускается на внешнем хостинге и работает 24/7;
- админка остаётся только на вашем компьютере;
- участники всегда могут пользоваться ботом;
- вы управляете базой и кодами локально через админку.

## Что уже подготовлено

- [Dockerfile.bot](C:\Users\yaaza\OneDrive\Desktop\bag&pack_promo\Dockerfile.bot) — отдельная сборка только для бота.

## Что нужно на хостинге

Минимальные переменные окружения:

```env
BOT_TOKEN=ВАШ_ТОКЕН
SUBSCRIPTION_REQUIRED=false
REQUIRED_CHANNEL_ID=@your_channel
REQUIRED_CHANNEL_URL=https://t.me/your_channel
ADMIN_IDS=ВАШ_TELEGRAM_ID
DATABASE_PATH=./data/promo.sqlite
```

## Идея запуска

На любом always-on хостинге с Docker:

```bash
docker build -f Dockerfile.bot -t bag-pack-bot .
docker run -d --name bag-pack-bot --restart unless-stopped --env-file .env bag-pack-bot
```

## Важно

Если база останется только локально у вас на компьютере, удалённый бот не увидит ваши локальные изменения. Для настоящей общей работы бот и база должны находиться в одном месте.

Поэтому для следующего шага лучше:

1. Вынести только бота на хостинг.
2. Потом решить, где будет общая база данных.
