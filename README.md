# Flux Generator - Telegram Mini App

Веб-приложение для Telegram, позволяющее генерировать изображения с использованием модели Flux от Runware.

## Особенности

- 🖼️ Генерация изображений с помощью модели Flux
- 📱 Интеграция с Telegram как Mini App
- 🎛️ Гибкие настройки параметров генерации
- ⭐ Поддержка LoRA моделей для дополнительной настройки
- 🌓 Автоматическая адаптация к светлой/темной теме Telegram

## Структура проекта

```
/
├── frontend/              # Клиентская часть (Mini App)
│   ├── index.html         # HTML структура
│   ├── styles.css         # CSS стили
│   ├── app.js             # JavaScript логика
│   └── ...
│
├── backend/               # Серверная часть
│   ├── server.js          # Express сервер
│   ├── runware_api.js     # Модуль для работы с Runware API
│   ├── telegram_bot.js    # Модуль для работы с Telegram API
│   ├── config.js          # Конфигурация
│   └── ...
│
├── .env                   # Переменные окружения (не включать в репозиторий)
├── package.json           # Зависимости проекта
└── README.md              # Документация
```

## Установка и запуск

### Предварительные требования

- Node.js 16.x или выше
- Telegram бот, созданный через [@BotFather](https://t.me/BotFather)
- API ключ от Runware для доступа к модели Flux

### Настройка

1. Клонируйте репозиторий:
   ```bash
   git clone <репозиторий>
   cd <директория-проекта>
   ```

2. Установите зависимости:
   ```bash
   npm run install-deps
   ```

3. Создайте файл `.env` на основе `.env.example` и заполните его:
   ```bash
   cp .env.example .env
   ```

4. Заполните переменные окружения в файле `.env`:
   ```
   TELEGRAM_API_TOKEN=your_telegram_bot_token_here
   WEBAPP_URL=https://your-app-domain.com
   RUNWARE_API_KEY=your_runware_api_key_here
   ```

### Запуск для разработки

```bash
npm run dev
```

### Запуск для продакшн

```bash
npm start
```

## Настройка Telegram Mini App

1. В [@BotFather](https://t.me/BotFather) выполните команду `/newapp`
2. Выберите бота, для которого хотите создать веб-приложение
3. Укажите название и краткое описание
4. Загрузите иконку для приложения
5. Укажите ссылку на ваше размещенное приложение (должно быть HTTPS)
6. Настройте меню бота через `/mybots` -> Ваш бот -> Bot Settings -> Menu Button

## Использование

1. Откройте бота в Telegram
2. Нажмите кнопку "Генерировать изображение"
3. Введите промпт и настройте параметры
4. Нажмите кнопку "Генерировать"
5. Полученные изображения будут отправлены в чат с ботом

## Технологии

- Frontend: HTML, CSS, JavaScript (без фреймворков для минимального размера)
- Backend: Node.js, Express
- API: Runware Flux API, Telegram Bot API
- Связь: WebSockets для Runware API
