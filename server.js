require('dotenv').config();
const express = require('express');
const path = require('path');
const WebSocket = require('ws');

// Инициализация Express
const app = express();
const port = process.env.PORT || 3000;

// Настройки Runware API
const RUNWARE_API_URL = process.env.RUNWARE_API_URL || 'wss://api.runware.ai/ws';
const RUNWARE_API_KEY = process.env.RUNWARE_API_KEY;

// Базовые Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket соединение
let wsConnection = null;
let connected = false;
let messageId = 1;
let pendingMessages = {};
let messageHandlers = {};

// Подключение к Runware API
async function connectToRunwareAPI() {
  return new Promise((resolve, reject) => {
    try {
      console.log('Подключение к Runware API...');
      
      const ws = new WebSocket(RUNWARE_API_URL);
      
      ws.on('open', () => {
        console.log('WebSocket соединение установлено');
        wsConnection = ws;
        
        // Аутентификация
        const authMessage = {
          type: 'authenticate',
          payload: {
            api_key: RUNWARE_API_KEY
          },
          id: messageId++
        };
        
        pendingMessages[authMessage.id] = {
          resolve: () => {
            console.log('Аутентификация успешна');
            connected = true;
            resolve(true);
          },
          reject: (error) => {
            console.error('Ошибка аутентификации:', error);
            connected = false;
            reject(error);
          }
        };
        
        ws.send(JSON.stringify(authMessage));
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          console.log('Получено сообщение:', message.type || 'Неизвестный тип');
          
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
          console.error('Ошибка обработки сообщения:', error);
        }
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket ошибка:', error);
        connected = false;
        wsConnection = null;
        reject(error);
      });
      
      ws.on('close', () => {
        console.log('WebSocket соединение закрыто');
        connected = false;
        wsConnection = null;
      });
    } catch (error) {
      console.error('Ошибка подключения к Runware API:', error);
      reject(error);
    }
  });
}

// Отправка сообщения в Runware API
async function sendMessage(message) {
  return new Promise(async (resolve, reject) => {
    try {
      // Подключаемся, если нет соединения
      if (!connected || !wsConnection) {
        await connectToRunwareAPI();
      }
      
      const id = messageId++;
      message.id = id;
      
      pendingMessages[id] = { resolve, reject };
      
      wsConnection.send(JSON.stringify(message));
      
      // Таймаут на ответ
      setTimeout(() => {
        if (pendingMessages[id]) {
          delete pendingMessages[id];
          reject(new Error('Таймаут ответа от API'));
        }
      }, 60000); // 60 секунд
    } catch (error) {
      reject(error);
    }
  });
}

// Генерация изображения
async function generateImage(options) {
  const {
    prompt,
    model,
    width = 512,
    height = 512,
    steps = 30,
    cfg_scale = 7.5,
    number_results = 1
  } = options;
  
  try {
    const request = {
      type: 'generate',
      payload: {
        prompt,
        model,
        width,
        height,
        steps,
        cfg_scale,
        batch_size: number_results
      }
    };
    
    console.log('Отправка запроса на генерацию:', request);
    
    const response = await sendMessage(request);
    console.log('Получен ответ на запрос генерации');
    
    return new Promise((resolve, reject) => {
      let timeout = setTimeout(() => {
        reject(new Error('Таймаут ожидания результата генерации'));
      }, 300000); // 5 минут
      
      messageHandlers['generation_result'] = (result) => {
        clearTimeout(timeout);
        
        if (result.payload.error) {
          reject(new Error(result.payload.error));
          return;
        }
        
        // Обработка разных форматов ответа
        if (result.payload.imageURLs && Array.isArray(result.payload.imageURLs)) {
          resolve(result.payload.imageURLs);
        } else if (result.payload.images && Array.isArray(result.payload.images)) {
          resolve(result.payload.images.map(img => img.url));
        } else if (result.payload.imageURL) {
          resolve([result.payload.imageURL]);
        } else {
          reject(new Error('Неизвестный формат ответа'));
        }
      };
    });
  } catch (error) {
    console.error('Ошибка генерации изображения:', error);
    throw error;
  }
}

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

// API для генерации изображения
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, model, width, height, steps, cfg_scale, number_results } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Отсутствует промпт' });
    }
    
    if (!model) {
      return res.status(400).json({ error: 'Не выбрана модель' });
    }
    
    console.log(`Запрос на генерацию. Модель: ${model}, Промпт: ${prompt}`);
    
    const imageUrls = await generateImage({
      prompt,
      model,
      width: width || 512,
      height: height || 512,
      steps: steps || 30,
      cfg_scale: cfg_scale || 7.5,
      number_results: number_results || 1
    });
    
    res.json({ images: imageUrls });
    
  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).json({ error: error.message || 'Ошибка генерации изображения' });
  }
});

// API для получения списка моделей
app.get('/api/models', (req, res) => {
  res.json({ models: MODELS });
});

// API для получения списка размеров
app.get('/api/sizes', (req, res) => {
  res.json({ sizes: SIZES });
});

// Маршрут для главной страницы
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
async function startServer() {
  try {
    // Подключаемся к Runware API
    await connectToRunwareAPI();
    
    // Запускаем веб-сервер
    app.listen(port, () => {
      console.log(`Сервер запущен на порту ${port}`);
      console.log(`Открывайте http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Ошибка запуска сервера:', error);
    process.exit(1);
  }
}

startServer(); 