// Основной модуль API для маршрутизации
const express = require('express');
const cors = require('cors');
const path = require('path');

// Обработчик API генерации
const generateHandler = require('./generate');

// Создаем экземпляр Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Статические файлы
app.use(express.static(path.join(__dirname, '..', 'public')));

// Маршруты API
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// API для проверки работоспособности
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API для генерации изображений
app.post('/api/generate', generateHandler);

// Запуск сервера если файл запущен напрямую (не через Vercel)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
  });
}

// Экспорт для Vercel
module.exports = app; 