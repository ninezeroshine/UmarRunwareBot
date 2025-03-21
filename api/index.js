// Основной модуль API для маршрутизации
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Обработчики API
const generateHandler = require('./generate');
const healthHandler = require('./health');
const telegramHandler = require('./telegram');

// Базовые модели и размеры по умолчанию
const DEFAULT_MODELS = {
  'FLUX Realistic': 'runware:18838@1',
  'FLUX Dev': 'runware:101@1',
  'FLUX Anime': 'runware:18840@1',
  'FLUX Fantasy': 'runware:18839@1'
};

const DEFAULT_SIZES = {
  '512x512': [512, 512],
  '768x768': [768, 768],
  '1024x1024': [1024, 1024],
  '1024x576': [1024, 576],
  '576x1024': [576, 1024]
};

// Создаем экземпляр Express
const app = express();

// Логирование всех запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические файлы
app.use(express.static(path.join(__dirname, '..', 'public')));

// Маршруты API
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Проверка работоспособности
app.get('/api/health', healthHandler);

// Telegram вебхук и управление ботом
app.all('/api/telegram', telegramHandler);

// API для генерации изображений
app.post('/api/generate', generateHandler);

// API для получения доступных моделей
app.get('/api/models', (req, res) => {
  console.log('API /models: Запрос списка моделей');
  console.log('API /models: Отправляем модели:', DEFAULT_MODELS);
  
  // Проверяем, что все идентификаторы моделей соответствуют формату AIR
  for (const [name, id] of Object.entries(DEFAULT_MODELS)) {
    if (!id.match(/^[a-zA-Z0-9]+:[0-9]+@[0-9]+$/)) {
      console.error(`API /models: Модель ${name} имеет неверный формат идентификатора: ${id}`);
    }
  }
  
  res.json({ models: DEFAULT_MODELS });
});

// API для получения доступных размеров
app.get('/api/sizes', (req, res) => {
  console.log('API /sizes: Запрос списка размеров');
  res.json({ sizes: DEFAULT_SIZES });
});

// Обработка 404
app.use((req, res) => {
  console.log(`404 - Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Не найдено' });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Запуск сервера если файл запущен напрямую (не через Vercel)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
  });
}

// Экспорт для Vercel
module.exports = app; 