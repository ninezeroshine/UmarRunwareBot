# Генератор изображений Runware для Telegram

Простое Telegram Mini App для генерации изображений с использованием Runware API.

## Возможности

- Генерация изображений по текстовому запросу
- Выбор различных моделей
- Настройка параметров генерации (размер, количество шагов, CFG Scale)
- Генерация нескольких изображений за один запрос
- Адаптивный дизайн в темной и светлой теме Telegram

## Настройка

### Переменные окружения

Создайте файл `.env` в корневой папке проекта со следующими параметрами:

```
# Настройки сервера
PORT=3000
NODE_ENV=development

# Настройки Telegram бота
TELEGRAM_API_TOKEN=ваш_токен_бота
WEBAPP_URL=https://ваш-домен.vercel.app/

# Настройки Runware API
RUNWARE_API_URL=wss://api.runware.ai/ws
RUNWARE_API_KEY=ваш_ключ_api
```

### Установка зависимостей

```bash
npm install
```

## Запуск

### Локальная разработка

```bash
npm run dev
```

### Запуск сервера

```bash
npm start
```

## Подключение к Telegram

1. Создайте бота через [@BotFather](https://t.me/BotFather)
2. Получите API токен
3. Включите возможность Inline Mode для бота
4. Настройте веб-приложение:
   ```
   /setmenubutton
   ```
   и укажите URL вашего приложения (например, `https://ваш-домен.vercel.app/`)

## Деплой на Vercel

1. Создайте аккаунт на [Vercel](https://vercel.com)
2. Создайте новый проект и подключите ваш репозиторий
3. Настройте переменные окружения в настройках проекта:
   - `TELEGRAM_API_TOKEN`
   - `RUNWARE_API_KEY`
   - `RUNWARE_API_URL`
   - `NODE_ENV=production`
4. Запустите деплой

## Структура проекта

- `server.js` - Серверная часть, Express-сервер с подключением к Runware API
- `public/` - Клиентская часть:
  - `index.html` - HTML-страница Telegram Mini App
  - `styles.css` - Стили приложения
  - `app.js` - Логика клиентской части
- `package.json` - Зависимости и скрипты проекта
- `vercel.json` - Конфигурация для деплоя на Vercel
