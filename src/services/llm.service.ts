import { getLLMProviderFactory } from '../providers/llm-provider.factory';
import {
  LLMOperation,
  FilterResult,
  ProductEnrichmentResult
} from '../types/llm.types';
import { SimpleProduct } from '../types/product.types';

/**
 * Servicio unificado de LLM que usa el factory para seleccionar providers
 * Esta es la interfaz principal que deben usar otros servicios
 */
export class LLMService {
  private factory = getLLMProviderFactory();

  /**
   * Filtra y rankea productos por relevancia
   * Usa el provider y modelo configurado para FILTER_BY_RELEVANCE
   */
  async filterProductsByRelevance(
    products: SimpleProduct[],
    query: string,
    topN: number = 15,
    customFilter?: string
  ): Promise<FilterResult> {
    const provider = this.factory.getProviderForOperation(LLMOperation.FILTER_BY_RELEVANCE);
    const config = this.factory.getConfigForOperation(LLMOperation.FILTER_BY_RELEVANCE);
    
    return provider.filterProductsByRelevance({
      products,
      query,
      topN,
      customFilter,
      model: config.model,
      supportsThinking: config.supportsThinking,
      temperature: config.temperature
    });
  }

  /**
   * Ordena productos de múltiples tiendas por similaridad
   * Usa el provider y modelo configurado para SORT_BY_SIMILARITY
   */
  async sortProductsBySimilarity(
    storeProducts: Array<{ store: string; products: SimpleProduct[] }>,
    query: string
  ): Promise<Array<{ store: string; products: SimpleProduct[] }>> {
    const provider = this.factory.getProviderForOperation(LLMOperation.SORT_BY_SIMILARITY);
    const config = this.factory.getConfigForOperation(LLMOperation.SORT_BY_SIMILARITY);
    
    return provider.sortProductsBySimilarity({
      storeProducts,
      query,
      model: config.model,
      supportsThinking: config.supportsThinking,
      temperature: config.temperature
    });
  }

  /**
   * Aplica filtros inteligentes con lenguaje natural
   * Usa el provider y modelo configurado para APPLY_NATURAL_LANGUAGE_FILTER
   */
  async applyNaturalLanguageFilter(
    products: SimpleProduct[],
    query: string,
    topN: number = 10,
    customFilter?: string
  ): Promise<FilterResult> {
    const provider = this.factory.getProviderForOperation(LLMOperation.APPLY_NATURAL_LANGUAGE_FILTER);
    const config = this.factory.getConfigForOperation(LLMOperation.APPLY_NATURAL_LANGUAGE_FILTER);
    
    return provider.applyNaturalLanguageFilter({
      products,
      query,
      topN,
      customFilter,
      model: config.model,
      supportsThinking: config.supportsThinking,
      temperature: config.temperature
    });
  }

  /**
   * Enriquece información de un producto
   * Usa el provider y modelo configurado para ENRICH_PRODUCT
   */
  async enrichProduct(
    productName: string,
    imageUrl?: string
  ): Promise<ProductEnrichmentResult> {
    const provider = this.factory.getProviderForOperation(LLMOperation.ENRICH_PRODUCT);
    const model = this.factory.getModelForOperation(LLMOperation.ENRICH_PRODUCT);
    
    // Verificar si el provider soporta enriquecimiento
    if (!provider.enrichProduct) {
      return {
        success: false,
        error: `El provider ${provider.name} no soporta enriquecimiento de productos`
      };
    }

    return provider.enrichProduct({
      productName,
      imageUrl,
      model
    });
  }

  /**
   * Enriquece múltiples productos en batch
   */
  async enrichProductsBatch(
    products: Array<{ name: string; imageUrl?: string }>
  ): Promise<ProductEnrichmentResult[]> {
    console.log(`🤖 Enriqueciendo ${products.length} productos...`);
    
    const results: ProductEnrichmentResult[] = [];
    
    for (const product of products) {
      const result = await this.enrichProduct(product.name, product.imageUrl);
      results.push(result);
      
      // Pequeña pausa entre requests para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Enriquecidos ${successCount}/${products.length} productos`);
    
    return results;
  }
}

// Singleton instance
let instance: LLMService | null = null;

export const getLLMService = (): LLMService => {
  if (!instance) {
    instance = new LLMService();
  }
  return instance;
};
