// Инициализация Telegram WebApp
const telegram = window.Telegram?.WebApp;

// Проверяем правильность инициализации
if (!telegram) {
  console.error('Telegram WebApp не инициализирован! Возможно приложение открыто не через Telegram');
  document.getElementById('initLoader').innerHTML = `
    <p style="color:red; text-align:center;">
      Приложение должно быть открыто через Telegram.<br>
      Если вы видите это сообщение внутри Telegram, сообщите разработчику.
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
    document.documentElement.style.setProperty('--tg-theme-link-color', telegram.themeParams.link_color || '#2481cc');
    document.documentElement.style.setProperty('--tg-theme-button-color', telegram.themeParams.button_color || '#2481cc');
    document.documentElement.style.setProperty('--tg-theme-button-text-color', telegram.themeParams.button_text_color || '#ffffff');
  }
  
  // Настройка темы
  document.body.classList.add(telegram.colorScheme === 'dark' ? 'theme-dark' : 'theme-light');
  
  // Логирование информации о WebApp
  console.log('Telegram WebApp инициализирован', {
    initDataUnsafe: telegram.initDataUnsafe ? 'присутствует' : 'отсутствует',
    version: telegram.version,
    platform: telegram.platform,
    colorScheme: telegram.colorScheme,
    viewportHeight: telegram.viewportHeight,
    viewportStableHeight: telegram.viewportStableHeight,
    headerColor: telegram.headerColor,
    backgroundColor: telegram.backgroundColor
  });
}

// Переменные состояния
let settings = {
  model: '',
  width: 512,
  height: 512,
  size_name: '512x512',
  steps: 30,
  cfg_scale: 7.5,
  number_results: 1,
  prompt: ''
};

// DOM элементы
const promptInput = document.getElementById('prompt');
const modelSelect = document.getElementById('model');
const sizeSelect = document.getElementById('size');
const stepsSlider = document.getElementById('steps');
const stepsValue = document.getElementById('stepsValue');
const cfgScaleSlider = document.getElementById('cfgScale');
const cfgScaleValue = document.getElementById('cfgScaleValue');
const numResultsSlider = document.getElementById('numResults');
const numResultsValue = document.getElementById('numResultsValue');
const generateBtn = document.getElementById('generateBtn');
const resultsArea = document.getElementById('results');
const loader = document.getElementById('loader');
const initLoader = document.getElementById('initLoader');
const settingsPanel = document.getElementById('settingsPanel');
const settingsHeader = settingsPanel.querySelector('.settings-header');
const settingsContent = settingsPanel.querySelector('.settings-content');
const toggleArrow = settingsPanel.querySelector('.toggle-arrow');

// Функции отображения UI
function showLoader(message = 'Генерация изображения...') {
  const loaderText = document.querySelector('.loading-text');
  if (loaderText) {
    loaderText.textContent = message;
  }
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
    console.error('Не удалось показать уведомление через Telegram WebApp:', e);
    alert(message);
  }
}

// Проверка работоспособности API
async function checkApiHealth() {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) {
      throw new Error('API недоступен');
    }
    
    const data = await response.json();
    console.log('Статус API:', data);
    
    return data;
  } catch (error) {
    console.error('Ошибка проверки API:', error);
    return { status: 'error' };
  }
}

// Загрузка моделей
async function loadModels() {
  try {
    console.log('Запрос списка моделей');
    const response = await fetch('/api/models');
    if (!response.ok) {
      throw new Error('Не удалось загрузить модели');
    }
    
    const data = await response.json();
    console.log('Получены модели:', data);
    
    modelSelect.innerHTML = '';
    
    if (data.models && typeof data.models === 'object') {
      Object.entries(data.models).forEach(([name, id]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        modelSelect.appendChild(option);
      });
      
      // Выбираем первую модель по умолчанию, если список не пустой
      if (modelSelect.options.length > 0) {
        modelSelect.selectedIndex = 0;
        settings.model = modelSelect.value;
      }
    }
  } catch (error) {
    showError('Не удалось загрузить модели: ' + error.message);
  }
}

// Загрузка размеров
async function loadSizes() {
  try {
    console.log('Запрос списка размеров');
    const response = await fetch('/api/sizes');
    if (!response.ok) {
      throw new Error('Не удалось загрузить размеры');
    }
    
    const data = await response.json();
    console.log('Получены размеры:', data);
    
    sizeSelect.innerHTML = '';
    
    if (data.sizes && typeof data.sizes === 'object') {
      Object.entries(data.sizes).forEach(([name, [width, height]]) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        option.dataset.width = width;
        option.dataset.height = height;
        sizeSelect.appendChild(option);
      });
      
      // Выбираем первый размер по умолчанию, если список не пустой
      if (sizeSelect.options.length > 0) {
        sizeSelect.selectedIndex = 0;
        const selectedOption = sizeSelect.options[0];
        settings.size_name = selectedOption.value;
        settings.width = parseInt(selectedOption.dataset.width);
        settings.height = parseInt(selectedOption.dataset.height);
      }
    }
  } catch (error) {
    showError('Не удалось загрузить размеры: ' + error.message);
  }
}

// Генерация изображений
async function generateImage() {
  try {
    // Очищаем область результатов перед новой генерацией
    resultsArea.innerHTML = '';
    
    // Показываем индикатор загрузки
    showLoader('Генерация изображения...');
    
    // Проверяем модель
    if (!settings.model) {
      throw new Error('Не выбрана модель для генерации');
    }
    
    // Проверяем промпт
    if (!settings.prompt || settings.prompt.trim().length === 0) {
      throw new Error('Введите текстовый запрос для генерации');
    }
    
    // Формируем тело запроса
    const requestBody = {
      prompt: settings.prompt,
      model: settings.model,
      width: settings.width,
      height: settings.height,
      steps: settings.steps,
      cfg_scale: settings.cfg_scale,
      number_results: settings.number_results
    };
    
    console.log('Отправка запроса на генерацию:', JSON.stringify(requestBody, null, 2));
    console.log('Выбранная модель:', settings.model);
    
    // Отправляем запрос на сервер
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('Статус ответа:', response.status, response.statusText);
    
    // Получаем текст ответа
    const responseText = await response.text();
    console.log('Сырой ответ:', responseText.substring(0, 1000) + (responseText.length > 1000 ? '...' : ''));
    
    // Если ответ не успешен, обрабатываем ошибку
    if (!response.ok) {
      let errorMessage = 'Ошибка генерации изображения';
      
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error || errorData.message || errorMessage;
        
        if (errorData.details) {
          console.error('Детали ошибки:', errorData.details);
        }
      } catch (e) {
        console.error('Не удалось разобрать ответ как JSON:', e);
      }
      
      throw new Error(errorMessage);
    }
    
    // Парсим JSON ответа
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Ошибка при парсинге JSON ответа:', e);
      throw new Error('Получен некорректный формат данных от сервера');
    }
    
    console.log('Получен ответ с изображениями:', data);
    
    // Проверяем наличие изображений
    if (!data.images || !Array.isArray(data.images) || data.images.length === 0) {
      console.error('Сервер не вернул изображения:', data);
      throw new Error('Изображения не были сгенерированы');
    }
    
    // Отображаем результаты
    displayResults(data.images);
    
    // Показываем уведомление об успехе
    console.log('Успешно сгенерировано изображений:', data.images.length);
    
  } catch (error) {
    console.error('Ошибка генерации:', error);
    showError('Ошибка генерации: ' + error.message);
  } finally {
    hideLoader();
  }
}

// Отображение результатов генерации
function displayResults(images) {
  resultsArea.innerHTML = '';
  
  if (!images || images.length === 0) {
    resultsArea.innerHTML = '<div class="error-message">Нет результатов</div>';
    console.warn('Нет изображений для отображения');
    return;
  }
  
  console.log(`Отображение ${images.length} изображений`);
  
  // Отображаем каждое изображение
  images.forEach((imageUrl, index) => {
    console.log(`Отображение изображения ${index + 1}: ${imageUrl.substring(0, 50)}...`);
    
    const resultItem = document.createElement('div');
    resultItem.className = 'result-item';
    
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = 'Сгенерированное изображение';
    image.loading = 'lazy';
    
    // Обработка ошибки загрузки изображения
    image.onerror = (e) => {
      console.error('Ошибка загрузки изображения:', e);
      image.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg width%3D%22232%22 height%3D%22232%22 xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 viewBox%3D%220 0 232 232%22 preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle type%3D%22text%2Fcss%22%3E%23holder_16e83f428cc text %7B fill%3A%23868e96%3Bfont-weight%3Abold%3Bfont-family%3AArial%2C Helvetica%2C Open Sans%2C sans-serif%2C monospace%3Bfont-size%3A12pt %7D %3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg id%3D%22holder_16e83f428cc%22%3E%3Crect width%3D%22232%22 height%3D%22232%22 fill%3D%22%23777%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext x%3D%2285.859375%22 y%3D%22121.2%22%3EError%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E';
    };
    
    // Открыть изображение при клике
    image.onclick = () => {
      try {
        telegram.openLink(imageUrl);
      } catch (e) {
        console.error('Ошибка открытия ссылки через Telegram:', e);
        window.open(imageUrl, '_blank');
      }
    };
    
    resultItem.appendChild(image);
    resultsArea.appendChild(resultItem);
  });
}

// Обновление настроек
function updateSetting(key, value) {
  settings[key] = value;
  console.log(`Обновлена настройка ${key}:`, value);
}

// Обработчики событий
stepsSlider.addEventListener('input', () => {
  const value = stepsSlider.value;
  stepsValue.textContent = value;
  updateSetting('steps', parseInt(value));
});

cfgScaleSlider.addEventListener('input', () => {
  const value = cfgScaleSlider.value;
  cfgScaleValue.textContent = value;
  updateSetting('cfg_scale', parseFloat(value));
});

numResultsSlider.addEventListener('input', () => {
  const value = numResultsSlider.value;
  numResultsValue.textContent = value;
  updateSetting('number_results', parseInt(value));
});

modelSelect.addEventListener('change', () => {
  const selectedModel = modelSelect.value;
  console.log(`Выбрана модель: ${selectedModel}`);
  
  // Проверка формата модели
  if (!selectedModel.match(/^[a-zA-Z0-9]+:[0-9]+@[0-9]+$/)) {
    console.error(`Неверный формат AIR идентификатора модели: ${selectedModel}`);
    showError('Выбрана модель с неправильным форматом идентификатора. Пожалуйста, свяжитесь с разработчиком.');
    return;
  }
  
  updateSetting('model', selectedModel);
});

sizeSelect.addEventListener('change', () => {
  const selectedOption = sizeSelect.options[sizeSelect.selectedIndex];
  if (selectedOption) {
    updateSetting('size_name', sizeSelect.value);
    updateSetting('width', parseInt(selectedOption.dataset.width));
    updateSetting('height', parseInt(selectedOption.dataset.height));
  }
});

promptInput.addEventListener('input', () => {
  updateSetting('prompt', promptInput.value);
});

generateBtn.addEventListener('click', () => {
  if (!settings.prompt) {
    showError('Введите текстовый запрос для генерации');
    return;
  }
  
  if (!settings.model) {
    showError('Выберите модель');
    return;
  }
  
  generateImage();
});

// Переключение отображения панели настроек
settingsHeader.addEventListener('click', () => {
  const isVisible = settingsContent.style.display !== 'none';
  settingsContent.style.display = isVisible ? 'none' : 'block';
  toggleArrow.style.transform = isVisible ? 'rotate(180deg)' : 'none';
});

// Проверка телеграм-бота
async function checkTelegramBot() {
  try {
    console.log('Проверка Telegram бота');
    const response = await fetch('/api/telegram');
    if (!response.ok) {
      throw new Error('Не удалось получить информацию о боте');
    }
    
    const data = await response.json();
    console.log('Информация о боте:', data);
    
  } catch (error) {
    console.error('Ошибка проверки Telegram бота:', error);
  }
}

// Инициализация приложения
async function initApp() {
  try {
    console.log('Инициализация приложения...');
    
    // Проверяем API
    const healthStatus = await checkApiHealth();
    if (healthStatus.status !== 'ok') {
      throw new Error('API недоступно');
    }
    
    // Загружаем модели и размеры
    await Promise.all([loadModels(), loadSizes()]);
    
    // Скрываем загрузчик инициализации
    initLoader.style.display = 'none';
    
    // Сообщаем Telegram, что приложение готово
    if (telegram) {
      console.log('Сообщаем Telegram о готовности приложения');
      telegram.ready();
      
      // Активируем главную кнопку, если она доступна
      if (telegram.MainButton) {
        telegram.MainButton.setText('Сгенерировать');
        telegram.MainButton.onClick(generateImage);
        telegram.MainButton.show();
      }
    }
    
    console.log('Приложение инициализировано успешно');
  } catch (error) {
    console.error('Ошибка инициализации:', error);
    showError('Ошибка инициализации: ' + error.message);
    initLoader.innerHTML = `
      <p style="color:red; text-align:center;">
        Ошибка инициализации: ${error.message}<br>
        Попробуйте перезапустить приложение.
      </p>
    `;
  }
}

// Обработчики событий
document.addEventListener('DOMContentLoaded', function() {
  // Инициализация приложения
  initApp();
  
  // Обработчики событий для пользовательского ввода
  promptInput.addEventListener('input', function() {
    settings.prompt = this.value;
  });
  
  modelSelect.addEventListener('change', function() {
    settings.model = this.value;
  });
  
  sizeSelect.addEventListener('change', function() {
    settings.size_name = this.value;
    const selectedOption = this.options[this.selectedIndex];
    settings.width = parseInt(selectedOption.dataset.width);
    settings.height = parseInt(selectedOption.dataset.height);
  });
  
  stepsSlider.addEventListener('input', function() {
    const value = parseInt(this.value);
    stepsValue.textContent = value;
    settings.steps = value;
  });
  
  cfgScaleSlider.addEventListener('input', function() {
    const value = parseFloat(this.value);
    cfgScaleValue.textContent = value;
    settings.cfg_scale = value;
  });
  
  numResultsSlider.addEventListener('input', function() {
    const value = parseInt(this.value);
    numResultsValue.textContent = value;
    settings.number_results = value;
  });
  
  generateBtn.addEventListener('click', generateImage);
  
  // Раскрытие/скрытие панели настроек
  settingsHeader.addEventListener('click', function() {
    settingsContent.style.display = settingsContent.style.display === 'none' ? 'block' : 'none';
    toggleArrow.textContent = settingsContent.style.display === 'none' ? '▼' : '▲';
  });
}); 