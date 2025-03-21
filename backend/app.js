// Инициализация Telegram WebApp
const telegram = window.Telegram.WebApp;
telegram.expand();

// Устанавливаем тему
document.body.classList.add(telegram.colorScheme === 'dark' ? 'theme-dark' : 'theme-light');

// Переменные для хранения состояния приложения
let settings = {
    model: '',
    model_name: '',
    width: 512,
    height: 512,
    size_name: '512x512',
    steps: 30,
    cfg_scale: 7.5,
    number_results: 1,
    prompt: '',
    loras: []
};

// Получаем ссылки на DOM элементы
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
const settingsPanel = document.getElementById('settingsPanel');
const settingsHeader = settingsPanel.querySelector('.settings-header');
const settingsContent = settingsPanel.querySelector('.settings-content');
const toggleArrow = settingsPanel.querySelector('.toggle-arrow');
const loraModelsContainer = document.getElementById('loraModels');
const addLoraBtn = document.getElementById('addLora');

// Загрузка настроек по умолчанию
async function loadDefaultSettings() {
    try {
        const response = await fetch('/api/default-settings');
        if (!response.ok) {
            throw new Error('Не удалось загрузить настройки');
        }
        const data = await response.json();
        settings = data.settings;
        
        // Заполнение полей формы
        promptInput.value = settings.prompt;
        stepsSlider.value = settings.steps;
        stepsValue.textContent = settings.steps;
        cfgScaleSlider.value = settings.cfg_scale;
        cfgScaleValue.textContent = settings.cfg_scale;
        numResultsSlider.value = settings.number_results;
        numResultsValue.textContent = settings.number_results;
        
        // Загрузка моделей и размеров
        await Promise.all([
            loadModels(),
            loadSizes()
        ]);
        
    } catch (error) {
        showError(error.message || 'Не удалось загрузить настройки с сервера');
    }
}

// Загрузка доступных моделей
async function loadModels() {
    try {
        const response = await fetch('/api/models');
        if (!response.ok) {
            throw new Error('Не удалось загрузить модели');
        }
        const data = await response.json();
        
        // Очистка селекта
        modelSelect.innerHTML = '';
        
        // Заполнение селекта
        Object.entries(data.models).forEach(([name, id]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            modelSelect.appendChild(option);
        });
        
        // Установка выбранной модели
        if (settings.model) {
            modelSelect.value = settings.model;
        }
    } catch (error) {
        showError(error.message || 'Не удалось загрузить модели');
    }
}

// Загрузка доступных размеров
async function loadSizes() {
    try {
        const response = await fetch('/api/sizes');
        if (!response.ok) {
            throw new Error('Не удалось загрузить размеры');
        }
        const data = await response.json();
        
        // Очистка селекта
        sizeSelect.innerHTML = '';
        
        // Заполнение селекта
        Object.entries(data.sizes).forEach(([name, [width, height]]) => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            option.dataset.width = width;
            option.dataset.height = height;
            sizeSelect.appendChild(option);
        });
        
        // Установка выбранного размера
        if (settings.size_name) {
            sizeSelect.value = settings.size_name;
        }
    } catch (error) {
        showError(error.message || 'Не удалось загрузить размеры');
    }
}

// Генерация изображения
async function generateImage() {
    try {
        // Показываем лоадер
        loader.style.display = 'flex';
        
        // Формируем тело запроса
        const requestBody = {
            prompt: settings.prompt,
            model: settings.model,
            width: settings.width,
            height: settings.height,
            steps: settings.steps,
            cfg_scale: settings.cfg_scale,
            number_results: settings.number_results,
            loras: settings.loras
        };
        
        // Отправляем запрос
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Ошибка генерации изображения');
        }
        
        const data = await response.json();
        
        // Отображаем результаты
        displayResults(data.images);
        
    } catch (error) {
        showError(error.message || 'Произошла ошибка при генерации изображения');
    } finally {
        // Скрываем лоадер
        loader.style.display = 'none';
    }
}

// Отображение результатов
function displayResults(images) {
    resultsArea.innerHTML = '';
    
    if (!images || images.length === 0) {
        resultsArea.innerHTML = '<div class="error-message">Нет результатов</div>';
        return;
    }
    
    images.forEach(imageUrl => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = 'Generated image';
        image.onerror = () => {
            image.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22232%22%20height%3D%22232%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20232%20232%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_16e83f428cc%20text%20%7B%20fill%3A%23868e96%3Bfont-weight%3Abold%3Bfont-family%3AArial%2C%20Helvetica%2C%20Open%20Sans%2C%20sans-serif%2C%20monospace%3Bfont-size%3A12pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_16e83f428cc%22%3E%3Crect%20width%3D%22232%22%20height%3D%22232%22%20fill%3D%22%23777%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%2285.859375%22%20y%3D%22121.2%22%3EError%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E';
        };
        
        resultItem.appendChild(image);
        resultsArea.appendChild(resultItem);
    });
}

// Отображение ошибки
function showError(message) {
    console.error(message);
    telegram.showAlert(message);
}

// Обработчик изменения настроек
function updateSetting(key, value) {
    settings[key] = value;
}

// Обработчики событий слайдеров
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

// Обработчики событий селектов
modelSelect.addEventListener('change', () => {
    const selectedOption = modelSelect.options[modelSelect.selectedIndex];
    updateSetting('model', modelSelect.value);
    updateSetting('model_name', selectedOption.textContent);
});

sizeSelect.addEventListener('change', () => {
    const selectedOption = sizeSelect.options[sizeSelect.selectedIndex];
    updateSetting('size_name', sizeSelect.value);
    updateSetting('width', parseInt(selectedOption.dataset.width));
    updateSetting('height', parseInt(selectedOption.dataset.height));
});

// Обработчик событий поля ввода промпта
promptInput.addEventListener('input', () => {
    updateSetting('prompt', promptInput.value);
});

// Обработчик нажатия на кнопку генерации
generateBtn.addEventListener('click', () => {
    if (!settings.prompt) {
        showError('Введите текстовый запрос');
        return;
    }
    generateImage();
});

// Переключение отображения панели настроек
settingsHeader.addEventListener('click', () => {
    settingsContent.style.display = settingsContent.style.display === 'none' ? 'block' : 'none';
    toggleArrow.style.transform = settingsContent.style.display === 'none' ? 'rotate(180deg)' : 'none';
});

// Инициализация приложения
async function initApp() {
    try {
        // Проверяем, что Telegram WebApp доступен
        if (!telegram) {
            document.body.innerHTML = '<div class="error-message">Это приложение может быть запущено только из Telegram</div>';
            return;
        }
        
        // Загружаем настройки
        await loadDefaultSettings();
        
        // Показываем основной контент
        document.body.style.visibility = 'visible';
        
    } catch (error) {
        showError('Ошибка инициализации приложения: ' + error.message);
    }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', initApp);
