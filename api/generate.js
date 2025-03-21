// API для генерации изображений
const { default: fetch } = require('node-fetch');
require('dotenv').config();

// Runware API точка доступа (используем HTTP вместо WebSocket)
const RUNWARE_API_ENDPOINT = 'https://api.runware.ai/v1';
const RUNWARE_API_KEY = process.env.RUNWARE_API_KEY;

// Обработчик для генерации изображений
module.exports = async (req, res) => {
  try {
    const { prompt, model, width, height, steps, cfg_scale, number_results } = req.body;
    
    // Проверка обязательных параметров
    if (!prompt) {
      return res.status(400).json({ error: 'Отсутствует промпт' });
    }
    
    if (!model) {
      return res.status(400).json({ error: 'Не выбрана модель' });
    }
    
    console.log(`Запрос на генерацию. Модель: ${model}, Промпт: ${prompt}`);
    
    // Формируем данные для отправки в Runware API (HTTP)
    const payload = [
      {
        taskType: 'authentication',
        apiKey: RUNWARE_API_KEY
      },
      {
        taskType: 'imageInference',
        taskUUID: generateUUID(),
        positivePrompt: prompt,
        model: model,
        width: width || 512,
        height: height || 512,
        steps: steps || 30,
        CFGScale: cfg_scale || 7.5,
        numberResults: number_results || 1
      }
    ];
    
    // Отправляем запрос к Runware API через HTTP
    const response = await fetch(RUNWARE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNWARE_API_KEY}`
      },
      body: JSON.stringify(payload)
    });
    
    // Обрабатываем ответ
    const data = await response.json();
    
    if (!response.ok || data.errors) {
      const error = data.errors ? data.errors[0].message : 'Ошибка при генерации изображения';
      throw new Error(error);
    }
    
    // Извлекаем URLs изображений из ответа
    const imageResults = data.data.filter(item => item.taskType === 'imageInference');
    
    if (!imageResults || imageResults.length === 0) {
      return res.status(500).json({ error: 'Нет результатов генерации' });
    }
    
    // Собираем все URL изображений
    const imageUrls = [];
    
    for (const result of imageResults) {
      if (result.imageURL) {
        imageUrls.push(result.imageURL);
      }
    }
    
    res.json({ images: imageUrls });
    
  } catch (error) {
    console.error('Ошибка генерации:', error);
    res.status(500).json({ error: error.message || 'Ошибка генерации изображения' });
  }
};

// Функция для генерации UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
} 