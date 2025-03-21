// API для Vercel - основная точка входа
const express = require('express');
const cors = require('cors');
const path = require('path');

// Инициализация Express
const app = express();

// Базовые Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Маршрут для главной страницы
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Маршрут для проверки работы API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Модели по умолчанию
const MODELS = {
  'FLUX Dev': 'runware:101@1',
  'FLUX Realistic': 'runware:18838@1',
  'FLUX Fantasy': 'runware:18839@1',
  'FLUX Anime': 'runware:18840@1'
};

// Доступные размеры
const SIZES = {
  '512x512': [512, 512],
  '768x768': [768, 768],
  '1024x1024': [1024, 1024]
};

// API для получения списка моделей
app.get('/api/models', (req, res) => {
  res.json({ models: MODELS });
});

// API для получения списка размеров
app.get('/api/sizes', (req, res) => {
  res.json({ sizes: SIZES });
});

module.exports = app; 