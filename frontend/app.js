// Инициализация Telegram WebApp
let tg = window.Telegram.WebApp;
tg.expand(); // Раскрываем на весь экран

// Настройки по умолчанию
const defaultSettings = {
  model: 'flux.1-1',
  model_name: 'Flux 1.1',
  width: 512,
  height: 512,
  size_name: '512x512',
  steps: 30,
  cfg_scale: 7.5,
  number_results: 1,
  prompt: '',
  loras: []
};

// Состояние приложения
let appState = {
  settings: { ...defaultSettings },
  settingsOpen: true,
  loras: []
};

// API URL (в зависимости от окружения)
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api' 
  : '/api';

// DOM элементы
const elements = {
  prompt: document.getElementById('prompt'),
  model: document.getElementById('model'),
  size: document.getElementById('size'),
  steps: document.getElementById('steps'),
  stepsValue: document.getElementById('steps-value'),
  cfgScale: document.getElementById('cfg-scale'),
  cfgValue: document.getElementById('cfg-value'),
  numberResults: document.getElementById('number-results'),
  resultsValue: document.getElementById('results-value'),
  generateButton: document.getElementById('generate-button'),
  toggleSettings: document.getElementById('toggle-settings'),
  settingsBody: document.querySelector('.settings-body'),
  resultsContainer: document.getElementById('results-container'),
  imagesContainer: document.getElementById('images-container'),
  loader: document.getElementById('loader'),
  lorasContainer: document.getElementById('loras-container'),
  addLoraButton: document.getElementById('add-lora'),
  loraModal: document.getElementById('lora-modal'),
  closeModalButton: document.getElementById('close-modal'),
  loraIdInput: document.getElementById('lora-id'),
  loraWeightInput: document.getElementById('lora-weight'),
  weightValue: document.getElementById('weight-value'),
  addLoraModalButton: document.getElementById('add-lora-button')
};

// Инициализация приложения
async function initApp() {
  // Загрузка настроек с сервера
  await loadSettings();
  
  // Настройка UI
  setupEventListeners();
  
  // Инициализация Telegram WebApp
  setupTelegramWebApp();
  
  // Если пользователь уже был в приложении, загружаем сохраненные настройки
  loadSavedSettings();
}

// Загрузка настроек с сервера
async function loadSettings() {
  try {
    // Загрузка моделей
    const modelsResponse = await fetch(`${API_URL}/models`);
    const modelsData = await modelsResponse.json();
    populateModelSelect(modelsData.models);
    
    // Загрузка размеров
    const sizesResponse = await fetch(`${API_URL}/sizes`);
    const sizesData = await sizesResponse.json();
    populateSizeSelect(sizesData.sizes);
    
    // Загрузка настроек по умолчанию
    const defaultSettingsResponse = await fetch(`${API_URL}/default-settings`);
    const defaultSettingsData = await defaultSettingsResponse.json();
    Object.assign(appState.settings, defaultSettingsData.settings);
    
    // Применяем настройки к интерфейсу
    applySettingsToUI();
    
  } catch (error) {
    console.error('Ошибка при загрузке настроек:', error);
    showError('Не удалось загрузить настройки с сервера');
  }
}

// Заполнение списка моделей
function populateModelSelect(models) {
  elements.model.innerHTML = '';
  
  for (const [name, id] of Object.entries(models)) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = name;
    elements.model.appendChild(option);
  }
}

// Заполнение списка размеров
function populateSizeSelect(sizes) {
  elements.size.innerHTML = '';
  
  for (const [name, dimensions] of Object.entries(sizes)) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    option.dataset.width = dimensions[0];
    option.dataset.height = dimensions[1];
    elements.size.appendChild(option);
  }
}

// Применение настроек к UI
function applySettingsToUI() {
  const { settings } = appState;
  
  // Промпт
  elements.prompt.value = settings.prompt || '';
  
  // Модель
  if (settings.model) {
    elements.model.value = settings.model;
  }
  
  // Размер
  if (settings.size_name) {
    elements.size.value = settings.size_name;
  }
  
  // Шаги
  elements.steps.value = settings.steps;
  elements.stepsValue.textContent = settings.steps;
  
  // CFG Scale
  elements.cfgScale.value = settings.cfg_scale;
  elements.cfgValue.textContent = settings.cfg_scale;
  
  // Количество результатов
  elements.numberResults.value = settings.number_results;
  elements.resultsValue.textContent = settings.number_results;
  
  // LoRA модели
  renderLoraModels();
}

// Отрисовка списка LoRA моделей
function renderLoraModels() {
  elements.lorasContainer.innerHTML = '';
  
  if (appState.settings.loras.length === 0) {
    elements.lorasContainer.innerHTML = '<p>Нет добавленных LoRA моделей</p>';
    return;
  }
  
  appState.settings.loras.forEach((lora, index) => {
    const loraItem = document.createElement('div');
    loraItem.className = 'lora-item';
    
    const loraInfo = document.createElement('div');
    loraInfo.className = 'lora-info';
    
    const loraModel = document.createElement('div');
    loraModel.className = 'lora-model';
    loraModel.textContent = lora.model;
    
    const loraWeight = document.createElement('div');
    loraWeight.className = 'lora-weight';
    loraWeight.textContent = `Вес: ${lora.weight}`;
    
    loraInfo.appendChild(loraModel);
    loraInfo.appendChild(loraWeight);
    
    const removeButton = document.createElement('button');
    removeButton.className = 'icon-button remove-lora';
    removeButton.innerHTML = '<span class="material-icons">delete</span>';
    removeButton.addEventListener('click', () => removeLora(index));
    
    loraItem.appendChild(loraInfo);
    loraItem.appendChild(removeButton);
    
    elements.lorasContainer.appendChild(loraItem);
  });
}

// Удаление LoRA модели
function removeLora(index) {
  appState.settings.loras.splice(index, 1);
  renderLoraModels();
  saveSettings();
}

// Добавление LoRA модели
function addLora() {
  const id = elements.loraIdInput.value.trim();
  const weight = parseFloat(elements.loraWeightInput.value);
  
  if (!id) {
    showError('Введите идентификатор LoRA модели');
    return;
  }
  
  appState.settings.loras.push({
    model: id,
    weight: weight
  });
  
  renderLoraModels();
  saveSettings();
  closeLoraModal();
}

// Открытие модального окна для добавления LoRA
function openLoraModal() {
  elements.loraIdInput.value = '';
  elements.loraWeightInput.value = 1;
  elements.weightValue.textContent = '1';
  elements.loraModal.classList.remove('hidden');
}

// Закрытие модального окна
function closeLoraModal() {
  elements.loraModal.classList.add('hidden');
}

// Настройка обработчиков событий
function setupEventListeners() {
  // Промпт
  elements.prompt.addEventListener('input', () => {
    appState.settings.prompt = elements.prompt.value;
    saveSettings();
  });
  
  // Модель
  elements.model.addEventListener('change', () => {
    const selectedOption = elements.model.options[elements.model.selectedIndex];
    appState.settings.model = elements.model.value;
    appState.settings.model_name = selectedOption.textContent;
    saveSettings();
  });
  
  // Размер
  elements.size.addEventListener('change', () => {
    const selectedOption = elements.size.options[elements.size.selectedIndex];
    appState.settings.size_name = elements.size.value;
    appState.settings.width = parseInt(selectedOption.dataset.width);
    appState.settings.height = parseInt(selectedOption.dataset.height);
    saveSettings();
  });
  
  // Шаги
  elements.steps.addEventListener('input', () => {
    appState.settings.steps = parseInt(elements.steps.value);
    elements.stepsValue.textContent = elements.steps.value;
    saveSettings();
  });
  
  // CFG Scale
  elements.cfgScale.addEventListener('input', () => {
    appState.settings.cfg_scale = parseFloat(elements.cfgScale.value);
    elements.cfgValue.textContent = elements.cfgScale.value;
    saveSettings();
  });
  
  // Количество результатов
  elements.numberResults.addEventListener('input', () => {
    appState.settings.number_results = parseInt(elements.numberResults.value);
    elements.resultsValue.textContent = elements.numberResults.value;
    saveSettings();
  });
  
  // Переключение видимости настроек
  elements.toggleSettings.addEventListener('click', () => {
    appState.settingsOpen = !appState.settingsOpen;
    if (appState.settingsOpen) {
      elements.settingsBody.style.display = 'block';
      elements.toggleSettings.querySelector('.material-icons').textContent = 'expand_less';
    } else {
      elements.settingsBody.style.display = 'none';
      elements.toggleSettings.querySelector('.material-icons').textContent = 'expand_more';
    }
  });
  
  // Кнопка генерации
  elements.generateButton.addEventListener('click', generateImage);
  
  // LoRA модели
  elements.addLoraButton.addEventListener('click', openLoraModal);
  elements.closeModalButton.addEventListener('click', closeLoraModal);
  elements.addLoraModalButton.addEventListener('click', addLora);
  
  // Вес LoRA
  elements.loraWeightInput.addEventListener('input', () => {
    elements.weightValue.textContent = elements.loraWeightInput.value;
  });
}

// Настройка Telegram WebApp
function setupTelegramWebApp() {
  // Адаптация темы
  applyTelegramTheme();
  
  // Настройка кнопки на основной панели
  tg.MainButton.setText('ГЕНЕРИРОВАТЬ');
  tg.MainButton.onClick(() => {
    generateImage();
  });
  
  // Показываем кнопку только если промпт заполнен
  if (appState.settings.prompt) {
    tg.MainButton.show();
  }
  
  // При изменении промпта показываем/скрываем кнопку
  elements.prompt.addEventListener('input', () => {
    if (elements.prompt.value.trim()) {
      tg.MainButton.show();
    } else {
      tg.MainButton.hide();
    }
  });
}

// Применение темы Telegram
function applyTelegramTheme() {
  const root = document.documentElement;
  
  root.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');
  root.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#000000');
  root.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#707579');
  root.style.setProperty('--tg-theme-link-color', tg.themeParams.link_color || '#2481cc');
  root.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#2481cc');
  root.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#ffffff');
  root.style.setProperty('--tg-theme-secondary-bg-color', tg.themeParams.secondary_bg_color || '#f0f0f0');
  
  // Расчет производных цветов
  const isDarkTheme = isColorDark(tg.themeParams.bg_color || '#ffffff');
  
  if (isDarkTheme) {
    root.style.setProperty('--card-bg-color', lightenDarkenColor(tg.themeParams.bg_color, 10));
    root.style.setProperty('--border-color', lightenDarkenColor(tg.themeParams.bg_color, 20));
    root.style.setProperty('--form-bg-color', lightenDarkenColor(tg.themeParams.bg_color, 5));
  } else {
    root.style.setProperty('--card-bg-color', '#ffffff');
    root.style.setProperty('--border-color', '#e0e0e0');
    root.style.setProperty('--form-bg-color', '#f8f8f8');
  }
}

// Проверка темная ли тема
function isColorDark(color) {
  // Удаляем # из начала строки, если есть
  color = color.replace('#', '');
  
  // Парсим цвет в RGB компоненты
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  
  // Вычисляем яркость цвета (перцепционная формула)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  // Если яркость меньше 128, считаем цвет темным
  return brightness < 128;
}

// Осветление/затемнение цвета на указанное значение
function lightenDarkenColor(color, amount) {
  color = color.replace('#', '');
  
  let r = parseInt(color.substring(0, 2), 16);
  let g = parseInt(color.substring(2, 4), 16);
  let b = parseInt(color.substring(4, 6), 16);
  
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Генерация изображения
async function generateImage() {
  if (!appState.settings.prompt) {
    showError('Введите промпт для генерации');
    return;
  }
  
  try {
    showLoader();
    
    const response = await fetch(`${API_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(appState.settings)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Ошибка генерации изображения');
    }
    
    const data = await response.json();
    
    // Отображаем результаты
    showResults(data.images);
    
  } catch (error) {
    console.error('Ошибка при генерации изображения:', error);
    showError(error.message || 'Произошла ошибка при генерации изображения');
  } finally {
    hideLoader();
  }
}

// Отображение результатов
function showResults(images) {
  elements.imagesContainer.innerHTML = '';
  elements.resultsContainer.classList.remove('hidden');
  
  images.forEach(imageUrl => {
    const imageCard = document.createElement('div');
    imageCard.className = 'image-card';
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = 'Сгенерированное изображение';
    img.addEventListener('click', () => openImage(imageUrl));
    
    imageCard.appendChild(img);
    elements.imagesContainer.appendChild(imageCard);
  });
  
  // Прокрутка к результатам
  elements.resultsContainer.scrollIntoView({ behavior: 'smooth' });
  
  // Если есть ссылка на чат с ботом, отправляем первое изображение
  sendToTelegramBot(images[0]);
}

// Отправка результата в Telegram
function sendToTelegramBot(imageUrl) {
  if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    // Фиксируем, что пользователь использовал приложение
    tg.sendData(JSON.stringify({
      action: 'image_generated',
      image_url: imageUrl,
      prompt: appState.settings.prompt
    }));
  }
}

// Открытие изображения на весь экран
function openImage(imageUrl) {
  window.open(imageUrl, '_blank');
}

// Отображение ошибки
function showError(message) {
  // Временный алерт, можно заменить на более красивое уведомление
  alert(`Ошибка: ${message}`);
}

// Показ лоадера
function showLoader() {
  elements.loader.classList.remove('hidden');
}

// Скрытие лоадера
function hideLoader() {
  elements.loader.classList.add('hidden');
}

// Сохранение настроек в localStorage
function saveSettings() {
  localStorage.setItem('appSettings', JSON.stringify(appState.settings));
}

// Загрузка сохраненных настроек
function loadSavedSettings() {
  const savedSettings = localStorage.getItem('appSettings');
  if (savedSettings) {
    try {
      const parsedSettings = JSON.parse(savedSettings);
      Object.assign(appState.settings, parsedSettings);
      applySettingsToUI();
    } catch (error) {
      console.error('Ошибка при загрузке сохраненных настроек:', error);
    }
  }
}

// Инициализация приложения при загрузке
document.addEventListener('DOMContentLoaded', initApp);
