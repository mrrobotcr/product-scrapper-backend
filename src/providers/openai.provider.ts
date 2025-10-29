import OpenAI from 'openai';
import {
  ILLMProvider,
  LLMProvider,
  FilterResult,
  FilterByRelevanceOptions,
  SortBySimilarityOptions,
  ApplyNaturalLanguageFilterOptions
} from '../types/llm.types';
import { SimpleProduct } from '../types/product.types';

/**
 * Provider de OpenAI que implementa la interfaz ILLMProvider
 */
export class OpenAIProvider implements ILLMProvider {
  readonly name = LLMProvider.OPENAI;
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY no está definida en las variables de entorno');
    }
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Detecta si el modelo es GPT-5 o superior
   */
  private isGPT5OrHigher(model: string): boolean {
    return model.startsWith('gpt-5') || model.startsWith('gpt-6') || model.startsWith('gpt-7');
  }

  /**
   * Detecta si el modelo soporta thinking (o1, o3 series)
   */
  private isThinkingModel(model: string): boolean {
    return model.startsWith('o1') || model.startsWith('o3');
  }

  /**
   * Obtiene la temperatura apropiada según el modelo y configuración
   */
  private getTemperature(model: string, desiredTemp: number, configSupportsThinking?: boolean, configTemp?: number): number | undefined {
    // Si se especificó temperatura en la configuración, usarla
    if (configTemp !== undefined) {
      return configTemp;
    }
    
    // Si se especificó explícitamente que soporta thinking, no usar temperature
    if (configSupportsThinking === true) {
      return undefined;
    }
    
    // Si se especificó explícitamente que NO soporta thinking, usar temperatura deseada
    if (configSupportsThinking === false) {
      return desiredTemp;
    }
    
    // Detección automática basada en el nombre del modelo
    if (this.isThinkingModel(model)) {
      return undefined;
    }
    return this.isGPT5OrHigher(model) ? 1 : desiredTemp;
  }

  /**
   * Obtiene el response_format apropiado según el modelo y configuración
   */
  private getResponseFormat(model: string, configSupportsThinking?: boolean): { type: 'json_object' } | undefined {
    // Si se especificó explícitamente que soporta thinking, no usar response_format
    if (configSupportsThinking === true) {
      return undefined;
    }
    
    // Si se especificó explícitamente que NO soporta thinking, usar response_format
    if (configSupportsThinking === false) {
      return { type: 'json_object' };
    }
    
    // Detección automática basada en el nombre del modelo
    return this.isThinkingModel(model) ? undefined : { type: 'json_object' };
  }

  /**
   * Limpia la respuesta JSON eliminando markdown si existe
   */
  private cleanJsonResponse(response: string): string {
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return cleaned;
  }

  /**
   * Filtra y rankea productos por relevancia usando OpenAI
   */
  async filterProductsByRelevance(options: FilterByRelevanceOptions): Promise<FilterResult> {
    const { products, query, topN = 15, customFilter, model = 'gpt-4o-mini', supportsThinking, temperature: configTemp } = options;
    
    console.log(`🤖 [OpenAI] Filtrando ${products.length} productos...`);
    console.log(`  🔍 Query: "${query}"`);
    console.log(`  🎯 Top: ${topN} productos`);
    console.log(`  🤖 Modelo: ${model}`);

    try {
      // Optimización: Si hay muchos productos, hacer pre-filtrado simple
      let productsToAnalyze = products;
      if (products.length > 50) {
        console.log(`  ⚡ Pre-filtrado: ${products.length} → 50 productos`);
        const searchWords = query.toLowerCase().split(' ');
        productsToAnalyze = products.filter(p => 
          searchWords.some((word: string) => p.product_name.toLowerCase().includes(word))
        ).slice(0, 50);
        
        if (productsToAnalyze.length === 0) {
          productsToAnalyze = products.slice(0, 50);
        }
      }

      const productsList = productsToAnalyze
        .map((p, i) => `${i + 1}. ${p.product_name.slice(0, 80)} - ₡${p.price.toLocaleString()}`)
        .join('\n');

      const prompt = `Búsqueda: "${query}". 

❌ EXCLUIR: Accesorios, repuestos, consumibles (brocas, baterías solas, cables)
✅ INCLUIR: Solo el producto principal en diferentes modelos/marcas
${customFilter ? `\n⚠️ FILTRO ADICIONAL: ${customFilter}\n` : ''}

Selecciona los ${topN} MÁS relevantes:

${productsList}

Retorna SOLO JSON válido:
{"selected_indices": [números del 1 al ${productsToAnalyze.length}], "reasoning": "razón corta"}`;

      const requestParams: any = {
        model,
        messages: [
          {
            role: 'system',
            content: 'Filtra productos según criterios de relevancia. Sé preciso y rápido.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      };

      const temperature = this.getTemperature(model, 0.3, supportsThinking, configTemp);
      const responseFormat = this.getResponseFormat(model, supportsThinking);
      
      if (temperature !== undefined) requestParams.temperature = temperature;
      if (responseFormat) requestParams.response_format = responseFormat;

      const completion = await this.openai.chat.completions.create(requestParams);

      const choice = completion.choices[0];
      const responseText = choice?.message?.content;
      
      if (!responseText) {
        throw new Error('No se recibió respuesta de OpenAI');
      }

      // Mostrar reasoning si está disponible (modelos con thinking)
      if (this.isThinkingModel(model) && choice?.message && 'reasoning' in choice.message) {
        console.log(`  🧠 Reasoning tokens: ${(choice.message as any).reasoning?.length || 'N/A'}`);
      }

      const cleanedResponse = this.cleanJsonResponse(responseText);
      const parsedResult = JSON.parse(cleanedResponse);
      const selectedIndices: number[] = parsedResult.selected_indices || [];

      const filteredProducts = selectedIndices
        .map(idx => productsToAnalyze[idx - 1])
        .filter(p => p !== undefined)
        .slice(0, topN)
        .sort((a, b) => a.price - b.price);

      console.log(`✅ [OpenAI] Seleccionó ${filteredProducts.length} productos`);
      console.log(`  💡 ${parsedResult.reasoning}`);

      return {
        products: filteredProducts,
        summary: parsedResult.reasoning || `Seleccionados ${filteredProducts.length} productos más relevantes`,
        totalFiltered: filteredProducts.length,
        originalCount: products.length
      };
    } catch (error) {
      console.error('❌ [OpenAI] Error filtrando:', error);
      return {
        products: products.slice(0, topN),
        summary: 'Error en filtrado, mostrando primeros productos',
        totalFiltered: Math.min(topN, products.length),
        originalCount: products.length
      };
    }
  }

  /**
   * Ordena productos de múltiples tiendas por similaridad
   */
  async sortProductsBySimilarity(options: SortBySimilarityOptions): Promise<Array<{ store: string; products: SimpleProduct[] }>> {
    const { storeProducts, query, model = 'gpt-4o-mini', supportsThinking, temperature: configTemp } = options;
    
    console.log(`🤖 [OpenAI] Ordenando productos por similaridad...`);
    console.log(`  🤖 Modelo: ${model}`);

    try {
      const allProducts = storeProducts.flatMap(sp => 
        sp.products.map(p => ({ ...p, storeName: sp.store }))
      );

      if (allProducts.length === 0) {
        console.log(`  ⚠️  Sin productos para ordenar`);
        return storeProducts;
      }

      const productsToSort = allProducts.slice(0, 50);
      console.log(`  📊 Ordenando ${productsToSort.length} productos...`);

      const productsList = productsToSort.map((p, i) => 
        `${i + 1}. [${p.storeName}] ${p.product_name} - ₡${p.price.toLocaleString()}`
      ).join('\n');

      const prompt = `Agrupa y ordena estos productos de diferentes tiendas por SIMILARIDAD de título.

Búsqueda: "${query}"

Productos:
${productsList}

OBJETIVO: Agrupar productos similares (ej: "taladro dewalt 3/8" de diferentes tiendas deben estar juntos).

Retorna SOLO JSON válido:
{
  "ordered_indices": [array de números del 1 al ${productsToSort.length}],
  "reasoning": "criterio de agrupación usado"
}`;

      const requestParams: any = {
        model,
        messages: [
          {
            role: 'system',
            content: 'Ordena productos por similaridad. Agrupa productos similares juntos.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      };

      const temperature = this.getTemperature(model, 0.2, supportsThinking, configTemp);
      const responseFormat = this.getResponseFormat(model, supportsThinking);
      
      if (temperature !== undefined) requestParams.temperature = temperature;
      if (responseFormat) requestParams.response_format = responseFormat;

      const completion = await this.openai.chat.completions.create(requestParams);

      const choice = completion.choices[0];
      const responseText = choice?.message?.content;
      
      if (!responseText) {
        console.warn('⚠️  No se pudo ordenar, manteniendo orden original');
        return storeProducts;
      }

      // Mostrar reasoning si está disponible (modelos con thinking)
      if (this.isThinkingModel(model) && choice?.message && 'reasoning' in choice.message) {
        console.log(`  🧠 Reasoning tokens: ${(choice.message as any).reasoning?.length || 'N/A'}`);
      }

      const cleanedResponse = this.cleanJsonResponse(responseText);
      const parsedResult = JSON.parse(cleanedResponse);
      const orderedIndices: number[] = parsedResult.ordered_indices || [];

      const sortedProducts = orderedIndices
        .map(idx => productsToSort[idx - 1])
        .filter(p => p !== undefined);

      console.log(`✅ [OpenAI] Productos ordenados por similaridad`);
      console.log(`  💡 ${parsedResult.reasoning}`);

      const result_by_store: Array<{ store: string; products: SimpleProduct[] }> = [];
      
      for (const sp of storeProducts) {
        const storeOrderedProducts = sortedProducts
          .filter(p => p.storeName === sp.store)
          .map(({ storeName, ...product }) => product as SimpleProduct);
        
        result_by_store.push({
          store: sp.store,
          products: storeOrderedProducts.length > 0 ? storeOrderedProducts : sp.products
        });
      }

      return result_by_store;

    } catch (error) {
      console.error('❌ [OpenAI] Error ordenando:', error instanceof Error ? error.message : error);
      return storeProducts;
    }
  }

  /**
   * Aplica filtros inteligentes con lenguaje natural
   */
  async applyNaturalLanguageFilter(options: ApplyNaturalLanguageFilterOptions): Promise<FilterResult> {
    const { products, query, topN = 10, customFilter, model = 'gpt-4o-mini', supportsThinking, temperature: configTemp } = options;
    
    console.log(`🤖 [OpenAI] Aplicando filtro: "${query}"`);
    console.log(`  🤖 Modelo: ${model}`);

    try {
      const productsToAnalyze = products.slice(0, 50);
      
      const prompt = `Eres un experto en e-commerce. Tu tarea es FILTRAR productos por RELEVANCIA ESTRICTA para la búsqueda: "${query}".

🎯 OBJETIVO: Selecciona solo los ${topN} productos MÁS RELEVANTES que coincidan DIRECTAMENTE con "${query}".

${customFilter ? `\n⚠️ FILTRO ADICIONAL: ${customFilter}\n` : ''}

❌ EXCLUIR PRODUCTOS QUE SON:
- Accesorios del producto buscado (ej: si buscan "taladro", NO incluir "brocas para taladro")
- Repuestos o consumibles (ej: baterías solas, cables, etc.)
- Productos relacionados pero NO el producto principal

✅ INCLUIR SOLO:
- El producto exacto que busca el usuario
- Variantes del mismo producto (diferentes modelos, tamaños, potencias)
- Diferentes marcas del MISMO tipo de producto

PRODUCTOS:
${productsToAnalyze.map((p, idx) => 
  `${idx + 1}. "${p.product_name}" - ₡${p.price.toLocaleString()}`
).join('\n')}

Responde SOLO con JSON válido:
{
  "selected_indices": [array de números del 1 al ${productsToAnalyze.length}],
  "reasoning": "qué productos excluiste y por qué"
}`;

      const requestParams: any = {
        model,
        messages: [
          {
            role: 'system',
            content: 'Filtra productos según criterios. Sé rápido y preciso.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      };

      const temperature = this.getTemperature(model, 0.2, supportsThinking, configTemp);
      const responseFormat = this.getResponseFormat(model, supportsThinking);
      
      if (temperature !== undefined) requestParams.temperature = temperature;
      if (responseFormat) requestParams.response_format = responseFormat;

      const completion = await this.openai.chat.completions.create(requestParams);

      const choice = completion.choices[0];
      const responseText = choice?.message?.content;
      
      if (!responseText) {
        throw new Error('No se recibió respuesta de OpenAI');
      }

      // Mostrar reasoning si está disponible (modelos con thinking)
      if (this.isThinkingModel(model) && choice?.message && 'reasoning' in choice.message) {
        console.log(`  🧠 Reasoning tokens: ${(choice.message as any).reasoning?.length || 'N/A'}`);
      }

      const cleanedResponse = this.cleanJsonResponse(responseText);
      const parsedResult = JSON.parse(cleanedResponse);
      const selectedIndices: number[] = parsedResult.selected_indices || [];

      const filteredProducts = selectedIndices
        .map(idx => productsToAnalyze[idx - 1])
        .filter(p => p !== undefined);

      console.log(`✅ [OpenAI] filtró: ${filteredProducts.length} productos`);
      console.log(`  💡 ${parsedResult.reasoning}`);

      return {
        products: filteredProducts,
        summary: parsedResult.reasoning || `Filtrados ${filteredProducts.length} productos`,
        totalFiltered: filteredProducts.length,
        originalCount: products.length
      };
    } catch (error) {
      console.error('❌ [OpenAI] Error aplicando filtro:', error);
      return {
        products,
        summary: 'Error aplicando filtro, mostrando todos',
        totalFiltered: products.length,
        originalCount: products.length
      };
    }
  }
}

// Singleton instance
let instance: OpenAIProvider | null = null;

export const getOpenAIProvider = (): OpenAIProvider => {
  if (!instance) {
    instance = new OpenAIProvider();
  }
  return instance;
};
