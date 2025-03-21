require('dotenv').config({ path: '../.env' });

module.exports = {
  // Настройки сервера
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Настройки Telegram бота
  TELEGRAM_API_TOKEN: process.env.TELEGRAM_API_TOKEN || 'your-telegram-bot-token',
  
  // Настройки Runware API
  RUNWARE_API_URL: process.env.RUNWARE_API_URL || 'wss://api.runware.ai/ws',
  RUNWARE_API_KEY: process.env.RUNWARE_API_KEY || 'your-runware-api-key',
  
  // Настройки генерации изображений
  FLUX_MODELS: {
    "Flux 1.1": "flux.1-1",
    "Flux SD1.5": "flux.sd1-5"
  },
  
  // Доступные размеры изображений
  AVAILABLE_SIZES: {
    "512x512": [512, 512],
    "768x768": [768, 768],
    "512x768": [512, 768],
    "768x512": [768, 512]
  },
  
  // Значения по умолчанию для параметров генерации
  DEFAULT_SETTINGS: {
    model: "flux.1-1",
    model_name: "Flux 1.1",
    width: 512,
    height: 512,
    size_name: "512x512",
    steps: 30,
    cfg_scale: 7.5,
    number_results: 1,
    prompt: "",
    loras: []
  }
};
