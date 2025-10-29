import { ILLMProvider, LLMProvider, LLMOperation } from '../types/llm.types';
import { getLLMConfig } from '../config/llm-config';
import { getOpenAIProvider } from './openai.provider';
import { getGeminiProvider } from './gemini.provider';

/**
 * Factory para crear y obtener instancias de LLM Providers
 */
export class LLMProviderFactory {
  private providers: Map<LLMProvider, ILLMProvider>;

  constructor() {
    this.providers = new Map();
  }

  /**
   * Obtiene una instancia del provider especificado
   */
  private getProviderInstance(provider: LLMProvider): ILLMProvider {
    // Usar caché si ya existe
    if (this.providers.has(provider)) {
      return this.providers.get(provider)!;
    }

    // Crear nueva instancia según el tipo
    let instance: ILLMProvider;
    
    switch (provider) {
      case LLMProvider.OPENAI:
        instance = getOpenAIProvider();
        break;
      case LLMProvider.GEMINI:
        instance = getGeminiProvider();
        break;
      default:
        throw new Error(`Provider no soportado: ${provider}`);
    }

    // Guardar en caché
    this.providers.set(provider, instance);
    return instance;
  }

  /**
   * Obtiene el provider configurado para una operación específica
   */
  getProviderForOperation(operation: LLMOperation): ILLMProvider {
    const config = getLLMConfig();
    const operationConfig = config.getOperationConfig(operation);
    return this.getProviderInstance(operationConfig.provider);
  }

  /**
   * Obtiene el modelo configurado para una operación específica
   */
  getModelForOperation(operation: LLMOperation): string {
    const config = getLLMConfig();
    return config.getModel(operation);
  }

  /**
   * Obtiene la configuración completa para una operación específica
   */
  getConfigForOperation(operation: LLMOperation) {
    const config = getLLMConfig();
    return config.getOperationConfig(operation);
  }

  /**
   * Obtiene un provider específico directamente
   */
  getProvider(provider: LLMProvider): ILLMProvider {
    return this.getProviderInstance(provider);
  }

  /**
   * Limpia el caché de providers (útil para testing)
   */
  clearCache(): void {
    this.providers.clear();
  }
}

// Singleton instance
let instance: LLMProviderFactory | null = null;

export const getLLMProviderFactory = (): LLMProviderFactory => {
  if (!instance) {
    instance = new LLMProviderFactory();
  }
  return instance;
};
