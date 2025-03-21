// Модуль для обработки вебхуков от Telegram Bot API
const https = require('https');

// Базовый URL API Telegram
const TELEGRAM_API_BASE = 'api.telegram.org';

// Обработчик вебхуков от Telegram
module.exports = async (req, res) => {
  console.log('Webhook: Получен запрос от Telegram');
  
  // Проверка токена бота
  const token = process.env.TELEGRAM_API_TOKEN;
  if (!token) {
    console.error('Webhook: Отсутствует TELEGRAM_API_TOKEN в переменных окружения');
    return res.status(500).send('Webhook error: Token not configured');
  }
  
  // Проверка URL приложения
  const webappUrl = process.env.WEBAPP_URL;
  if (!webappUrl) {
    console.error('Webhook: Отсутствует WEBAPP_URL в переменных окружения');
    return res.status(500).send('Webhook error: WebApp URL not configured');
  }
  
  // Проверяем метод запроса
  if (req.method !== 'POST') {
    console.error(`Webhook: Неподдерживаемый метод ${req.method}`);
    return res.status(405).send('Method Not Allowed');
  }
  
  try {
    // Проверяем наличие обновления
    if (!req.body || !req.body.update_id) {
      console.error('Webhook: Некорректный формат данных', req.body);
      return res.status(400).send('Bad Request: Invalid update format');
    }
    
    console.log('Webhook: Получено обновление:', JSON.stringify(req.body, null, 2));
    
    // Обработка сообщения
    if (req.body.message) {
      const message = req.body.message;
      const chatId = message.chat.id;
      const text = message.text || '';
      
      console.log(`Webhook: Получено сообщение от ${chatId}: ${text}`);
      
      // Обработка команды /start
      if (text.startsWith('/start')) {
        await sendReply(token, chatId, 
          'Привет! Я бот для генерации изображений. Нажмите кнопку "Генерировать" в меню или используйте кнопку ниже:',
          {
            reply_markup: {
              keyboard: [
                [
                  {
                    text: "Открыть генератор",
                    web_app: {
                      url: webappUrl
                    }
                  }
                ]
              ],
              resize_keyboard: true
            }
          }
        );
        
        // Также отправляем информацию о командах
        await sendReply(token, chatId, 
          'Доступные команды:\n' +
          '/start - Перезапуск бота\n' +
          '/generate - Открыть генератор изображений',
          { disable_notification: true }
        );
      }
      
      // Обработка команды /generate
      else if (text.startsWith('/generate')) {
        await sendReply(token, chatId, 
          'Нажмите кнопку ниже, чтобы открыть генератор изображений:',
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "Открыть генератор изображений",
                    web_app: {
                      url: webappUrl
                    }
                  }
                ]
              ]
            }
          }
        );
      }
      
      // Обычное сообщение
      else {
        await sendReply(token, chatId, 
          'Для генерации изображений нажмите кнопку "Генерировать" в меню бота или введите команду /generate',
          { disable_notification: true }
        );
      }
    }
    
    // Обработка нажатия на кнопку
    else if (req.body.callback_query) {
      const callbackQuery = req.body.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;
      
      console.log(`Webhook: Получен callback_query от ${chatId}: ${data}`);
      
      // Отвечаем на запрос кнопки
      await makeRequest(token, 'answerCallbackQuery', {
        callback_query_id: callbackQuery.id
      });
    }
    
    // Отвечаем боту Telegram, что все в порядке
    return res.status(200).send('OK');
    
  } catch (error) {
    console.error('Webhook: Ошибка обработки:', error);
    return res.status(500).send(`Webhook Error: ${error.message}`);
  }
};

// Функция для отправки ответа на сообщение
async function sendReply(token, chatId, text, options = {}) {
  try {
    console.log(`Webhook: Отправка сообщения в чат ${chatId}`);
    
    // Формируем данные для отправки
    const params = {
      chat_id: chatId,
      text,
      ...options
    };
    
    // Отправляем сообщение
    const result = await makeRequest(token, 'sendMessage', params);
    console.log(`Webhook: Сообщение отправлено, message_id: ${result.result.message_id}`);
    
    return result;
  } catch (error) {
    console.error(`Webhook: Ошибка отправки сообщения в чат ${chatId}:`, error);
    throw error;
  }
}

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