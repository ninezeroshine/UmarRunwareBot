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
  
  // Проверка URL приложения
  const webappUrl = process.env.WEBAPP_URL;
  if (!webappUrl) {
    console.error('API /telegram: Отсутствует WEBAPP_URL в переменных окружения');
    return res.status(500).json({ error: 'Отсутствует URL веб-приложения' });
  }
  
  // Логируем URL веб-приложения для диагностики
  console.log(`API /telegram: Используем URL WebApp: ${webappUrl}`);
  
  try {
    // GET запрос - получение информации о боте
    if (req.method === 'GET') {
      console.log('API /telegram: Запрос информации о боте');
      
      const botInfo = await makeRequest(token, 'getMe');
      
      // Получаем информацию о текущей кнопке меню
      const menuButton = await makeRequest(token, 'getChatMenuButton');
      
      return res.status(200).json({
        status: 'success',
        bot: botInfo.result,
        menuButton: menuButton.result,
        webappUrl: webappUrl,
        timestamp: new Date().toISOString()
      });
    }
    
    // POST запрос - установка вебхука и команд бота
    else if (req.method === 'POST') {
      console.log('API /telegram: Запрос на настройку бота');
      
      // Получаем текущий хост из параметров, хедеров или переменных окружения
      let host = req.body.host || req.headers.host || new URL(webappUrl).host;
      if (!host) {
        return res.status(400).json({ error: 'Не удалось определить хост для вебхука' });
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
      console.log(`API /telegram: Установка WebApp кнопки с URL ${webappUrl}`);
      
      // Сначала получаем информацию о боте для проверки
      const botInfo = await makeRequest(token, 'getMe');
      
      // Устанавливаем кнопку меню в соответствии с документацией Telegram
      // https://core.telegram.org/bots/api#setchatmenubutton
      const menuButtonResult = await makeRequest(token, 'setChatMenuButton', {
        menu_button: {
          type: 'web_app',
          text: 'Генерировать',
          web_app: {
            url: webappUrl
          }
        }
      });
      
      // Отправляем сообщение в чат с командой для вызова приложения
      // Это поможет обновить настройки бота в Telegram
      try {
        // Если указан ADMIN_CHAT_ID, отправляем туда тестовое сообщение
        const adminChatId = process.env.ADMIN_CHAT_ID;
        if (adminChatId) {
          const messageResult = await makeRequest(token, 'sendMessage', {
            chat_id: adminChatId,
            text: `Настройка WebApp завершена!\nWebApp URL: ${webappUrl}\nБот: @${botInfo.result.username}\nВремя: ${new Date().toISOString()}`,
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
          });
          console.log('API /telegram: Отправлено тестовое сообщение администратору');
        }
      } catch (msgError) {
        console.error('API /telegram: Ошибка при отправке тестового сообщения:', msgError);
      }
      
      return res.status(200).json({
        status: 'success',
        webhook: webhookResult.result,
        commands: commandsResult.result,
        menu_button: menuButtonResult.result,
        webappUrl: webappUrl,
        botUsername: botInfo.result.username,
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
    
    console.log(`API /telegram: Запрос к ${method}`, params);
    
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
          console.log(`API /telegram: Ответ от ${method}:`, responseData);
          
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