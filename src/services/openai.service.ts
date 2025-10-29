import OpenAI from 'openai';
import { SimpleProduct } from '../types/product.types';
import { getGeminiService } from './gemini.service';

export interface FilterResult {
  products: SimpleProduct[];
  summary: string;
  totalFiltered: number;
  originalCount: number;
}

export class OpenAIService {
  private openai: OpenAI;
  private gemini = getGeminiService();

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY no está definida en las variables de entorno');
    }
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Filtra y rankea productos por relevancia usando Gemini Flash Lite
   * Retorna los N productos más relevantes según la query del usuario
   */
  async filterProductsByRelevance(
    products: SimpleProduct[],
    query: string,
    topN: number = 15,
    customFilter?: string
  ): Promise<FilterResult> {
    console.log(`🤖 Filtrando ${products.length} productos con Gemini...`);
    console.log(`  🔍 Query: "${query}"`);
    console.log(`  🎯 Top: ${topN} productos`);

    try {
      // Optimización: Si hay muchos productos, hacer pre-filtrado simple
      let productsToAnalyze = products;
      if (products.length > 50) {
        console.log(`  ⚡ Pre-filtrado: ${products.length} → 50 productos`);
        // Pre-filtro simple: que el nombre contenga al menos una palabra de la búsqueda
        const searchWords = query.toLowerCase().split(' ');
        productsToAnalyze = products.filter(p => 
          searchWords.some((word: string) => p.product_name.toLowerCase().includes(word))
        ).slice(0, 50);
        
        // Si el pre-filtro es muy agresivo, tomar los primeros 50
        if (productsToAnalyze.length === 0) {
          productsToAnalyze = products.slice(0, 50);
        }
      }

      // Prompt mejorado para filtrar solo productos relevantes (NO accesorios)
      const productsList = productsToAnalyze
        .map((p, i) => `${i + 1}. ${p.product_name.slice(0, 80)} - ₡${p.price.toLocaleString()}`)
        .join('\n');

      const prompt = `Búsqueda: "${query}". 

❌ EXCLUIR: Accesorios, repuestos, consumibles (brocas, baterías solas, cables)
✅ INCLUIR: Solo el producto principal en diferentes modelos/marcas

Selecciona los ${topN} MÁS relevantes:

${productsList}

Retorna SOLO JSON válido sin markdown:
{"selected_indices": [números del 1 al ${productsToAnalyze.length}], "reasoning": "razón corta"}`;

      // Usar Gemini 2.5 Flash (más rápido que GPT-4o-mini)
      const result = await this.gemini['ai'].models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ text: prompt }],
        config: {
          temperature: 0.3,
          responseMimeType: 'application/json'
        }
      });

      const responseText = result.text;
      
      if (!responseText) {
        throw new Error('No se recibió respuesta de Gemini');
      }

      // Limpiar markdown si existe
      let cleanedResponse = responseText.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsedResult = JSON.parse(cleanedResponse);
      const selectedIndices: number[] = parsedResult.selected_indices || [];

      // Obtener los productos seleccionados del array analizado (ajustar índices base-1 a base-0)
      const filteredProducts = selectedIndices
        .map(idx => productsToAnalyze[idx - 1])
        .filter(p => p !== undefined)
        .slice(0, topN) // Asegurar que no exceda topN
        .sort((a, b) => a.price - b.price); // Ordenar por precio (menor a mayor)

      console.log(`✅ Gemini seleccionó ${filteredProducts.length} productos más relevantes`);
      console.log(`  💡 ${parsedResult.reasoning}`);
      console.log(`  💰 Ordenados por precio: ₡${filteredProducts[0]?.price.toLocaleString()} - ₡${filteredProducts[filteredProducts.length - 1]?.price.toLocaleString()}`);

      return {
        products: filteredProducts,
        summary: parsedResult.reasoning || `Seleccionados ${filteredProducts.length} productos más relevantes`,
        totalFiltered: filteredProducts.length,
        originalCount: products.length
      };
    } catch (error) {
      console.error('❌ Error filtrando con Gemini:', error);
      // En caso de error, retornar los primeros N productos
      return {
        products: products.slice(0, topN),
        summary: 'Error en filtrado, mostrando primeros productos',
        totalFiltered: Math.min(topN, products.length),
        originalCount: products.length
      };
    }
  }

  /**
   * Aplica filtros inteligentes con lenguaje natural
   * Ejemplo: "productos de menos de 50000 colones", "solo taladros inalámbricos"
   */
  async applyNaturalLanguageFilter(
    products: SimpleProduct[],
    query: string,
    topN: number = 10,
    customFilter?: string
  ): Promise<FilterResult> {
    console.log(`🤖 Aplicando filtro con gpt-4o-mini: "${query}"`);

    try {
      // Optimización: Limitar a 50 productos para rapidez
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

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Filtra productos según criterios. Sé rápido.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });

      const responseText = completion.choices[0]?.message?.content;
      
      if (!responseText) {
        throw new Error('No se recibió respuesta de GPT-4');
      }

      const result = JSON.parse(responseText);
      const selectedIndices: number[] = result.selected_indices || [];

      const filteredProducts = selectedIndices
        .map(idx => productsToAnalyze[idx - 1])
        .filter(p => p !== undefined);

      console.log(`✅ gpt-4o-mini filtró: ${filteredProducts.length} productos cumplen`);
      console.log(`  💡 ${result.reasoning}`);

      return {
        products: filteredProducts,
        summary: result.reasoning || `Filtrados ${filteredProducts.length} productos`,
        totalFiltered: filteredProducts.length,
        originalCount: products.length
      };
    } catch (error) {
      console.error('❌ Error aplicando filtro:', error);
      return {
        products,
        summary: 'Error aplicando filtro, mostrando todos',
        totalFiltered: products.length,
        originalCount: products.length
      };
    }
  }

  /**
   * Ordena productos de múltiples tiendas por similaridad de título usando Gemini Flash Lite
   * Agrupa productos similares de diferentes tiendas juntos (mucho más rápido que GPT-4)
   */
  async sortProductsBySimilarity(
    storeProducts: Array<{ store: string; products: SimpleProduct[] }>,
    query: string
  ): Promise<Array<{ store: string; products: SimpleProduct[] }>> {
    console.log(`🤖 Ordenando productos por similaridad entre tiendas con Gemini Flash Lite...`);

    try {
      // Crear lista de todos los productos con su tienda
      const allProducts = storeProducts.flatMap(sp => 
        sp.products.map(p => ({ ...p, storeName: sp.store }))
      );

      if (allProducts.length === 0) {
        console.log(`  ⚠️  Sin productos para ordenar`);
        return storeProducts;
      }

      // Limitar a 50 productos máximo
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

      // Usar Gemini Flash Lite (mucho más rápido)
      const result = await this.gemini['ai'].models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [{ text: prompt }],
        config: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      });

      console.log(`  ✅ Respuesta recibida de Gemini`);
      
      const responseText = result.text;
      
      if (!responseText) {
        console.warn('⚠️  No se pudo ordenar, manteniendo orden original');
        return storeProducts;
      }

      // Limpiar markdown si existe
      let cleanedResponse = responseText.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsedResult = JSON.parse(cleanedResponse);
      const orderedIndices: number[] = parsedResult.ordered_indices || [];
      
      console.log(`  🔄 Reordenando ${orderedIndices.length} productos...`);

      // Reordenar productos según índices
      const sortedProducts = orderedIndices
        .map(idx => productsToSort[idx - 1])
        .filter(p => p !== undefined);

      console.log(`✅ Productos ordenados por similaridad`);
      console.log(`  💡 ${parsedResult.reasoning}`);

      // Reconstruir la estructura por tienda con el nuevo orden
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
      console.error('❌ Error ordenando productos con Gemini:', error instanceof Error ? error.message : error);
      return storeProducts; // Retornar orden original en caso de error
    }
  }
}

// Singleton instance
let instance: OpenAIService | null = null;

export const getOpenAIService = (): OpenAIService => {
  if (!instance) {
    instance = new OpenAIService();
  }
  return instance;
};
