// Проверка работоспособности API
module.exports = async (req, res) => {
  console.log('API /health: Проверка работоспособности API');
  
  // Информация о переменных окружения (без вывода самих значений)
  const envVars = {
    RUNWARE_API_KEY: process.env.RUNWARE_API_KEY ? 'установлен' : 'отсутствует',
    TELEGRAM_API_TOKEN: process.env.TELEGRAM_API_TOKEN ? 'установлен' : 'отсутствует',
    NODE_ENV: process.env.NODE_ENV || 'не установлена'
  };
  
  console.log('API /health: Статус переменных окружения:', envVars);
  
  // Подготовка ответа
  const response = {
    status: 'active',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    env_status: envVars,
    version: '1.0.0'
  };
  
  // Отправляем ответ
  return res.status(200).json(response);
}; 