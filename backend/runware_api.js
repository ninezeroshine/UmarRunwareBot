const WebSocket = require('ws');
const config = require('./config');

class RunwareAPI {
  constructor() {
    this.connected = false;
    this.ws = null;
    this.messageHandlers = {};
    this.pendingMessages = {};
    this.messageId = 1;
    this.connectionPromise = null;
    this.keepAliveInterval = null;
  }

  /**
   * Соединение с API Runware
   */
  async connect() {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      console.log('Подключение к Runware API...');
      
      this.ws = new WebSocket(config.RUNWARE_API_URL);
      
      this.ws.on('open', () => {
        console.log('Соединение с Runware API установлено');
        this.connected = true;
        
        // Авторизация по API ключу
        this.sendMessage({
          type: 'authenticate',
          payload: {
            api_key: config.RUNWARE_API_KEY
          }
        }).then(response => {
          console.log('Авторизация успешна');
          
          // Запускаем keepalive
          this._keepalive();
          
          resolve(true);
        }).catch(error => {
          console.error('Ошибка авторизации:', error);
          reject(error);
        });
      });
      
      this.ws.on('message', (data) => {
        this._messageHandler(data);
      });
      
      this.ws.on('error', (error) => {
        console.error('Ошибка WebSocket:', error);
        this.connected = false;
        reject(error);
      });
      
      this.ws.on('close', () => {
        console.log('Соединение с Runware API закрыто');
        this.connected = false;
        clearInterval(this.keepAliveInterval);
        this.connectionPromise = null;
      });
    });
    
    return this.connectionPromise;
  }

  /**
   * Отправка keepalive для поддержания соединения
   */
  _keepalive() {
    this.keepAliveInterval = setInterval(() => {
      if (this.connected) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // каждые 30 секунд
  }

  /**
   * Переподключение к API при разрыве соединения
   */
  async reconnect() {
    if (this.connected) {
      await this.close();
    }
    return this.connect();
  }

  /**
   * Закрытие соединения
   */
  async close() {
    clearInterval(this.keepAliveInterval);
    
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }
    
    this.connected = false;
    this.connectionPromise = null;
    
    return true;
  }

  /**
   * Обработчик входящих сообщений
   */
  _messageHandler(data) {
    try {
      const message = JSON.parse(data);
      console.log('Получено сообщение:', message.type || 'unknown type');
      
      // Обработка ответа на сообщение по id
      if (message.id && this.pendingMessages[message.id]) {
        const { resolve, reject } = this.pendingMessages[message.id];
        
        if (message.error) {
          reject(message.error);
        } else {
          resolve(message);
        }
        
        delete this.pendingMessages[message.id];
        return;
      }
      
      // Обработка сообщений по типу
      if (message.type && this.messageHandlers[message.type]) {
        this.messageHandlers[message.type](message);
      }
    } catch (e) {
      console.error('Ошибка обработки сообщения:', e);
    }
  }

  /**
   * Отправка сообщения в API
   */
  async sendMessage(message) {
    if (!this.connected) {
      await this.connect();
    }
    
    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      const messageWithId = { ...message, id };
      
      this.pendingMessages[id] = { resolve, reject };
      
      this.ws.send(JSON.stringify(messageWithId));
      
      // Таймаут на получение ответа
      setTimeout(() => {
        if (this.pendingMessages[id]) {
          delete this.pendingMessages[id];
          reject(new Error('Таймаут ожидания ответа'));
        }
      }, 60000);
    });
  }

  /**
   * Регистрация обработчика для определенного типа сообщений
   */
  onMessage(type, handler) {
    this.messageHandlers[type] = handler;
  }

  /**
   * Генерация изображения
   */
  async generateImage(options) {
    const {
      prompt,
      model,
      width = 512,
      height = 512,
      steps = 30,
      cfg_scale = 7.5,
      negative_prompt = "",
      number_results = 1,
      loras = []
    } = options;
    
    try {
      // Формируем запрос на генерацию
      const request = {
        type: 'generate',
        payload: {
          prompt,
          negative_prompt,
          model,
          width,
          height,
          steps,
          cfg_scale,
          batch_size: number_results,
          loras: loras.map(lora => ({
            model: lora.model,
            weight: lora.weight
          }))
        }
      };
      
      console.log('Запрос генерации:', request);
      
      // Отправляем запрос и ожидаем результат
      const response = await this.sendMessage(request);
      console.log('Получен ответ на запрос генерации');
      
      // Ожидаем результат генерации
      return new Promise((resolve, reject) => {
        let timeout = setTimeout(() => {
          reject(new Error('Превышено время ожидания результата генерации'));
        }, 300000); // 5 минут таймаут
        
        // Обработчик для результата генерации
        this.onMessage('generation_result', (result) => {
          clearTimeout(timeout);
          
          if (result.payload.error) {
            reject(new Error(result.payload.error));
            return;
          }
          
          // Извлекаем URL изображений
          if (result.payload.imageURLs && Array.isArray(result.payload.imageURLs)) {
            resolve(result.payload.imageURLs);
          } else if (result.payload.images && Array.isArray(result.payload.images)) {
            resolve(result.payload.images.map(img => img.url));
          } else if (result.payload.imageURL) {
            resolve([result.payload.imageURL]);
          } else {
            reject(new Error('Неизвестный формат ответа'));
          }
        });
      });
    } catch (error) {
      console.error('Ошибка генерации:', error);
      throw error;
    }
  }
}

// Создаем и экспортируем экземпляр API
const runwareApi = new RunwareAPI();
module.exports = runwareApi;
