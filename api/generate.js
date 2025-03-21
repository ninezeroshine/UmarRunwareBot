// API для генерации изображений
const https = require('https');

// Обработчик для генерации изображений
module.exports = async (req, res) => {
  console.log('API /generate: Получен запрос');
  
  // Получаем API ключ из переменных окружения
  const apiKey = process.env.RUNWARE_API_KEY;
  if (!apiKey) {
    console.error('API /generate: Отсутствует RUNWARE_API_KEY в переменных окружения');
    return res.status(500).json({ error: 'Отсутствует API ключ Runware' });
  }

  // Проверяем метод запроса
  if (req.method !== 'POST') {
    console.error(`API /generate: Неподдерживаемый метод ${req.method}`);
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  // Извлекаем параметры из тела запроса
  const { 
    prompt, 
    model, 
    width = 512, 
    height = 512, 
    steps = 30, 
    cfg_scale = 7.5, 
    number_results = 1 
  } = req.body;
  
  // Проверяем обязательные параметры
  if (!prompt) {
    console.error('API /generate: Отсутствует параметр prompt');
    return res.status(400).json({ error: 'Параметр prompt обязателен' });
  }
  
  if (!model) {
    console.error('API /generate: Отсутствует параметр model');
    return res.status(400).json({ error: 'Параметр model обязателен' });
  }

  // Логируем параметры запроса
  console.log('API /generate: Параметры запроса:', {
    prompt: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
    model,
    width,
    height,
    steps,
    cfg_scale,
    number_results
  });

  // Подготавливаем данные для запроса к Runware API
  const taskUUID = generateUUID();
  const requestPayload = [
    {
      taskType: "authentication",
      apiKey
    },
    {
      taskType: "imageInference",
      taskUUID,
      positivePrompt: prompt,
      model,
      width: parseInt(width),
      height: parseInt(height),
      steps: parseInt(steps),
      CFGScale: parseFloat(cfg_scale),
      numberResults: parseInt(number_results)
    }
  ];

  const requestBody = JSON.stringify(requestPayload);
  console.log('API /generate: Отправляемый запрос:', JSON.stringify(requestPayload, null, 2));

  // Настройки для HTTP запроса
  const options = {
    method: 'POST',
    hostname: 'api.runware.ai',
    port: 443,
    path: '/v1',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestBody)
    }
  };

  try {
    // Отправляем запрос к Runware API
    console.log('API /generate: Отправка запроса к Runware API');
    
    // Выполняем запрос и ждем ответа
    const response = await new Promise((resolve, reject) => {
      const req = https.request(options, (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          console.log(`API /generate: Получен ответ с кодом: ${response.statusCode}`);
          try {
            // Пробуем распарсить ответ как JSON
            const responseData = JSON.parse(data);
            resolve({ statusCode: response.statusCode, data: responseData });
          } catch (error) {
            console.error('API /generate: Ошибка парсинга JSON:', error.message);
            console.log('API /generate: Сырой ответ:', data);
            reject(new Error('Ошибка парсинга ответа API'));
          }
        });
      });

      req.on('error', (error) => {
        console.error('API /generate: Ошибка сетевого запроса:', error.message);
        reject(error);
      });

      req.write(requestBody);
      req.end();
    });

    // Проверяем код ответа
    if (response.statusCode >= 400) {
      // Ошибка HTTP
      console.error('API /generate: Ошибка HTTP', response.statusCode, response.data);
      
      // Проверяем наличие сообщения об ошибке в ответе
      let errorMessage = 'Ошибка API Runware';
      if (response.data && response.data.errors && response.data.errors.length > 0) {
        errorMessage = response.data.errors[0].message || errorMessage;
      }
      
      return res.status(500).json({ error: errorMessage });
    }

    // Логируем ответ
    console.log('API /generate: Ответ API:', JSON.stringify(response.data).substring(0, 500) + '...');

    // Проверяем структуру ответа
    if (!response.data || !response.data.data || !Array.isArray(response.data.data)) {
      console.error('API /generate: Неожиданная структура ответа:', response.data);
      return res.status(500).json({ error: 'Неожиданный формат ответа API' });
    }

    // Извлекаем URL изображений из ответа
    const imageResults = response.data.data.filter(
      item => item.taskType === 'imageInference' && item.imageURL
    );

    if (imageResults.length === 0) {
      console.error('API /generate: Нет результатов генерации в ответе');
      return res.status(500).json({ error: 'Изображения не были сгенерированы' });
    }

    // Собираем URLs изображений
    const imageUrls = imageResults.map(item => item.imageURL);
    console.log(`API /generate: Получено ${imageUrls.length} изображений`);

    // Отправляем URLs изображений клиенту
    return res.status(200).json({ images: imageUrls });

  } catch (error) {
    console.error('API /generate: Ошибка обработки запроса:', error);
    return res.status(500).json({ 
      error: 'Ошибка при обработке запроса к Runware API',
      details: error.message
    });
  }
};

// Генерирует уникальный UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
} 