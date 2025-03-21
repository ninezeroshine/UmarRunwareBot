// Инициализация Telegram WebApp
const telegram = window.Telegram?.WebApp;

// Проверяем правильность инициализации
if (!telegram) {
  console.error('Telegram WebApp не инициализирован!');
  document.getElementById('initLoader').innerHTML = `
    <p style="color:red; text-align:center;">
      Приложение должно быть открыто через Telegram.
    </p>
  `;
} else {
  // Расширяем WebApp на всю высоту
  telegram.expand();
  
  // Устанавливаем цвета согласно теме Telegram
  if (telegram.themeParams) {
    document.documentElement.style.setProperty('--tg-theme-bg-color', telegram.themeParams.bg_color || '#ffffff');
    document.documentElement.style.setProperty('--tg-theme-text-color', telegram.themeParams.text_color || '#000000');
    document.documentElement.style.setProperty('--tg-theme-hint-color', telegram.themeParams.hint_color || '#999999');
    document.documentElement.style.setProperty('--tg-theme-button-color', telegram.themeParams.button_color || '#2481cc');
    document.documentElement.style.setProperty('--tg-theme-button-text-color', telegram.themeParams.button_text_color || '#ffffff');
  }
  
  // Сообщаем Telegram, что приложение готово
  telegram.ready();
}

// DOM элементы
const promptInput = document.getElementById('prompt');
const generateBtn = document.getElementById('generateBtn');
const resultsArea = document.getElementById('results');
const loader = document.getElementById('loader');
const initLoader = document.getElementById('initLoader');

// Функции отображения UI
function showLoader(message = 'Генерация изображения...') {
  loader.querySelector('.loading-text').textContent = message;
  loader.style.display = 'flex';
}

function hideLoader() {
  loader.style.display = 'none';
}

function showError(message) {
  console.error('Ошибка:', message);
  
  try {
    telegram.showAlert(message);
  } catch (e) {
    alert(message);
  }
}

// Генерация изображений
async function generateImage() {
  try {
    // Очищаем область результатов перед новой генерацией
    resultsArea.innerHTML = '';
    
    // Показываем индикатор загрузки
    showLoader();
    
    // Проверяем промпт
    const prompt = promptInput.value.trim();
    if (!prompt) {
      throw new Error('Введите текстовый запрос для генерации');
    }
    
    // Формируем тело запроса (используем фиксированную модель Flux)
    const requestBody = {
      prompt: prompt,
      model: 'FLUX:11@0', // Фиксированная модель Flux
      width: 1024,
      height: 576,
      steps: 30,
      cfg_scale: 7.5,
      number_results: 1
    };
    
    console.log('Отправка запроса на генерацию:', requestBody);
    
    // Отправляем запрос на сервер
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('Статус ответа:', response.status);
    
    // Обрабатываем ответ
    const responseData = await response.json();
    
    // Если ответ не успешен, обрабатываем ошибку
    if (response.status !== 200 || responseData.status === 'error') {
      throw new Error(responseData.message || 'Ошибка генерации изображения');
    }
    
    // Проверяем наличие изображений в ответе
    if (!responseData.images || responseData.images.length === 0) {
      throw new Error('Изображения не были получены');
    }
    
    // Отображаем полученные изображения
    responseData.images.forEach(imageUrl => {
      const imgElement = document.createElement('img');
      imgElement.src = imageUrl;
      imgElement.alt = 'Сгенерированное изображение';
      imgElement.className = 'result-image';
      resultsArea.appendChild(imgElement);
    });
    
  } catch (error) {
    showError(error.message);
  } finally {
    hideLoader();
  }
}

// Инициализация приложения
async function initApp() {
  try {
    // Скрываем loader инициализации
    initLoader.style.display = 'none';
  } catch (error) {
    console.error('Ошибка инициализации:', error);
    initLoader.innerHTML = `
      <p style="color:red; text-align:center;">
        Ошибка инициализации: ${error.message}
      </p>
    `;
  }
}

// Слушатели событий
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  
  // Обработчик кнопки генерации
  generateBtn.addEventListener('click', generateImage);
  
  // Обработчик нажатия Enter в поле ввода
  promptInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      generateImage();
    }
  });
}); 