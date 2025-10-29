import OpenAI from 'openai';
import { SimpleProduct } from '../types/product.types';

export interface FilterResult {
  products: SimpleProduct[];
  summary: string;
  totalFiltered: number;
  originalCount: number;
}

export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY no está definida en las variables de entorno');
    }
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Filtra y rankea productos por relevancia usando GPT-4
   * Retorna los N productos más relevantes según la query del usuario
   */
  async filterProductsByRelevance(
    products: SimpleProduct[],
    query: string,
    topN: number = 10,
    customFilter?: string
  ): Promise<FilterResult> {
    console.log(`🤖 Filtrando ${products.length} productos con gpt-4o-mini...`);
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

Retorna JSON: {"selected_indices": [números], "reasoning": "razón corta"}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Selecciona productos relevantes según la búsqueda. Sé rápido y preciso.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const responseText = completion.choices[0]?.message?.content;
      
      if (!responseText) {
        throw new Error('No se recibió respuesta de GPT-4');
      }

      const result = JSON.parse(responseText);
      const selectedIndices: number[] = result.selected_indices || [];

      // Obtener los productos seleccionados del array analizado (ajustar índices base-1 a base-0)
      const filteredProducts = selectedIndices
        .map(idx => productsToAnalyze[idx - 1])
        .filter(p => p !== undefined)
        .slice(0, topN) // Asegurar que no exceda topN
        .sort((a, b) => a.price - b.price); // Ordenar por precio (menor a mayor)

      console.log(`✅ gpt-4o-mini seleccionó ${filteredProducts.length} productos más relevantes`);
      console.log(`  💡 ${result.reasoning}`);
      console.log(`  💰 Ordenados por precio: ₡${filteredProducts[0]?.price.toLocaleString()} - ₡${filteredProducts[filteredProducts.length - 1]?.price.toLocaleString()}`);

      return {
        products: filteredProducts,
        summary: result.reasoning || `Seleccionados ${filteredProducts.length} productos más relevantes`,
        totalFiltered: filteredProducts.length,
        originalCount: products.length
      };
    } catch (error) {
      console.error('❌ Error filtrando con GPT-4:', error);
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
   * Ordena productos de múltiples tiendas por similaridad de título
   * Agrupa productos similares de diferentes tiendas juntos
   */
  async sortProductsBySimilarity(
    storeProducts: Array<{ store: string; products: SimpleProduct[] }>,
    query: string
  ): Promise<Array<{ store: string; products: SimpleProduct[] }>> {
    console.log(`🤖 Ordenando productos por similaridad entre tiendas...`);

    try {
      // Crear lista de todos los productos con su tienda
      const allProducts = storeProducts.flatMap(sp => 
        sp.products.map(p => ({ ...p, storeName: sp.store }))
      );

      if (allProducts.length === 0) {
        console.log(`  ⚠️  Sin productos para ordenar`);
        return storeProducts;
      }

      // Limitar a 50 productos máximo para el LLM (para evitar timeouts)
      const productsToSort = allProducts.slice(0, 50);
      console.log(`  📊 Ordenando ${productsToSort.length} productos con gpt-4o-mini...`);

      const productsList = productsToSort.map((p, i) => 
        `${i + 1}. [${p.storeName}] ${p.product_name} - ₡${p.price.toLocaleString()}`
      ).join('\n');

      const prompt = `Agrupa y ordena estos productos de diferentes tiendas por SIMILARIDAD de título.

Búsqueda: "${query}"

Productos:
${productsList}

OBJETIVO: Agrupar productos similares (ej: "taladro dewalt 3/8" de diferentes tiendas deben estar juntos).

Retorna JSON con índices ordenados por similaridad:
{
  "ordered_indices": [array de números del 1 al ${productsToSort.length}],
  "reasoning": "criterio de agrupación usado"
}`;

      const completion = await Promise.race([
        this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Agrupa productos similares de diferentes tiendas. Sé eficiente.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout ordenando productos')), 30000)
        )
      ]);

      console.log(`  ✅ Respuesta recibida de OpenAI`);
      
      const responseText = completion.choices[0]?.message?.content;
      
      if (!responseText) {
        console.warn('⚠️  No se pudo ordenar, manteniendo orden original');
        return storeProducts;
      }

      const result = JSON.parse(responseText);
      const orderedIndices: number[] = result.ordered_indices || [];
      
      console.log(`  🔄 Reordenando ${orderedIndices.length} productos...`);

      // Reordenar productos según índices
      const sortedProducts = orderedIndices
        .map(idx => productsToSort[idx - 1])
        .filter(p => p !== undefined);

      console.log(`✅ Productos ordenados por similaridad`);
      console.log(`  💡 ${result.reasoning}`);

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
      if (error instanceof Error && error.message.includes('Timeout')) {
        console.warn('⏱️  Timeout ordenando productos (>30s), usando orden original');
      } else {
        console.error('❌ Error ordenando productos:', error instanceof Error ? error.message : error);
      }
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
