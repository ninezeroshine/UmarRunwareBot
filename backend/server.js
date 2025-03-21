const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const WebSocket = require('ws');
const config = require('./config');

// Инициализация приложения Express
const app = express();
const port = process.env.PORT || 3000;

// Настройка соединения с Runware API
let wsConnection = null;
let connected = false;
let messageHandlers = {};
let pendingMessages = {};
let messageId = 1;

// Middleware
app.use(cors()); // Разрешаем запросы с разных доменов
app.use(express.json()); // Парсинг JSON-запросов
app.use(morgan('dev')); // Логирование запросов

// Статические файлы из текущей директории
app.use(express.static(__dirname));

// Корневой маршрут для отдачи HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Обработчик для проверки состояния сервера
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    version: '1.0.0',
    connected: connected
  });
});

// Подключение к Runware API
async function connectToRunwareAPI() {
  return new Promise((resolve, reject) => {
    try {
      console.log('Connecting to Runware API:', config.RUNWARE_API_URL);
      
      const ws = new WebSocket(config.RUNWARE_API_URL);
      
      ws.on('open', () => {
        console.log('WebSocket connection established');
        wsConnection = ws;
        
        // Отправляем запрос на аутентификацию
        const authMessage = {
          type: 'authenticate',
          payload: {
            api_key: config.RUNWARE_API_KEY
          },
          id: messageId++
        };
        
        // Добавляем обработчик для ответа аутентификации
        pendingMessages[authMessage.id] = {
          resolve: () => {
            console.log('Authentication successful');
            connected = true;
            resolve(true);
          },
          reject: (error) => {
            console.error('Authentication failed:', error);
            connected = false;
            reject(error);
          }
        };
        
        ws.send(JSON.stringify(authMessage));
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          console.log('Received message from Runware API:', message.type || 'Unknown type');
          
          // Обработка ответа на сообщение
          if (message.id && pendingMessages[message.id]) {
            const { resolve, reject } = pendingMessages[message.id];
            
            if (message.error) {
              reject(message.error);
            } else {
              resolve(message);
            }
            
            delete pendingMessages[message.id];
          }
          
          // Обработка по типу сообщения
          if (message.type && messageHandlers[message.type]) {
            messageHandlers[message.type](message);
          }
        } catch (error) {
          console.error('Error handling message:', error);
        }
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        connected = false;
        reject(error);
      });
      
      ws.on('close', () => {
        console.log('WebSocket connection closed');
        connected = false;
        wsConnection = null;
      });
    } catch (error) {
      console.error('Error connecting to Runware API:', error);
      reject(error);
    }
  });
}

// Отправка сообщения в Runware API
async function sendMessage(message) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!connected || !wsConnection) {
        await connectToRunwareAPI();
      }
      
      const id = messageId++;
      message.id = id;
      
      pendingMessages[id] = { resolve, reject };
      
      wsConnection.send(JSON.stringify(message));
      
      // Таймаут на получение ответа
      setTimeout(() => {
        if (pendingMessages[id]) {
          delete pendingMessages[id];
          reject(new Error('Response timeout'));
        }
      }, 60000); // 60 секунд таймаут
    } catch (error) {
      reject(error);
    }
  });
}

// Функция генерации изображения
async function generateImage(options) {
  const {
    prompt,
    model,
    width = 512,
    height = 512,
    steps = 30,
    cfg_scale = 7.5,
    negative_prompt = "",
    number_results = 1,
    loras = []
  } = options;
  
  try {
    // Формируем запрос на генерацию
    const request = {
      type: 'generate',
      payload: {
        prompt,
        model,
        width,
        height,
        steps,
        cfg_scale,
        negative_prompt,
        batch_size: number_results,
        loras: loras.map(lora => ({
          model: lora.model,
          weight: lora.weight
        }))
      }
    };
    
    console.log('Sending generation request:', request);
    
    // Отправляем запрос и ожидаем результат
    const response = await sendMessage(request);
    console.log('Received response for generation request');
    
    // Ожидаем результат генерации
    return new Promise((resolve, reject) => {
      let timeout = setTimeout(() => {
        reject(new Error('Generation result timeout'));
      }, 300000); // 5 минут таймаут
      
      // Обработчик для результата генерации
      messageHandlers['generation_result'] = (result) => {
        clearTimeout(timeout);
        
        if (result.payload.error) {
          reject(new Error(result.payload.error));
          return;
        }
        
        // Извлекаем URL изображений
        if (result.payload.imageURLs && Array.isArray(result.payload.imageURLs)) {
          resolve(result.payload.imageURLs);
        } else if (result.payload.images && Array.isArray(result.payload.images)) {
          resolve(result.payload.images.map(img => img.url));
        } else if (result.payload.imageURL) {
          resolve([result.payload.imageURL]);
        } else {
          reject(new Error('Unknown response format'));
        }
      };
    });
  } catch (error) {
    console.error('Error generating image:', error);
    throw error;
  }
}

// Получение списка доступных моделей
app.get('/api/models', (req, res) => {
  res.json({ models: config.FLUX_MODELS || {} });
});

// Получение списка доступных размеров изображений
app.get('/api/sizes', (req, res) => {
  res.json({ sizes: config.AVAILABLE_SIZES || {} });
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
    
    // Генерация изображения
    const imageUrls = await generateImage({
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
      await connectToRunwareAPI();
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
} else {
  // В production сначала пытаемся подключиться к API
  (async () => {
    try {
      await connectToRunwareAPI();
      console.log('Соединение с Runware API установлено');
    } catch (error) {
      console.error('Ошибка подключения к Runware API:', error);
      // Продолжаем работу даже при ошибке подключения
    }
  })();
}

// Для production окружения (Vercel)
module.exports = app;
