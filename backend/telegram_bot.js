const { Telegraf } = require('telegraf');
const config = require('./config');

// Создаем экземпляр бота
const bot = new Telegraf(config.TELEGRAM_API_TOKEN);

// URL вашего размещенного веб-приложения
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://your-app-domain.com';

// Обработка команды /start
bot.start((ctx) => {
  ctx.reply('Привет! Я бот для генерации изображений с помощью модели Flux.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🖼 Генерировать изображение', web_app: { url: WEBAPP_URL } }]
      ]
    }
  });
});

// Обработка команды /help
bot.help((ctx) => {
  ctx.reply(
    'Я помогаю генерировать изображения с помощью модели Flux.\n\n' +
    'Доступные команды:\n' +
    '/start - Запустить бота\n' +
    '/generate - Начать генерацию изображения\n' +
    '/help - Показать это сообщение с помощью'
  );
});

// Обработка команды /generate
bot.command('generate', (ctx) => {
  ctx.reply('Начните генерацию изображения:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🖼 Открыть генератор', web_app: { url: WEBAPP_URL } }]
      ]
    }
  });
});

// Обработка данных, отправленных из веб-приложения
bot.on('web_app_data', async (ctx) => {
  try {
    const data = JSON.parse(ctx.webAppData.data);
    
    // Обработка различных действий
    if (data.action === 'image_generated' && data.image_url) {
      await ctx.replyWithPhoto(data.image_url, {
        caption: `Изображение сгенерировано!\n\nПромпт: ${data.prompt || 'Не указан'}`
      });
    }
  } catch (error) {
    console.error('Ошибка при обработке данных из веб-приложения:', error);
    ctx.reply('Произошла ошибка при обработке данных из веб-приложения');
  }
});

// Запуск бота
async function startBot() {
  try {
    await bot.launch();
    console.log('Telegram бот запущен');
    
    // Правильное завершение работы
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
    return true;
  } catch (error) {
    console.error('Ошибка при запуске Telegram бота:', error);
    return false;
  }
}

module.exports = { bot, startBot }; 