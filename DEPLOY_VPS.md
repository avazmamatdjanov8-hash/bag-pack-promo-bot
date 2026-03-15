# Deploy to VPS

Ниже самый простой путь для Ubuntu VPS.

## 1. Что купить

Берите VPS с такими параметрами:

- Ubuntu 24.04
- 1 vCPU
- 2 GB RAM
- 20 GB SSD

## 2. Подключение к серверу

На Windows откройте PowerShell:

```powershell
ssh root@IP_СЕРВЕРА
```

## 3. Установка Docker

На сервере выполните:

```bash
apt update
apt install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin git
```

## 4. Загрузить проект

Если проект уже есть в Git:

```bash
git clone URL_ВАШЕГО_РЕПО bag-pack-promo
cd bag-pack-promo
```

Если Git-репозитория нет, можно загрузить проект позже через архив или я помогу вам подготовить репозиторий.

## 5. Настроить .env

Создайте `.env`:

```bash
nano .env
```

Минимально нужно:

```env
BOT_TOKEN=ВАШ_ТОКЕН
SUBSCRIPTION_REQUIRED=false
REQUIRED_CHANNEL_ID=@your_channel
REQUIRED_CHANNEL_URL=https://t.me/your_channel
ADMIN_IDS=ВАШ_TELEGRAM_ID
DATABASE_PATH=./data/promo.sqlite
ADMIN_PORT=3000
ADMIN_HOST=0.0.0.0
ADMIN_USERNAME=admin
ADMIN_PASSWORD=CHANGE_STRONG_PASSWORD
```

## 6. Запуск

```bash
docker compose up -d --build
```

## 7. Проверка

Проверить контейнеры:

```bash
docker compose ps
```

Посмотреть логи:

```bash
docker compose logs -f
```

## 8. Открыть админку

В браузере:

```text
http://IP_СЕРВЕРА:3000
```

## 9. Важно

Для нормального продакшна лучше потом:

- поставить домен;
- включить HTTPS через Nginx + Cloudflare;
- ограничить доступ к админке по IP или паролю;
- позже вынести базу из SQLite в PostgreSQL, если участников станет много.
