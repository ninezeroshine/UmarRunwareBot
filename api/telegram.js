// Модуль для взаимодействия с Telegram Bot API
const https = require('https');

// Базовый URL API Telegram
const TELEGRAM_API_BASE = 'api.telegram.org';

// Обработчик запросов к API Telegram
module.exports = async (req, res) => {
  console.log('API /telegram: Получен запрос');
  
  // Проверка токена бота
  const token = process.env.TELEGRAM_API_TOKEN;
  if (!token) {
    console.error('API /telegram: Отсутствует TELEGRAM_API_TOKEN в переменных окружения');
    return res.status(500).json({ error: 'Отсутствует токен Telegram' });
  }
  
  try {
    // GET запрос - получение информации о боте
    if (req.method === 'GET') {
      console.log('API /telegram: Запрос информации о боте');
      
      const botInfo = await makeRequest(token, 'getMe');
      
      return res.status(200).json({
        status: 'success',
        bot: botInfo.result,
        timestamp: new Date().toISOString()
      });
    }
    
    // POST запрос - установка вебхука и команд бота
    else if (req.method === 'POST') {
      console.log('API /telegram: Запрос на настройку бота');
      
      // Получение хоста из заголовка или параметра
      const host = req.headers.host || req.body.host;
      if (!host) {
        return res.status(400).json({ error: 'Не указан хост для вебхука' });
      }
      
      // Формируем URL вебхука
      const webhookUrl = `https://${host}/api/webhook`;
      console.log(`API /telegram: Установка вебхука ${webhookUrl}`);
      
      // Устанавливаем вебхук
      const webhookResult = await makeRequest(token, 'setWebhook', {
        url: webhookUrl,
        drop_pending_updates: true
      });
      
      // Устанавливаем команды бота
      const commandsResult = await makeRequest(token, 'setMyCommands', {
        commands: [
          { command: 'start', description: 'Запустить бота' },
          { command: 'generate', description: 'Сгенерировать изображение' }
        ]
      });
      
      // Устанавливаем кнопку меню для веб-приложения
      const webAppUrl = `https://${host}`;
      console.log(`API /telegram: Установка веб-приложения ${webAppUrl}`);
      
      const menuButtonResult = await makeRequest(token, 'setChatMenuButton', {
        menu_button: {
          type: 'web_app',
          text: 'Генератор',
          web_app: { url: webAppUrl }
        }
      });
      
      return res.status(200).json({
        status: 'success',
        webhook: webhookResult.result,
        commands: commandsResult.result,
        menu_button: menuButtonResult.result,
        timestamp: new Date().toISOString()
      });
    }
    
    // Остальные методы не поддерживаются
    else {
      console.error(`API /telegram: Неподдерживаемый метод ${req.method}`);
      return res.status(405).json({ error: 'Метод не поддерживается' });
    }
    
  } catch (error) {
    console.error('API /telegram: Ошибка:', error);
    return res.status(500).json({ error: `Ошибка Telegram API: ${error.message}` });
  }
};

// Функция для отправки запросов к Telegram API
function makeRequest(token, method, params = {}) {
  return new Promise((resolve, reject) => {
    // Подготовка данных запроса
    const data = JSON.stringify(params);
    
    // Настройки запроса
    const options = {
      hostname: TELEGRAM_API_BASE,
      port: 443,
      path: `/bot${token}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    console.log(`API /telegram: Запрос к ${method}`);
    
    // Создание запроса
    const req = https.request(options, (res) => {
      let responseData = '';
      
      // Сбор данных ответа
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      // Обработка завершения ответа
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          
          if (res.statusCode >= 200 && res.statusCode < 300 && parsedData.ok) {
            resolve(parsedData);
          } else {
            const errorMsg = parsedData.description || `HTTP ошибка: ${res.statusCode}`;
            reject(new Error(errorMsg));
          }
        } catch (e) {
          reject(new Error(`Ошибка парсинга ответа: ${e.message}`));
        }
      });
    });
    
    // Обработка ошибок
    req.on('error', (error) => {
      reject(new Error(`Сетевая ошибка: ${error.message}`));
    });
    
    // Таймаут запроса
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Превышено время ожидания запроса'));
    });
    
    // Отправка данных и завершение запроса
    req.write(data);
    req.end();
  });
} 