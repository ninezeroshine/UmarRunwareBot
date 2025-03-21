// Проверка работоспособности сервера
module.exports = async (req, res) => {
  console.log('API /health: Проверка работоспособности');
  
  const telegramApiToken = process.env.TELEGRAM_API_TOKEN ? 'настроен' : 'отсутствует';
  const runwareApiKey = process.env.RUNWARE_API_KEY ? 'настроен' : 'отсутствует';
  const webappUrl = process.env.WEBAPP_URL ? process.env.WEBAPP_URL : 'отсутствует';
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    api: {
      telegram: telegramApiToken,
      runware: runwareApiKey,
      webappUrl: webappUrl
    }
  });
}; 