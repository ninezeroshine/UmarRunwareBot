// API для генерации изображений
const https = require('https');

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

  // Правильный формат данных для Runware API
  const requestData = JSON.stringify([
    {
      taskType: 'authentication',
      apiKey: apiKey
    },
    {
      taskType: 'imageInference',
      taskUUID: generateUUID(),
      positivePrompt: prompt,
      model: model,
      width: width,
      height: height,
      steps: steps,
      CFGScale: cfg_scale,
      numberResults: number_results
    }
  ]);

  console.log('API /generate: Подготовлен запрос в формате Runware API');

  // Настройки запроса
  const options = {
    hostname: 'api.runware.ai',
    port: 443,
    path: '/v1',
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
    
    // Полное логирование ответа для диагностики
    console.log('API /generate: Полный ответ от API:', JSON.stringify(apiResponse).substring(0, 500) + '...');
    
    // Обработка ошибок API
    if (apiResponse.errors && apiResponse.errors.length > 0) {
      const errorMessage = apiResponse.errors[0].message || 'Ошибка API Runware';
      console.error('API /generate: Ошибка от Runware API:', errorMessage);
      return res.status(500).json({ error: errorMessage });
    }
    
    // Проверка структуры ответа (по формату Runware API)
    if (!apiResponse.data || !Array.isArray(apiResponse.data)) {
      console.error('API /generate: Некорректный формат ответа', apiResponse);
      return res.status(500).json({ error: 'Неожиданный формат ответа API' });
    }
    
    // Извлекаем URL изображений из ответа в формате Runware API
    const imageResults = apiResponse.data.filter(item => 
      item.taskType === 'imageInference' && item.imageURL
    );
    
    if (imageResults.length === 0) {
      console.error('API /generate: Нет результатов генерации в ответе');
      return res.status(500).json({ error: 'Нет результатов генерации изображений' });
    }
    
    // Собираем все URL изображений
    const imageUrls = imageResults.map(item => item.imageURL);
    
    console.log(`API /generate: Успешно получено ${imageUrls.length} изображений`);
    imageUrls.forEach((url, i) => console.log(`Изображение ${i+1}:`, url.substring(0, 100) + '...'));
    
    // Возвращаем результат
    return res.status(200).json({ images: imageUrls });
    
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
            const errorMessage = parsedData.error || 
                              (parsedData.errors && parsedData.errors.length > 0 ? 
                               parsedData.errors[0].message : 
                               `Ошибка HTTP: ${res.statusCode}`);
            resolve({ errors: [{ message: errorMessage }] });
          }
        } catch (e) {
          console.error('API /generate: Ошибка парсинга JSON:', e);
          console.log('API /generate: Полученные данные:', responseData.substring(0, 200));
          resolve({ errors: [{ message: 'Не удалось разобрать ответ API' }] });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('API /generate: Ошибка сетевого запроса:', error);
      reject(new Error(`Ошибка сетевого запроса: ${error.message}`));
    });
    
    // Таймаут запроса (60 секунд для генерации изображений)
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Превышен таймаут запроса (60 сек)'));
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