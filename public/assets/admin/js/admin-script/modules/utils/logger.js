'use strict';

export class Logger {
    constructor(name) {
      this.name = name;
    }
  
    log(level, message, data = {}) {
      const timestamp = new Date().toISOString();
      console[level](`[${timestamp}] [${this.name}] ${message}`, data);
      
      // Add remote logging in production:
      // if (process.env.NODE_ENV === 'production') {
      //   sendToAnalytics(level, message, data);
      // }
    }
  
    debug(message, data) { this.log('debug', message, data); }
    info(message, data) { this.log('info', message, data); }
    warn(message, data) { this.log('warn', message, data); }
    error(message, error) { 
      this.log('error', message, { 
        error: error.message,
        stack: error.stack 
      }); 
    }
  }