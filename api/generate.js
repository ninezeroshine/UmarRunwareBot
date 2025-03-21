// Модуль для выполнения HTTP запросов
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

// URL и ключ API Runware
const RUNWARE_API_URL = process.env.RUNWARE_API_URL || 'wss://api.runware.ai:2096/api/v0/ws';
const RUNWARE_API_KEY = process.env.RUNWARE_API_KEY;

// Функция для получения корректного формата запроса
function createRunwarePayload(params) {
  // Проверяем наличие обязательных параметров
  if (!params.prompt) {
    throw new Error('Не указан текстовый запрос (prompt)');
  }
  
  if (!params.model) {
    throw new Error('Не указана модель (model)');
  }
  
  // UUID для идентификации запроса
  const uuid = uuidv4();
  
  // Создаем корректную структуру запроса
  return [
    {
      "token": "token",  // Этот токен будет заменен при обработке запроса
      "type": "auth",
      "uuid": uuid
    },
    {
      "type": "inference",
      "uuid": uuid,
      "inference_type": "txt2img",
      "inference_params": {
        "positivePrompt": params.prompt,
        "negativePrompt": params.negative_prompt || "",
        "model": params.model,
        "width": params.width || 512,
        "height": params.height || 512,
        "steps": params.steps || 30,
        "CFGScale": params.cfg_scale || 7.5,
        "numberResults": params.number_results || 1,
        "seed": params.seed || -1
      }
    }
  ];
}

// Функция для нормализации параметров в запросе
function normalizeParams(req) {
  // Получаем данные из запроса
  const requestData = req.body || {};
  
  // Проверяем и нормализуем параметры
  return {
    prompt: requestData.prompt,
    negative_prompt: requestData.negative_prompt,
    model: requestData.model,
    width: parseInt(requestData.width) || 512,
    height: parseInt(requestData.height) || 512,
    steps: parseInt(requestData.steps) || 30,
    cfg_scale: parseFloat(requestData.cfg_scale) || 7.5,
    number_results: parseInt(requestData.number_results) || 1,
    seed: parseInt(requestData.seed) || -1
  };
}

// Обработчик запросов на генерацию изображений
module.exports = async (req, res) => {
  // Проверяем, что у нас есть API ключ
  if (!RUNWARE_API_KEY) {
    console.error('RUNWARE_API_KEY не найден в переменных окружения');
    return res.status(500).json({
      status: 'error',
      message: 'Ошибка конфигурации сервера: отсутствует API ключ'
    });
  }
  
  // Проверяем метод запроса
  if (req.method !== 'POST') {
    return res.status(405).json({
      status: 'error',
      message: 'Метод не поддерживается. Используйте POST.'
    });
  }
  
  try {
    // Подготавливаем параметры запроса
    const params = normalizeParams(req);
    console.log('Параметры запроса:', JSON.stringify(params, null, 2));
    
    // Создаем структуру запроса для Runware API
    const payload = createRunwarePayload(params);
    
    // Заменяем токен на API ключ в первом сообщении
    payload[0].token = RUNWARE_API_KEY;
    
    console.log('Отправка запроса к Runware API');
    console.log('Модель:', params.model);
    
    // Готовим запрос к HTTP API
    const httpUrl = RUNWARE_API_URL.replace('wss://', 'https://').replace('/ws', '/http');
    const runwareResponse = await fetch(httpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    // Логгируем информацию о статусе ответа
    console.log('Runware API ответил:', runwareResponse.status, runwareResponse.statusText);
    
    // Получаем ответ в виде текста
    const responseText = await runwareResponse.text();
    console.log('Получен ответ длиной:', responseText.length);
    
    // Если статус ответа не успешный, обрабатываем ошибку
    if (!runwareResponse.ok) {
      console.error('Ошибка от Runware API:', responseText);
      
      try {
        // Пытаемся разобрать JSON ответ
        const errorData = JSON.parse(responseText);
        return res.status(runwareResponse.status).json({
          status: 'error',
          message: errorData.error || 'Ошибка генерации изображения',
          details: errorData
        });
      } catch (e) {
        // Если не удалось разобрать JSON, возвращаем текст ошибки
        return res.status(runwareResponse.status).json({
          status: 'error',
          message: 'Ошибка генерации изображения',
          details: responseText
        });
      }
    }
    
    // Пытаемся разобрать ответ как JSON
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.error('Не удалось разобрать ответ как JSON:', e);
      return res.status(500).json({
        status: 'error',
        message: 'Некорректный формат ответа от API',
        details: e.message
      });
    }
    
    // Проверяем структуру ответа
    if (!responseData || !Array.isArray(responseData)) {
      console.error('Неожиданный формат ответа:', responseData);
      return res.status(500).json({
        status: 'error',
        message: 'Неожиданный формат ответа от API',
        details: responseData
      });
    }
    
    // Ищем объект с изображениями в ответе
    const imageResponse = responseData.find(item => 
      item.type === 'inference' && item.inference_result && Array.isArray(item.inference_result.images)
    );
    
    if (!imageResponse) {
      console.error('В ответе не найдены сгенерированные изображения:', responseData);
      return res.status(500).json({
        status: 'error',
        message: 'В ответе не найдены сгенерированные изображения',
        details: responseData
      });
    }
    
    // Извлекаем URL изображений
    const images = imageResponse.inference_result.images.map(img => img.url);
    
    console.log(`Успешно получено ${images.length} изображений`);
    
    // Возвращаем успешный ответ с URL изображений
    return res.status(200).json({
      status: 'success',
      images: images
    });
    
  } catch (error) {
    console.error('Ошибка при обработке запроса:', error);
    
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Внутренняя ошибка сервера',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}; 