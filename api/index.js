const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Основной HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API для генерации изображений
app.post('/generate', async (req, res) => {
  try {
    const { prompt, model } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'Требуется задать промпт для генерации' 
      });
    }
    
    // Параметры запроса к API
    const requestId = uuidv4();
    const payload = {
      prompt: prompt,
      token: process.env.RUNWARE_API_KEY || 'default_api_key',
      model: model || 'flux',
      requester: 'telegram',
      request_id: requestId
    };
    
    console.log('Отправляем запрос:', payload);
    
    // Запрос к API Runware
    const response = await fetch('https://api.runware.ai:2096/api/v0/http', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      console.error('Ошибка API:', response.status, response.statusText);
      return res.status(response.status).json({ 
        success: false, 
        error: `Ошибка API: ${response.statusText}` 
      });
    }
    
    const data = await response.json();
    console.log('Ответ API:', JSON.stringify(data));
    
    if (!data || !data.result) {
      return res.status(500).json({ 
        success: false, 
        error: 'Некорректный ответ API' 
      });
    }
    
    // Возвращаем ссылку на изображение
    if (data.result && data.result.length > 0 && data.result[0].images && data.result[0].images.length > 0) {
      return res.json({
        success: true,
        imageUrl: data.result[0].images[0]
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: 'Не удалось получить URL изображения' 
      });
    }
  } catch (error) {
    console.error('Ошибка при генерации:', error);
    res.status(500).json({ 
      success: false, 
      error: `Ошибка при генерации: ${error.message}` 
    });
  }
});

// Обработчик для Telegram Webhook (минимальная реализация)
app.post('/webhook', (req, res) => {
  console.log('Получен вебхук от Telegram:', JSON.stringify(req.body));
  res.status(200).send('OK');
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
}); 