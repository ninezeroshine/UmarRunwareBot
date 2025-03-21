const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');
const runwareApi = require('./runware_api');

// Инициализация приложения Express
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Разрешаем запросы с разных доменов
app.use(express.json()); // Парсинг JSON-запросов
app.use(morgan('dev')); // Логирование запросов

// Статические файлы из директории frontend
app.use(express.static(path.join(__dirname)));

// Корневой маршрут для отдачи HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Обработчик для проверки состояния сервера
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    connected: runwareApi.isConnected() || false
  });
});

// Получение списка доступных моделей
app.get('/api/models', (req, res) => {
  res.json({ models: config.FLUX_MODELS || [] });
});

// Получение списка доступных размеров изображений
app.get('/api/sizes', (req, res) => {
  res.json({ sizes: config.AVAILABLE_SIZES || [] });
});

// Получение конфигурации по умолчанию
app.get('/api/default-settings', (req, res) => {
  res.json({ settings: config.DEFAULT_SETTINGS || {} });
});

// Генерация изображения
app.post('/api/generate', async (req, res) => {
  try {
    const {
      prompt,
      model,
      width,
      height,
      steps,
      cfg_scale,
      number_results,
      loras
    } = req.body;
    
    // Проверка обязательных параметров
    if (!prompt) {
      return res.status(400).json({ error: 'Промпт не может быть пустым' });
    }
    
    if (!model) {
      return res.status(400).json({ error: 'Не выбрана модель' });
    }
    
    console.log(`Запрос на генерацию изображения. Модель: ${model}, Промпт: ${prompt}`);
    
    // Подключение к API если нужно
    if (!runwareApi.isConnected()) {
      await runwareApi.connect();
    }
    
    // Вызов API для генерации
    const imageUrls = await runwareApi.generateImage({
      prompt,
      model,
      width: width || 512,
      height: height || 512,
      steps: steps || 30,
      cfg_scale: cfg_scale || 7.5,
      number_results: number_results || 1,
      loras: loras || []
    });
    
    res.json({ images: imageUrls });
    
  } catch (error) {
    console.error('Ошибка при генерации изображения:', error);
    res.status(500).json({ error: error.message || 'Произошла ошибка при генерации изображения' });
  }
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Для локального запуска
if (process.env.NODE_ENV !== 'production') {
  async function startServer() {
    try {
      // Подключение к API Runware
      await runwareApi.connect();
      console.log('Соединение с Runware API установлено');
      
      // Запуск веб-сервера
      app.listen(port, () => {
        console.log(`Сервер запущен на порту ${port}`);
        console.log(`Интерфейс доступен по адресу: http://localhost:${port}`);
      });
      
    } catch (error) {
      console.error('Ошибка при запуске сервера:', error);
      process.exit(1);
    }
  }
  
  // Запуск сервера локально
  startServer();
}

// Для production окружения (Vercel)
module.exports = app;
