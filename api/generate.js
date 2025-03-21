// Модуль для выполнения HTTP запросов
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

// URL и ключ API Runware
const RUNWARE_API_URL = process.env.RUNWARE_API_URL || 'https://api.runware.ai:2096/api/v0/http';
const RUNWARE_API_KEY = process.env.RUNWARE_API_KEY;

// Функция для создания корректного формата запроса к API
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
  console.log(`Сгенерирован UUID: ${uuid}`);
  
  // Выводим значения всех параметров для отладки
  console.log('Параметры запроса:', {
    model: params.model,
    prompt: params.prompt.substring(0, 50) + (params.prompt.length > 50 ? '...' : ''),
    negative_prompt: params.negative_prompt,
    width: params.width,
    height: params.height,
    steps: params.steps,
    cfg_scale: params.cfg_scale,
    number_results: params.number_results,
    seed: params.seed
  });
  
  // Создаем корректную структуру запроса для Runware API
  return [
    {
      "token": RUNWARE_API_KEY, // Токен API для аутентификации
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

// Функция для нормализации параметров запроса
function normalizeParams(req) {
  // Получаем данные из запроса
  const requestData = req.body || {};
  
  // Возвращаем нормализованные параметры
  return {
    prompt: requestData.prompt || '',
    negative_prompt: requestData.negative_prompt || '',
    model: requestData.model || '',
    width: parseInt(requestData.width) || 512,
    height: parseInt(requestData.height) || 512,
    steps: parseInt(requestData.steps) || 30,
    cfg_scale: parseFloat(requestData.cfg_scale) || 7.5,
    number_results: parseInt(requestData.number_results) || 1,
    seed: parseInt(requestData.seed) || -1
  };
}

// Основной обработчик запросов
module.exports = async (req, res) => {
  console.log('API /generate: Получен запрос');
  
  // Проверяем наличие API ключа
  if (!RUNWARE_API_KEY) {
    console.error('API /generate: RUNWARE_API_KEY не найден в переменных окружения');
    return res.status(500).json({
      status: 'error',
      message: 'Ошибка конфигурации сервера: отсутствует API ключ'
    });
  }
  
  // Проверяем метод запроса
  if (req.method !== 'POST') {
    console.error(`API /generate: Неподдерживаемый метод ${req.method}`);
    return res.status(405).json({
      status: 'error',
      message: 'Метод не поддерживается. Используйте POST.'
    });
  }
  
  try {
    // Подготавливаем параметры запроса
    const params = normalizeParams(req);
    console.log('API /generate: Нормализованные параметры:', JSON.stringify(params, null, 2));
    
    // Проверяем обязательные параметры
    if (!params.prompt.trim()) {
      console.error('API /generate: Отсутствует параметр prompt');
      return res.status(400).json({
        status: 'error',
        message: 'Не указан текстовый запрос'
      });
    }
    
    if (!params.model.trim()) {
      console.error('API /generate: Отсутствует параметр model');
      return res.status(400).json({
        status: 'error',
        message: 'Не указана модель'
      });
    }
    
    // Проверка формата модели
    if (!params.model.match(/^[a-zA-Z0-9]+:[0-9]+@[0-9]+$/)) {
      console.error(`API /generate: Некорректный формат модели: ${params.model}`);
      return res.status(400).json({
        status: 'error',
        message: 'Некорректный формат идентификатора модели'
      });
    }
    
    // Создаем запрос API
    const payload = createRunwarePayload(params);
    console.log('API /generate: Структура запроса к API:', JSON.stringify(payload, null, 2));
    
    // Отправляем запрос к API
    console.log(`API /generate: Отправка запроса к API по адресу: ${RUNWARE_API_URL}`);
    const runwareResponse = await fetch(RUNWARE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    // Логируем информацию о статусе ответа
    console.log(`API /generate: Получен ответ от API со статусом: ${runwareResponse.status} ${runwareResponse.statusText}`);
    
    // Получаем полный ответ в виде текста
    const responseText = await runwareResponse.text();
    console.log(`API /generate: Получен ответ длиной: ${responseText.length} байт`);
    
    // Логируем начало и конец ответа для отладки
    if (responseText.length > 0) {
      console.log('API /generate: Начало ответа:', responseText.substring(0, 200));
      if (responseText.length > 200) {
        console.log('API /generate: Конец ответа:', responseText.substring(responseText.length - 200));
      }
    }
    
    // Если ответ не успешный, обрабатываем ошибку
    if (!runwareResponse.ok) {
      console.error('API /generate: Ошибка от API:', responseText);
      
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
      console.log('API /generate: Ответ успешно разобран как JSON');
    } catch (e) {
      console.error('API /generate: Не удалось разобрать ответ как JSON:', e);
      return res.status(500).json({
        status: 'error',
        message: 'Некорректный формат ответа от API',
        details: e.message
      });
    }
    
    // Проверяем структуру ответа
    if (!responseData || !Array.isArray(responseData)) {
      console.error('API /generate: Неожиданный формат ответа:', responseData);
      return res.status(500).json({
        status: 'error',
        message: 'Неожиданный формат ответа от API',
        details: responseData
      });
    }
    
    // Ищем объект с изображениями в ответе
    console.log('API /generate: Поиск результатов в ответе');
    const imageResponse = responseData.find(item => 
      item.type === 'inference' && item.inference_result && Array.isArray(item.inference_result.images)
    );
    
    // Если изображения не найдены
    if (!imageResponse) {
      console.error('API /generate: В ответе не найдены изображения:', JSON.stringify(responseData));
      
      // Ищем сообщения об ошибках
      const errorItem = responseData.find(item => item.error);
      if (errorItem) {
        console.error('API /generate: Найдено сообщение об ошибке в ответе:', errorItem.error);
        return res.status(500).json({
          status: 'error',
          message: errorItem.error || 'Ошибка генерации изображения',
          details: errorItem
        });
      }
      
      return res.status(500).json({
        status: 'error',
        message: 'В ответе не найдены сгенерированные изображения',
        details: responseData
      });
    }
    
    // Извлекаем URL изображений
    const images = imageResponse.inference_result.images.map(img => img.url);
    console.log(`API /generate: Извлечено ${images.length} URL изображений`);
    images.forEach((url, index) => {
      console.log(`API /generate: Изображение ${index + 1}: ${url}`);
    });
    
    // Возвращаем успешный ответ с URL изображений
    return res.status(200).json({
      status: 'success',
      images: images
    });
    
  } catch (error) {
    console.error('API /generate: Ошибка при обработке запроса:', error);
    
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Внутренняя ошибка сервера',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}; 