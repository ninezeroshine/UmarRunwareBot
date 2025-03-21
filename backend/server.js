const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');
const runwareApi = require('./runware_api');
const { startBot } = require('./telegram_bot');

// Инициализация приложения Express
const app = express();
const port = config.PORT;

// Middleware
app.use(cors()); // Разрешаем запросы с разных доменов (для разработки)
app.use(express.json()); // Парсинг JSON-запросов
app.use(morgan('dev')); // Логирование запросов

// Статические файлы из директории frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Обработчик для проверки состояния сервера
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    connected: runwareApi.connected 
  });
});

// Получение списка доступных моделей
app.get('/api/models', (req, res) => {
  res.json({ models: config.FLUX_MODELS });
});

// Получение списка доступных размеров изображений
app.get('/api/sizes', (req, res) => {
  res.json({ sizes: config.AVAILABLE_SIZES });
});

// Получение конфигурации по умолчанию
app.get('/api/default-settings', (req, res) => {
  res.json({ settings: config.DEFAULT_SETTINGS });
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

// Запуск сервера
async function startServer() {
  try {
    // Подключение к API Runware
    await runwareApi.connect();
    console.log('Соединение с Runware API установлено');
    
    // Запуск Telegram бота
    await startBot();
    
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

// Обработка завершения работы
process.on('SIGINT', async () => {
  console.log('Завершение работы сервера...');
  await runwareApi.close();
  process.exit(0);
});

// Запуск сервера
startServer();
