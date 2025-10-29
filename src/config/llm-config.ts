import { LLMOperation, LLMProvider, LLMProviderConfig, OperationConfig } from '../types/llm.types';

/**
 * Configuración de providers y modelos por operación
 * 
 * Campos opcionales:
 * - supportsThinking: true/false para activar/desactivar thinking (se detecta automáticamente si no se especifica)
 * - temperature: número entre 0 y 1 para controlar la temperatura (usa valores por defecto si no se especifica)
 * 
 * Ejemplos:
 * 
 * Con thinking explícito:
 * {
 *   provider: LLMProvider.OPENAI,
 *   model: 'o1-preview',
 *   supportsThinking: true
 * }
 * 
 * Con temperatura personalizada:
 * {
 *   provider: LLMProvider.OPENAI,
 *   model: 'gpt-4o-mini',
 *   temperature: 0.5
 * }
 */
const defaultConfig: LLMProviderConfig = {
  // Filtrado por relevancia - Gemini Flash es más rápido y económico
  [LLMOperation.FILTER_BY_RELEVANCE]: {
    provider: LLMProvider.GEMINI,
    model: 'gemini-2.5-flash',
    // temperature: 0.3  // Opcional: personalizar temperatura
    supportsThinking: true
  },
  
  // Ordenamiento por similaridad - Gemini Flash Lite es el más rápido
  [LLMOperation.SORT_BY_SIMILARITY]: {
    provider: LLMProvider.GEMINI,
    model: 'gemini-2.5-flash-lite'
    // supportsThinking: false  // Opcional: desactivar detección automática de thinking
  },
  
  // Filtro en lenguaje natural - OpenAI tiene mejor comprensión de contexto
  [LLMOperation.APPLY_NATURAL_LANGUAGE_FILTER]: {
    provider: LLMProvider.GEMINI,
    model: 'gemini-2.5-flash-lite'
    // supportsThinking: false  // Opcional: para modelos que no soportan thinking
  },
  
  // Enriquecimiento de productos - Gemini tiene mejor análisis de imágenes
  [LLMOperation.ENRICH_PRODUCT]: {
    provider: LLMProvider.GEMINI,
    model: 'gemini-2.5-flash-lite'
  }
};

/**
 * Clase para gestionar la configuración de LLM providers
 */
export class LLMConfig {
  private config: LLMProviderConfig;

  constructor(customConfig?: Partial<LLMProviderConfig>) {
    this.config = { ...defaultConfig, ...customConfig };
  }

  /**
   * Obtiene la configuración completa (provider + modelo) para una operación
   */
  getOperationConfig(operation: LLMOperation): OperationConfig {
    return this.config[operation];
  }

  /**
   * Obtiene solo el provider para una operación específica
   */
  getProvider(operation: LLMOperation): LLMProvider {
    return this.config[operation].provider;
  }

  /**
   * Obtiene solo el modelo para una operación específica
   */
  getModel(operation: LLMOperation): string {
    return this.config[operation].model;
  }

  /**
   * Actualiza el provider para una operación específica (mantiene el modelo)
   */
  setProvider(operation: LLMOperation, provider: LLMProvider): void {
    this.config[operation] = {
      ...this.config[operation],
      provider
    };
  }

  /**
   * Actualiza el modelo para una operación específica (mantiene el provider)
   */
  setModel(operation: LLMOperation, model: string): void {
    this.config[operation] = {
      ...this.config[operation],
      model
    };
  }

  /**
   * Actualiza tanto el provider como el modelo para una operación
   */
  setOperationConfig(operation: LLMOperation, config: OperationConfig): void {
    this.config[operation] = config;
  }

  /**
   * Actualiza múltiples providers a la vez
   */
  updateConfig(newConfig: Partial<LLMProviderConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Obtiene la configuración completa
   */
  getConfig(): LLMProviderConfig {
    return { ...this.config };
  }

  /**
   * Resetea la configuración a los valores por defecto
   */
  resetToDefault(): void {
    this.config = { ...defaultConfig };
  }
}

// Singleton instance
let instance: LLMConfig | null = null;

export const getLLMConfig = (): LLMConfig => {
  if (!instance) {
    instance = new LLMConfig();
  }
  return instance;
};

/**
 * Helper para cargar configuración desde variables de entorno
 * Formato: 
 *   - LLM_PROVIDER_[OPERATION]=[PROVIDER]
 *   - LLM_MODEL_[OPERATION]=[MODEL]
 * Ejemplo: 
 *   - LLM_PROVIDER_FILTER_BY_RELEVANCE=openai
 *   - LLM_MODEL_FILTER_BY_RELEVANCE=gpt-4o
 */
export const loadConfigFromEnv = (): Partial<LLMProviderConfig> => {
  const envConfig: Partial<LLMProviderConfig> = {};

  // Mapear variables de entorno a operaciones
  const operations: LLMOperation[] = [
    LLMOperation.FILTER_BY_RELEVANCE,
    LLMOperation.SORT_BY_SIMILARITY,
    LLMOperation.APPLY_NATURAL_LANGUAGE_FILTER,
    LLMOperation.ENRICH_PRODUCT
  ];

  for (const operation of operations) {
    const operationKey = operation.toUpperCase();
    const providerEnvVar = `LLM_PROVIDER_${operationKey}`;
    const modelEnvVar = `LLM_MODEL_${operationKey}`;
    
    const provider = process.env[providerEnvVar];
    const model = process.env[modelEnvVar];
    
    // Si hay provider o modelo, crear/actualizar configuración
    if (provider || model) {
      const config = getLLMConfig();
      const currentConfig = config.getOperationConfig(operation);
      
      envConfig[operation] = {
        provider: (provider && Object.values(LLMProvider).includes(provider as LLMProvider))
          ? provider as LLMProvider
          : currentConfig.provider,
        model: model || currentConfig.model
      };
    }
  }

  return envConfig;
};
