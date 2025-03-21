// API для генерации изображений
const https = require('https');

// Runware API точка доступа (используем HTTP вместо WebSocket)
const RUNWARE_API_ENDPOINT = 'https://api.runware.ai/v1';

// Обработчик для генерации изображений
module.exports = async (req, res) => {
  console.log('API /generate: Получен запрос');
  
  // Проверка API ключа
  const apiKey = process.env.RUNWARE_API_KEY;
  if (!apiKey) {
    console.error('API /generate: Отсутствует RUNWARE_API_KEY в переменных окружения');
    return res.status(500).json({ error: 'Отсутствует API ключ Runware' });
  }

  // Проверка метода запроса
  if (req.method !== 'POST') {
    console.error(`API /generate: Неподдерживаемый метод ${req.method}`);
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  // Проверка тела запроса
  const { 
    prompt, 
    model, 
    width = 512, 
    height = 512, 
    steps = 30, 
    cfg_scale = 7.5, 
    number_results = 1 
  } = req.body;
  
  if (!prompt) {
    console.error('API /generate: Отсутствует параметр prompt');
    return res.status(400).json({ error: 'Параметр prompt обязателен' });
  }
  
  if (!model) {
    console.error('API /generate: Отсутствует параметр model');
    return res.status(400).json({ error: 'Параметр model обязателен' });
  }

  console.log('API /generate: Параметры запроса:', {
    model,
    width,
    height,
    steps, 
    cfg_scale,
    number_results,
    prompt: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '')
  });

  // Формируем данные запроса
  const requestData = JSON.stringify({
    prompt,
    model,
    width,
    height,
    steps,
    cfg_scale,
    number_results
  });

  // Настройки запроса
  const options = {
    hostname: 'api.runware.ai',
    port: 443,
    path: '/v1/image/generate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(requestData)
    }
  };

  try {
    console.log('API /generate: Отправка запроса к Runware API');
    
    // Отправляем запрос
    const apiResponse = await makeRequest(options, requestData);
    
    console.log('API /generate: Получен ответ от Runware API');
    
    // Обработка ответа
    if (apiResponse.error) {
      console.error('API /generate: Ошибка от Runware API:', apiResponse.error);
      return res.status(500).json({ error: `Ошибка API: ${apiResponse.error}` });
    }
    
    // Проверка структуры ответа
    if (!apiResponse.images || !Array.isArray(apiResponse.images) || apiResponse.images.length === 0) {
      console.error('API /generate: Некорректный формат ответа', apiResponse);
      return res.status(500).json({ error: 'Неожиданный формат ответа API' });
    }
    
    console.log(`API /generate: Успешно получено ${apiResponse.images.length} изображений`);
    
    // Возвращаем результат
    return res.status(200).json({ images: apiResponse.images });
    
  } catch (error) {
    console.error('API /generate: Ошибка при обработке запроса:', error.message);
    return res.status(500).json({ error: `Ошибка при обработке запроса: ${error.message}` });
  }
};

// Вспомогательная функция для HTTP запроса
function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log(`API /generate: Код ответа HTTP: ${res.statusCode}`);
        
        try {
          const parsedData = JSON.parse(responseData);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsedData);
          } else {
            const errorMessage = parsedData.error || `Ошибка HTTP: ${res.statusCode}`;
            resolve({ error: errorMessage });
          }
        } catch (e) {
          console.error('API /generate: Ошибка парсинга JSON:', e);
          console.log('API /generate: Полученные данные:', responseData.substring(0, 200));
          resolve({ error: 'Не удалось разобрать ответ API' });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('API /generate: Ошибка сетевого запроса:', error);
      reject(new Error(`Ошибка сетевого запроса: ${error.message}`));
    });
    
    // Таймаут запроса (30 секунд)
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Превышен таймаут запроса'));
    });
    
    // Отправляем данные
    req.write(data);
    req.end();
  });
}

// Функция для генерации UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
} 