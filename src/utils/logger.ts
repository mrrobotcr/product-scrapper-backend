/**
 * Logger utility for structured logging con soporte para contextos
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

// Nivel de log global (puede configurarse por ENV)
let currentLogLevel: LogLevel = process.env.LOG_LEVEL 
  ? (LogLevel as any)[process.env.LOG_LEVEL] 
  : LogLevel.INFO;

/**
 * Establece el nivel mínimo de logs a mostrar
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

/**
 * Crea un logger con contexto específico (ej: nombre de tienda)
 */
export function createContextLogger(context: string) {
  const prefix = context ? `[${context}] ` : '';
  
  return {
    debug: (message: string, data?: any) => {
      if (currentLogLevel <= LogLevel.DEBUG) {
        console.log(`🔍 ${prefix}${message}`, data || '');
      }
    },

    info: (message: string, data?: any) => {
      if (currentLogLevel <= LogLevel.INFO) {
        console.log(`ℹ️  ${prefix}${message}`, data || '');
      }
    },

    success: (message: string, data?: any) => {
      if (currentLogLevel <= LogLevel.INFO) {
        console.log(`✅ ${prefix}${message}`, data || '');
      }
    },

    warn: (message: string, data?: any) => {
      if (currentLogLevel <= LogLevel.WARN) {
        console.warn(`⚠️  ${prefix}${message}`, data || '');
      }
    },

    error: (message: string, error?: any) => {
      if (currentLogLevel <= LogLevel.ERROR) {
        console.error(`❌ ${prefix}${message}`, error || '');
      }
    },

    // Métodos especiales para scraping
    scraping: (message: string) => {
      if (currentLogLevel <= LogLevel.INFO) {
        console.log(`🔍 ${prefix}${message}`);
      }
    },

    section: (title: string) => {
      if (currentLogLevel <= LogLevel.INFO) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`${prefix}${title}`);
        console.log(`${'='.repeat(60)}\n`);
      }
    },
  };
}

// Logger global sin contexto
export const logger = createContextLogger('');

// Re-exportar para compatibilidad
export default logger;
