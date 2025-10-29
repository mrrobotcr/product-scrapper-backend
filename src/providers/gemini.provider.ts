import { GoogleGenAI } from '@google/genai';
import {
  ILLMProvider,
  LLMProvider,
  FilterResult,
  FilterByRelevanceOptions,
  SortBySimilarityOptions,
  ApplyNaturalLanguageFilterOptions,
  EnrichProductOptions,
  ProductEnrichmentResult,
  ProductDetails
} from '../types/llm.types';
import { SimpleProduct } from '../types/product.types';

/**
 * Provider de Gemini que implementa la interfaz ILLMProvider
 */
export class GeminiProvider implements ILLMProvider {
  readonly name = LLMProvider.GEMINI;
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY no está definida en las variables de entorno');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Detecta si el modelo soporta thinking
   */
  private isThinkingModel(model: string): boolean {
    return model.includes('thinking') || model.includes('exp-');
  }

  /**
   * Obtiene la configuración apropiada según el modelo y configuración
   */
  private getModelConfig(model: string, desiredTemp: number, configSupportsThinking?: boolean, configTemp?: number): any {
    const config: any = {};
    
    // Si se especificó temperatura en la configuración, usarla
    if (configTemp !== undefined) {
      config.temperature = configTemp;
      config.responseMimeType = 'application/json';
      return config;
    }
    
    // Si se especificó explícitamente que soporta thinking, no usar parámetros
    if (configSupportsThinking === true) {
      return config;
    }
    
    // Si se especificó explícitamente que NO soporta thinking, usar parámetros
    if (configSupportsThinking === false) {
      config.temperature = desiredTemp;
      config.responseMimeType = 'application/json';
      return config;
    }
    
    // Detección automática: modelos con thinking no usan parámetros adicionales
    if (!this.isThinkingModel(model)) {
      config.temperature = desiredTemp;
      config.responseMimeType = 'application/json';
    }
    
    return config;
  }

  /**
   * Filtra y rankea productos por relevancia usando Gemini
   */
  async filterProductsByRelevance(options: FilterByRelevanceOptions): Promise<FilterResult> {
    const { products, query, topN = 15, customFilter, model = 'gemini-2.5-flash', supportsThinking, temperature: configTemp } = options;
    
    console.log(`🤖 [Gemini] Filtrando ${products.length} productos...`);
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

Retorna SOLO JSON válido sin markdown:
{"selected_indices": [números del 1 al ${productsToAnalyze.length}], "reasoning": "razón corta"}`;

      const result = await this.ai.models.generateContent({
        model,
        contents: [{ text: prompt }],
        config: this.getModelConfig(model, 0.3, supportsThinking, configTemp)
      });

      const responseText = result.text;
      
      if (!responseText) {
        throw new Error('No se recibió respuesta de Gemini');
      }

      const cleanedResponse = this.cleanJsonResponse(responseText);
      const parsedResult = JSON.parse(cleanedResponse);
      const selectedIndices: number[] = parsedResult.selected_indices || [];

      const filteredProducts = selectedIndices
        .map(idx => productsToAnalyze[idx - 1])
        .filter(p => p !== undefined)
        .slice(0, topN)
        .sort((a, b) => a.price - b.price);

      console.log(`✅ [Gemini] Seleccionó ${filteredProducts.length} productos`);
      console.log(`  💡 ${parsedResult.reasoning}`);

      return {
        products: filteredProducts,
        summary: parsedResult.reasoning || `Seleccionados ${filteredProducts.length} productos más relevantes`,
        totalFiltered: filteredProducts.length,
        originalCount: products.length
      };
    } catch (error) {
      console.error('❌ [Gemini] Error filtrando:', error);
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
    const { storeProducts, query, model = 'gemini-2.5-flash-lite', supportsThinking, temperature: configTemp } = options;
    
    console.log(`🤖 [Gemini] Ordenando productos por similaridad...`);
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

Retorna SOLO JSON válido sin markdown:
{
  "ordered_indices": [array de números del 1 al ${productsToSort.length}],
  "reasoning": "criterio de agrupación usado"
}`;

      const result = await this.ai.models.generateContent({
        model,
        contents: [{ text: prompt }],
        config: this.getModelConfig(model, 0.2, supportsThinking, configTemp)
      });

      const responseText = result.text;
      
      if (!responseText) {
        console.warn('⚠️  No se pudo ordenar, manteniendo orden original');
        return storeProducts;
      }

      const cleanedResponse = this.cleanJsonResponse(responseText);
      const parsedResult = JSON.parse(cleanedResponse);
      const orderedIndices: number[] = parsedResult.ordered_indices || [];

      const sortedProducts = orderedIndices
        .map(idx => productsToSort[idx - 1])
        .filter(p => p !== undefined);

      console.log(`✅ [Gemini] Productos ordenados por similaridad`);
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
      console.error('❌ [Gemini] Error ordenando:', error instanceof Error ? error.message : error);
      return storeProducts;
    }
  }

  /**
   * Aplica filtros inteligentes con lenguaje natural
   */
  async applyNaturalLanguageFilter(options: ApplyNaturalLanguageFilterOptions): Promise<FilterResult> {
    const { products, query, topN = 10, customFilter, model = 'gemini-2.5-flash', supportsThinking, temperature: configTemp } = options;
    
    console.log(`🤖 [Gemini] Aplicando filtro: "${query}"`);
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

Responde SOLO con JSON válido (sin markdown):
{
  "selected_indices": [array de números del 1 al ${productsToAnalyze.length}],
  "reasoning": "qué productos excluiste y por qué"
}`;

      const result = await this.ai.models.generateContent({
        model,
        contents: [{ text: prompt }],
        config: this.getModelConfig(model, 0.2, supportsThinking, configTemp)
      });

      const responseText = result.text;
      
      // Mostrar reasoning si está disponible (modelos con thinking)
      if (this.isThinkingModel(model)) {
        try {
          const fullResponse = JSON.stringify(result);
          if (fullResponse.includes('thought') || fullResponse.includes('thinking')) {
            console.log(`  🧠 Modelo con thinking activado`);
          }
        } catch (e) {
          // Ignorar error al inspeccionar thinking
        }
      }
      
      if (!responseText) {
        throw new Error('No se recibió respuesta de Gemini');
      }

      const cleanedResponse = this.cleanJsonResponse(responseText);
      const parsedResult = JSON.parse(cleanedResponse);
      const selectedIndices: number[] = parsedResult.selected_indices || [];

      const filteredProducts = selectedIndices
        .map(idx => productsToAnalyze[idx - 1])
        .filter(p => p !== undefined);

      console.log(`✅ [Gemini] filtró: ${filteredProducts.length} productos`);
      console.log(`  💡 ${parsedResult.reasoning}`);

      return {
        products: filteredProducts,
        summary: parsedResult.reasoning || `Filtrados ${filteredProducts.length} productos`,
        totalFiltered: filteredProducts.length,
        originalCount: products.length
      };
    } catch (error) {
      console.error('❌ [Gemini] Error aplicando filtro:', error);
      return {
        products,
        summary: 'Error aplicando filtro, mostrando todos',
        totalFiltered: products.length,
        originalCount: products.length
      };
    }
  }

  /**
   * Enriquece información de un producto usando imagen y título
   */
  async enrichProduct(options: EnrichProductOptions): Promise<ProductEnrichmentResult> {
    const { productName, imageUrl, model = 'gemini-2.5-flash-lite' } = options;
    
    if (!imageUrl) {
      return {
        success: false,
        error: 'No se proporcionó URL de imagen'
      };
    }

    console.log(`🤖 [Gemini] Enriqueciendo: "${productName}"`);
    console.log(`  📸 Imagen: ${imageUrl}`);
    console.log(`  🤖 Modelo: ${model}`);

    try {
      const groundingTool = {
        googleSearch: {}
      };

      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        throw new Error(`Error descargando imagen: ${response.status} ${response.statusText}`);
      }

      const imageArrayBuffer = await response.arrayBuffer();
      const base64ImageData = Buffer.from(imageArrayBuffer).toString('base64');

      const prompt = `Analiza esta imagen y el título del producto: "${productName}".

Proporciona la siguiente información en formato JSON:

1. **description**: Una descripción detallada del producto (2-3 párrafos)
2. **specifications**: Un objeto con especificaciones técnicas clave
3. **technicalInfo**: Información técnica adicional (opcional)

IMPORTANTE: 
- Si no puedes determinar alguna especificación, NO la incluyas
- Sé preciso y basate en la imagen y el título
- Formato de respuesta DEBE ser JSON válido sin markdown

Formato:
{
  "description": "descripción detallada",
  "specifications": {"voltaje": "18V", ...},
  "technicalInfo": "info adicional"
}`;

      const result = await this.ai.models.generateContent({
        model,
        contents: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64ImageData
            }
          },
          {
            text: prompt
          }
        ],
        config: {
          tools: [groundingTool],
          temperature: 0.3
        }
      });

      const responseText = result.text;
      
      if (!responseText || responseText.trim().length === 0) {
        console.warn(`  ⚠️  Sin respuesta, usando descripción básica`);
        return {
          success: true,
          details: {
            description: `${productName} - Información básica del producto`,
            specifications: {
              'Nombre': productName,
              'Fuente': 'Imagen del producto'
            }
          }
        };
      }

      const cleanedResponse = this.cleanJsonResponse(responseText);

      let details: ProductDetails;
      try {
        details = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.warn(`  ⚠️  Error parseando JSON, usando descripción básica`);
        return {
          success: true,
          details: {
            description: `${productName} - ${cleanedResponse.substring(0, 200)}`,
            specifications: {
              'Nombre': productName
            }
          }
        };
      }

      console.log(`✅ [Gemini] Detalles obtenidos`);
      console.log(`  📝 ${details.description.substring(0, 100)}...`);
      console.log(`  🔧 ${Object.keys(details.specifications).length} especificaciones`);

      return {
        success: true,
        details
      };

    } catch (error) {
      console.error('❌ [Gemini] Error enriqueciendo:', error);
      
      return {
        success: true,
        details: {
          description: `${productName} - Producto de ferretería`,
          specifications: {
            'Nombre': productName,
            'Estado': 'Información limitada disponible'
          }
        },
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
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
}

// Singleton instance
let instance: GeminiProvider | null = null;

export const getGeminiProvider = (): GeminiProvider => {
  if (!instance) {
    instance = new GeminiProvider();
  }
  return instance;
};
