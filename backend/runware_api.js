const WebSocket = require('ws');
const config = require('./config');

class RunwareAPI {
  constructor(apiUrl, apiKey) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = 5000;
    this.messageHandlers = new Map();
    this.messageId = 1;
    this.pendingMessages = {};
    this.debug = true; // включаем отладку
  }

  log(message, ...args) {
    if (this.debug) {
      console.log(`[RunwareAPI] ${message}`, ...args);
    }
  }

  /**
   * Подключение к API
   */
  async connect() {
    if (this.connected || this.connecting) {
      this.log('Уже подключен или в процессе подключения');
      return;
    }

    this.connecting = true;

    try {
      this.log('Подключение к Runware API:', this.apiUrl);
      
      return new Promise((resolve, reject) => {
        try {
          this.ws = new WebSocket(this.apiUrl);

          this.ws.onopen = () => {
            this.log('WebSocket соединение установлено');
            
            // Аутентификация
            const authMessage = {
              type: 'authenticate',
              payload: {
                api_key: this.apiKey
              }
            };
            
            this.log('Отправка аутентификации');
            this.sendMessage(authMessage)
              .then(() => {
                this.log('Аутентификация успешна');
                this.connected = true;
                this.reconnectAttempts = 0;
                this.connecting = false;
                resolve();
              })
              .catch((error) => {
                this.log('Ошибка аутентификации:', error);
                this.connecting = false;
                reject(error);
              });
          };

          this.ws.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data);
              this.log('Получено сообщение:', message);
              this._messageHandler(message);
            } catch (error) {
              this.log('Ошибка при обработке сообщения:', error);
            }
          };

          this.ws.onerror = (error) => {
            this.log('WebSocket ошибка:', error);
            this.connecting = false;
            reject(new Error('Ошибка WebSocket соединения'));
          };

          this.ws.onclose = () => {
            this.log('WebSocket соединение закрыто');
            this.connected = false;
            this.connecting = false;
            
            // Попытка переподключения
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              this.reconnectAttempts++;
              this.log(`Попытка переподключения ${this.reconnectAttempts} из ${this.maxReconnectAttempts} через ${this.reconnectTimeout}ms`);
              setTimeout(() => this.reconnect(), this.reconnectTimeout);
            }
          };
        } catch (error) {
          this.log('Ошибка при создании WebSocket:', error);
          this.connecting = false;
          reject(error);
        }
      });
    } catch (error) {
      this.log('Ошибка при подключении:', error);
      this.connecting = false;
      throw error;
    }
  }

  /**
   * Переподключение к API
   */
  async reconnect() {
    this.log('Попытка переподключения к Runware API');
    try {
      await this.connect();
      this.log('Переподключение успешно');
    } catch (error) {
      this.log('Ошибка при переподключении:', error);
    }
  }

  /**
   * Обработчик входящих сообщений
   */
  _messageHandler(message) {
    // Проверка, есть ли обработчик для message_id
    if (message.message_id && this.pendingMessages[message.message_id]) {
      const { resolve, reject } = this.pendingMessages[message.message_id];
      
      if (message.error) {
        reject(new Error(message.error));
      } else {
        resolve(message);
      }
      
      // Удаляем обработчик после использования
      delete this.pendingMessages[message.message_id];
    }
    
    // Обработка сообщений по типу
    if (message.type) {
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        handler(message);
      }
    }
  }

  /**
   * Отправка сообщения в API
   */
  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        this.log('Не подключен к API');
        reject(new Error('Не подключен к API'));
        return;
      }
      
      // Генерируем уникальный message_id
      const messageId = this.messageId++;
      message.message_id = messageId;
      
      // Сохраняем промисы для ответа
      this.pendingMessages[messageId] = { resolve, reject };
      
      // Отправляем сообщение
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        delete this.pendingMessages[messageId];
        reject(error);
      }
      
      // Устанавливаем таймаут для ожидания ответа
      setTimeout(() => {
        if (this.pendingMessages[messageId]) {
          delete this.pendingMessages[messageId];
          reject(new Error('Таймаут ожидания ответа'));
        }
      }, 30000); // 30 секунд таймаут
    });
  }

  /**
   * Закрытие соединения
   */
  async close() {
    if (this.ws) {
      this.ws.close();
    }
    
    this.connected = false;
    
    return true;
  }

  /**
   * Генерация изображения
   */
  async generateImage(options) {
    try {
      if (!this.connected) {
        await this.connect();
      }
      
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
      
      this.log('Генерация изображения. Модель:', model, 'Промпт:', prompt);
      
      // Отправляем запрос на генерацию
      const message = {
        type: 'generate',
        payload: {
          prompt,
          model,
          width,
          height,
          steps,
          cfg_scale,
          negative_prompt,
          number_results,
          loras
        }
      };
      
      // Ожидаем ответ, таймаут 5 минут для больших генераций
      const response = await this.sendMessageWithTimeout(message, 300000);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Проверяем результат на наличие URL изображений
      if (response.payload && response.payload.imageURLs && Array.isArray(response.payload.imageURLs)) {
        return response.payload.imageURLs;
      } else if (response.payload && response.payload.images && Array.isArray(response.payload.images)) {
        return response.payload.images.map(img => img.url || img.imageURL);
      } else if (response.payload && response.payload.imageURL) {
        return [response.payload.imageURL];
      } else {
        throw new Error('Неизвестный формат ответа от API');
      }
    } catch (error) {
      this.log('Ошибка при генерации изображения:', error);
      throw error;
    }
  }
  
  /**
   * Отправка сообщения с таймаутом
   */
  async sendMessageWithTimeout(message, timeout = 120000) {
    return new Promise((resolve, reject) => {
      const messageId = this.messageId++;
      message.message_id = messageId;
      
      this.pendingMessages[messageId] = { resolve, reject };
      
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        delete this.pendingMessages[messageId];
        reject(error);
        return;
      }
      
      // Устанавливаем таймаут
      setTimeout(() => {
        if (this.pendingMessages[messageId]) {
          delete this.pendingMessages[messageId];
          reject(new Error('Таймаут генерации изображения'));
        }
      }, timeout);
    });
  }
  
  // Проверка соединения
  isConnected() {
    return this.connected;
  }
}

// Создаем и экспортируем экземпляр API
const runwareApi = new RunwareAPI(config.RUNWARE_API_URL, config.RUNWARE_API_KEY);
module.exports = runwareApi;
