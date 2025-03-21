// Модуль для выполнения HTTP запросов
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

// URL и ключ API Runware
const RUNWARE_API_URL = process.env.RUNWARE_API_URL || 'https://api.runware.ai:2096/api/v0/http';
const RUNWARE_API_KEY = process.env.RUNWARE_API_KEY;

// Основной обработчик запросов
module.exports = async (req, res) => {
  // Проверяем метод запроса
  if (req.method !== 'POST') {
    return res.status(405).json({
      status: 'error',
      message: 'Метод не поддерживается. Используйте POST.'
    });
  }
  
  // Проверяем наличие API ключа
  if (!RUNWARE_API_KEY) {
    return res.status(500).json({
      status: 'error',
      message: 'Ошибка конфигурации сервера: отсутствует API ключ'
    });
  }
  
  try {
    // Получаем параметры запроса
    const { prompt } = req.body;
    
    // Проверяем обязательные параметры
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Не указан текстовый запрос'
      });
    }
    
    // Генерируем UUID для запроса
    const uuid = uuidv4();
    
    // Создаем структуру запроса для API Runware
    const payload = [
      {
        "token": RUNWARE_API_KEY,
        "type": "auth",
        "uuid": uuid
      },
      {
        "type": "inference",
        "uuid": uuid,
        "inference_type": "txt2img",
        "inference_params": {
          "positivePrompt": prompt,
          "negativePrompt": "",
          "model": "FLUX:11@0", // Фиксированная модель Flux
          "width": 1024,
          "height": 576,
          "steps": 30,
          "CFGScale": 7.5,
          "numberResults": 1,
          "seed": -1
        }
      }
    ];
    
    // Отправляем запрос к API
    const response = await fetch(RUNWARE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    // Если ответ не успешный, обрабатываем ошибку
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        status: 'error',
        message: 'Ошибка генерации изображения',
        details: errorText
      });
    }
    
    // Получаем и парсим ответ
    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      return res.status(500).json({
        status: 'error',
        message: 'Некорректный формат ответа от API'
      });
    }
    
    // Проверяем структуру ответа и ищем изображения
    if (!Array.isArray(responseData)) {
      return res.status(500).json({
        status: 'error',
        message: 'Неожиданный формат ответа от API'
      });
    }
    
    // Ищем объект с изображениями в ответе
    const imageResponse = responseData.find(item => 
      item.type === 'inference' && 
      item.inference_result && 
      Array.isArray(item.inference_result.images)
    );
    
    // Если изображения не найдены
    if (!imageResponse) {
      // Ищем сообщения об ошибках
      const errorItem = responseData.find(item => item.error);
      if (errorItem) {
        return res.status(500).json({
          status: 'error',
          message: errorItem.error || 'Ошибка генерации изображения'
        });
      }
      
      return res.status(500).json({
        status: 'error',
        message: 'В ответе не найдены сгенерированные изображения'
      });
    }
    
    // Извлекаем URL изображений
    const images = imageResponse.inference_result.images.map(img => img.url);
    
    // Возвращаем успешный ответ с URL изображений
    return res.status(200).json({
      status: 'success',
      images: images
    });
    
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Внутренняя ошибка сервера'
    });
  }
}; 