require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

// Импорт API маршрутов
const app = require('./api/index');
const generateHandler = require('./api/generate');

// Конфигурация порта
const port = process.env.PORT || 3000;

// Маршрут для генерации изображений
app.post('/api/generate', generateHandler);

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
  console.log(`Открывайте http://localhost:${port}`);
}); 