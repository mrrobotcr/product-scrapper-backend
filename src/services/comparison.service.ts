import { PlaywrightService } from './playwright.service';
import { StoreConfigService } from './store-config.service';
import { getGeminiService } from './gemini.service';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';

export interface ProductToCompare {
  url: string;
  storeName: string;
  product_name: string;
  price: number;
  image?: string;  // Para tiendas sin detalle (ej: infesa.com)
}

export interface DetailedProduct {
  name: string;
  store: string;
  price: number;
  url: string;
  description?: string | string[];
  brand?: string;
  availability?: string;
  specifications?: Record<string, any>;
  images?: string[];
}

export interface ComparisonAnalysis {
  summary: string;
  recommendation: string;
  pros_cons: Array<{
    product: string;
    pros: string[];
    cons: string[];
  }>;
  price_analysis: {
    cheapest: string;
    best_value: string;
    price_range: string;
  };
  product_badges: Array<{
    product_index: number;  // 0-based index
    badge_label: string;
    badge_type: 'price' | 'value' | 'power' | 'professional' | 'home' | 'brand' | 'custom';
    badge_color: 'green' | 'blue' | 'orange' | 'purple' | 'teal' | 'yellow';
  }>;
  specifications_comparison?: Record<string, any>;
}

export interface ComparisonResult {
  products: DetailedProduct[];
  analysis: ComparisonAnalysis;
}

export class ComparisonService {
  private playwrightService: PlaywrightService;
  private openai: OpenAI | null = null;
  private storeConfigService: StoreConfigService;

  constructor() {
    this.playwrightService = new PlaywrightService();
    this.storeConfigService = new StoreConfigService();
  }

  /**
   * Inicializa OpenAI solo cuando se necesita (lazy initialization)
   */
  private getOpenAI(): OpenAI {
    if (!this.openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY no está definida en las variables de entorno');
      }
      this.openai = new OpenAI({ apiKey });
    }
    return this.openai;
  }

  /**
   * Compara múltiples productos
   */
  async compareProducts(products: ProductToCompare[]): Promise<ComparisonResult> {
    console.log(`🔍 Iniciando comparación de ${products.length} productos...`);

    // 1. Scrapear detalles de cada producto en paralelo
    const detailedProducts = await Promise.all(
      products.map(product => this.scrapeProductDetails(product))
    );

    console.log('✅ Detalles scrapeados, enviando a GPT...');

    // 2. Normalizar descripciones con GPT
    const normalizedProducts = await this.normalizeDescriptions(detailedProducts);

    // 3. Enviar a GPT para análisis comparativo
    const analysis = await this.analyzeWithGPT(normalizedProducts);

    return {
      products: normalizedProducts,
      analysis
    };
  }

  /**
   * Scrapea los detalles de un producto individual
   */
  private async scrapeProductDetails(product: ProductToCompare): Promise<DetailedProduct> {
    try {
      console.log(`📄 Scrapeando detalles de: ${product.product_name.substring(0, 40)}...`);

      // Obtener configuración de la tienda usando la URL
      const storeConfig = this.storeConfigService.getConfigFromUrl(product.url);

      // ESTRATEGIA ESPECIAL PARA INFESA.COM (sin páginas de detalle)
      // Detectar si es infesa.com por el dominio
      if (product.url.includes('infesa.com') && product.image) {
        console.log(`  🤖 Usando Gemini para enriquecer producto de infesa.com...`);
        
        try {
          const gemini = getGeminiService();
          const enrichResult = await gemini.getProductDetailsFromImage(
            product.image,
            product.product_name
          );

          if (enrichResult.success && enrichResult.details) {
            console.log(`  ✅ Producto enriquecido con Gemini`);
            
            // Convertir especificaciones de Gemini a formato compatible
            const specifications: Record<string, any> = enrichResult.details.specifications || {};
            
            return {
              name: product.product_name,
              store: product.storeName,
              price: product.price,
              url: product.url,
              description: enrichResult.details.description,
              brand: specifications.marca || specifications.Marca || undefined,
              availability: 'Consultar disponibilidad',
              specifications,
              images: [product.image]
            };
          } else {
            console.warn(`  ⚠️ No se pudo enriquecer con Gemini: ${enrichResult.error}`);
          }
        } catch (geminiError) {
          console.error(`  ❌ Error usando Gemini:`, geminiError);
        }
        
        // Si Gemini falla, retornar datos básicos
        return {
          name: product.product_name,
          store: product.storeName,
          price: product.price,
          url: product.url,
          description: 'Producto de infesa.com - información básica',
          brand: undefined,
          availability: 'Consultar disponibilidad',
          specifications: {},
          images: product.image ? [product.image] : []
        };
      }

      // FLUJO NORMAL: Scrapear página de detalle
      const scraped = await this.playwrightService.scrapeUrl(product.url, {
        waitTime: storeConfig?.scraping?.wait_time || 3000,
        waitForSelectors: storeConfig?.scraping?.wait_for_selectors_detail || storeConfig?.scraping?.wait_for_selectors
      });

      // Extraer información usando cheerio
      const $ = cheerio.load(scraped.html);

      // Extraer descripción
      const description = this.extractDescription($, storeConfig);

      // Extraer especificaciones
      const specifications = this.extractSpecifications($, storeConfig);

      // Extraer imágenes adicionales
      const images = this.extractImages($, storeConfig);

      // Extraer marca
      const brand = this.extractBrand($, storeConfig);

      // Extraer disponibilidad
      const availability = this.extractAvailability($, storeConfig);

      return {
        name: product.product_name,
        store: product.storeName,
        price: product.price,
        url: product.url,
        description,
        brand,
        availability,
        specifications,
        images
      };

    } catch (error) {
      console.error(`❌ Error scrapeando ${product.url}:`, error);
      
      // Retornar datos básicos si falla el scraping
      return {
        name: product.product_name,
        store: product.storeName,
        price: product.price,
        url: product.url,
        description: 'No se pudo obtener descripción',
        brand: undefined,
        availability: undefined,
        specifications: {},
        images: []
      };
    }
  }

  /**
   * Extrae la descripción del producto
   */
  private extractDescription($: cheerio.CheerioAPI, storeConfig: any): string {
    // Obtener selectores desde config (pueden estar separados por coma)
    const configSelectors = storeConfig?.product_detail?.description;
    
    let selectors: string[] = [];
    if (configSelectors) {
      // Separar por coma si hay múltiples
      selectors = configSelectors.split(',').map((s: string) => s.trim());
    } else {
      // Fallback a selectores comunes
      selectors = [
        '.product-description',
        '.description',
        '[itemprop="description"]',
        '.product-info',
        '#description',
        '.product.attribute.description',
        '.product-details',
        '.overview'
      ];
    }

    for (const selector of selectors) {
      const text = $(selector).first().text().trim();
      if (text && text.length > 20) {
        return text.substring(0, 1000); // Limitar a 1000 caracteres
      }
    }

    return 'Descripción no disponible';
  }

  /**
   * Extrae especificaciones técnicas
   */
  private extractSpecifications($: cheerio.CheerioAPI, storeConfig: any): Record<string, any> {
    const specs: Record<string, any> = {};
    
    // Obtener selectores desde config (pueden estar separados por coma)
    const configSelectors = storeConfig?.product_detail?.specifications;
    
    let selectors: string[] = [];
    if (configSelectors) {
      selectors = configSelectors.split(',').map((s: string) => s.trim());
    } else {
      selectors = [
        '.specifications table',
        '.product-specs',
        '.technical-specs',
        '.additional-attributes',
        '[class*="spec"]'
      ];
    }

    for (const selector of selectors) {
      const element = $(selector).first();
      
      if (element.length > 0) {
        // Si es una tabla
        element.find('tr').each((_, row) => {
          const cells = $(row).find('td, th');
          if (cells.length >= 2) {
            const key = $(cells[0]).text().trim();
            const value = $(cells[1]).text().trim();
            if (key && value) {
              specs[key] = value;
            }
          }
        });

        // Si es una lista
        element.find('li').each((_, item) => {
          const text = $(item).text().trim();
          const [key, ...valueParts] = text.split(':');
          if (key && valueParts.length > 0) {
            specs[key.trim()] = valueParts.join(':').trim();
          }
        });
      }
    }

    return specs;
  }

  /**
   * Extrae URLs de imágenes
   */
  private extractImages($: cheerio.CheerioAPI, storeConfig: any): string[] {
    const images: string[] = [];
    
    let selectors: string[] = [];
    
    if (storeConfig?.product_detail?.images?.main) {
      // Usar selectores de la config
      const mainSelectors = storeConfig.product_detail.images.main.split(',').map((s: string) => s.trim());
      selectors.push(...mainSelectors);
      
      if (storeConfig.product_detail.images.thumbnails) {
        const thumbSelectors = storeConfig.product_detail.images.thumbnails.split(',').map((s: string) => s.trim());
        selectors.push(...thumbSelectors);
      }
    } else {
      // Fallback a selectores comunes
      selectors = [
        '.product-images img',
        '.product-gallery img',
        '[class*="product-image"] img',
        '.gallery-placeholder img'
      ];
    }

    for (const selector of selectors) {
      $(selector).each((_, img) => {
        const src = $(img).attr('src') || $(img).attr('data-src');
        if (src && !images.includes(src)) {
          images.push(src);
        }
      });

      if (images.length >= 5) break; // Máximo 5 imágenes
    }

    return images.slice(0, 5);
  }

  /**
   * Extrae la marca del producto
   */
  private extractBrand($: cheerio.CheerioAPI, storeConfig: any): string | undefined {
    const brandConfig = storeConfig?.product_detail?.brand;
    
    if (!brandConfig) {
      return undefined;
    }

    // Si es extracción por tabla
    if (brandConfig.extraction_method === 'table_search') {
      const searchLabel = brandConfig.search_label || 'Marca';
      
      // Buscar en todas las tablas
      const tables = $('table');
      for (let i = 0; i < tables.length; i++) {
        const rows = $(tables[i]).find('tr');
        
        for (let j = 0; j < rows.length; j++) {
          const cells = $(rows[j]).find('th, td');
          if (cells.length >= 2) {
            const label = $(cells[0]).text().trim();
            if (label.toLowerCase().includes(searchLabel.toLowerCase())) {
              return $(cells[1]).text().trim();
            }
          }
        }
      }
    }
    
    // Si es extracción por regex
    if (brandConfig.extraction_method === 'regex') {
      const selector = brandConfig.selector;
      const pattern = brandConfig.regex_pattern;
      
      const text = $(selector).text().trim();
      if (text && pattern) {
        const regex = new RegExp(pattern, 'i');
        const match = text.match(regex);
        if (match) {
          return match[1] || match[0];
        }
      }
    }
    
    // Fallback: selector directo
    if (brandConfig.selector) {
      return $(brandConfig.selector).text().trim() || undefined;
    }
    
    return undefined;
  }

  /**
   * Extrae la disponibilidad del producto
   */
  private extractAvailability($: cheerio.CheerioAPI, storeConfig: any): string | undefined {
    const availabilitySelector = storeConfig?.product_detail?.availability;
    
    if (!availabilitySelector) {
      return undefined;
    }

    // Si es una string simple de selector
    if (typeof availabilitySelector === 'string') {
      const text = $(availabilitySelector).text().trim();
      return text || undefined;
    }
    
    return undefined;
  }

  /**
   * Normaliza las descripciones de productos con GPT para convertirlas en listas legibles
   */
  private async normalizeDescriptions(products: DetailedProduct[]): Promise<DetailedProduct[]> {
    console.log('📝 Normalizando descripciones con GPT...');
    
    try {
      const openai = this.getOpenAI();
      
      // Procesar descripciones en paralelo (máximo 3 a la vez para no saturar)
      const normalizedProducts = await Promise.all(
        products.map(async (product) => {
          // Si no tiene descripción o es muy corta, skip
          if (!product.description || product.description.length < 50) {
            return product;
          }

          try {
            const prompt = `Convierte la siguiente descripción de producto en una lista de 3-5 puntos clave, claros y concisos. 
            
DESCRIPCIÓN ORIGINAL:
${product.description}

INSTRUCCIONES:
- Extrae las características más importantes
- Cada punto debe ser claro y directo (máximo 15 palabras)
- Enfócate en especificaciones técnicas, usos y beneficios
- Elimina información redundante o comercial
- Si menciona marca, potencia, dimensiones, tipo, etc., inclúyelos

Responde SOLO con un array JSON de strings. Ejemplo:
["Potencia de 1800W para trabajos pesados", "Disco de 7.1/4 pulgadas", "Motor de alta durabilidad"]`;

            const completion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.3,
              max_tokens: 300
            });

            const response = completion.choices[0]?.message?.content || '';
            
            // Intentar parsear el JSON
            const arrayMatch = response.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
              const normalized = JSON.parse(arrayMatch[0]);
              if (Array.isArray(normalized) && normalized.length > 0) {
                return { ...product, description: normalized };
              }
            }

            // Si falla, retornar descripción original
            return product;

          } catch (error) {
            console.warn(`⚠️ Error normalizando descripción de ${product.name.substring(0, 30)}:`, error);
            return product;
          }
        })
      );

      console.log('✅ Descripciones normalizadas');
      return normalizedProducts;

    } catch (error) {
      console.error('❌ Error en normalización de descripciones:', error);
      // Si falla, retornar productos sin normalizar
      return products;
    }
  }

  /**
   * Analiza productos con GPT
   */
  private async analyzeWithGPT(products: DetailedProduct[]): Promise<ComparisonAnalysis> {
    const prompt = `Eres un experto en comparación de productos. Analiza los siguientes productos y proporciona una comparación detallada.

PRODUCTOS A COMPARAR:

${products.map((p, i) => `
PRODUCTO ${i + 1}:
- Nombre: ${p.name}
- Tienda: ${p.store}
- Marca: ${p.brand || 'No especificada'}
- Precio: ₡${p.price.toLocaleString('es-CR')}
- Disponibilidad: ${p.availability || 'No especificada'}
- Descripción: ${p.description || 'No disponible'}
- Especificaciones: ${Object.keys(p.specifications || {}).length > 0 ? JSON.stringify(p.specifications, null, 2) : 'No disponibles'}
`).join('\n---\n')}

INSTRUCCIONES IMPORTANTES:
- Considera la MARCA de cada producto en tu análisis (si están disponibles)
- Toma en cuenta la DISPONIBILIDAD del producto (stock)
- Compara productos de la MISMA marca cuando sea posible
- Si las marcas son diferentes, menciónalo en el análisis
- El "best_value" debe ser DIFERENTE del "cheapest" cuando sea posible

ASIGNACIÓN DE BADGES (MUY IMPORTANTE):

PASO 1: Identifica el TIPO de producto
- Lee cuidadosamente los nombres y descripciones de los productos
- Determina la categoría: ¿son herramientas eléctricas, tornillos, pintura, consumibles, etc?

PASO 2: Define badges RELEVANTES para ESE tipo específico
- NO uses badges genéricos que no apliquen (ej: NO uses "MÁS POTENTE" para tornillos)
- Crea badges que tengan sentido para las características de ESE tipo de producto
- Cada badge debe destacar una diferencia REAL entre los productos

PASO 3: COMPARACIÓN NUMÉRICA (CRÍTICO - LEE CON CUIDADO):
Antes de asignar badges comparativos (MAYOR/MENOR/MÁS/MENOS), DEBES:

a) Extraer valores numéricos de TODOS los productos:
   - Busca en nombres y descripciones: galones, HP, watts, voltios, amperios, pulgadas, litros, kg, etc.
   - Extrae el número exacto de CADA producto
   
b) Comparar los valores extraídos:
   - Identifica cuál tiene el MÁXIMO valor
   - Identifica cuál tiene el MÍNIMO valor
   
c) Asignar badges CORRECTAMENTE:
   ❌ INCORRECTO: Asignar "MAYOR CAPACIDAD" a 2.5 galones cuando existe 3 galones
   ✅ CORRECTO: Asignar "MAYOR CAPACIDAD" al que tenga el valor MÁS ALTO entre TODOS
   
d) Ejemplos de badges comparativos que REQUIEREN validación numérica:
   - "MAYOR CAPACIDAD", "MENOR CAPACIDAD"
   - "MÁS POTENTE", "MENOS POTENTE"
   - "MAYOR TAMAÑO", "MÁS COMPACTO"
   - "MÁS DURADERO" (si hay mAh o duración en specs)
   - "MAYOR VOLTAJE", "MENOR VOLTAJE"

PASO 4: Asigna badges únicos
- Usa el ÍNDICE del producto (0, 1, 2, 3...)
- CADA producto debe tener UN badge diferente
- Etiquetas: máximo 3 palabras, MAYÚSCULAS
- Si asignas un badge comparativo (MAYOR/MENOR/MÁS/MENOS), VERIFICA que sea verdad para ESE producto vs TODOS los demás

EJEMPLOS (USA SOLO LOS QUE APLIQUEN AL TIPO DE PRODUCTO):

Si son ASPIRADORAS/TANQUES/CONTENEDORES:
✅ "MEJOR PRECIO", "MAYOR CAPACIDAD", "MÁS POTENTE", "MÁS COMPACTA", "MEJOR MARCA"
⚠️ IMPORTANTE: Si un producto tiene 2.5 galones y otro 3 galones, "MAYOR CAPACIDAD" DEBE ir al de 3 galones
❌ NO uses badges de capacidad sin verificar los valores numéricos de TODOS los productos

Si son HERRAMIENTAS ELÉCTRICAS:
✅ "MEJOR PRECIO", "MÁS POTENTE", "USO PROFESIONAL", "USO DOMÉSTICO", "MEJOR MARCA"
❌ NO uses "MAYOR CANTIDAD" o "MEJOR ACABADO" (no aplica)

Si son TORNILLOS/CLAVOS/FIJACIONES:
✅ "MEJOR PRECIO", "MAYOR CANTIDAD", "MÁS RESISTENTE", "MEJOR ACABADO", "GALVANIZADO"
❌ NO uses "MÁS POTENTE" o "USO PROFESIONAL" (no tiene sentido)

Si son PINTURAS/RECUBRIMIENTOS:
✅ "MEJOR PRECIO", "MAYOR RENDIMIENTO", "MEJOR COBERTURA", "SECADO RÁPIDO", "MÁS DURABLE"
❌ NO uses "MÁS POTENTE" (no aplica)

Si son BATERÍAS/PILAS:
✅ "MEJOR PRECIO", "MAYOR DURACIÓN", "CARGA RÁPIDA", "MÁS COMPATIBLE", "MEJOR MARCA"
❌ NO uses badges de herramientas

Si son MATERIALES DE CONSTRUCCIÓN:
✅ "MEJOR PRECIO", "MAYOR RESISTENCIA", "MEJOR CALIDAD", "MÁS ECONÓMICO", "MAYOR DURABILIDAD"

IMPORTANTE: Si el producto es de un tipo que no está en los ejemplos, CREA badges apropiados para ESE tipo específico.

⚠️ VALIDACIÓN FINAL (ANTES DE RESPONDER):
Antes de generar el JSON final, REVISA:
1. ¿Asignaste algún badge comparativo? (MAYOR, MENOR, MÁS, MENOS)
2. Si SÍ: ¿Extraíste y comparaste los valores numéricos de TODOS los productos?
3. ¿El badge es verdadero cuando lo comparas con TODOS los demás productos?
4. Si algún badge es incorrecto, CORRÍGELO antes de responder

Ejemplo de validación:
- Badge propuesto: "MAYOR CAPACIDAD" para Producto 0
- Capacidades: Producto 0 = 2.5 gal, Producto 1 = 2 gal, Producto 2 = 3 gal
- ❌ INCORRECTO: 2.5 gal NO es la mayor (3 gal es mayor)
- ✅ CORRECTO: Cambiar badge a "MAYOR CAPACIDAD" para Producto 2

Colores disponibles:
- green: precio económico, ahorro
- blue: mejor valor, equilibrio calidad-precio
- orange: rendimiento, potencia, velocidad
- purple: profesional, alta calidad
- teal: uso doméstico, facilidad de uso
- yellow: marca reconocida, confianza

Por favor proporciona un análisis en formato JSON con la siguiente estructura:

{
  "summary": "Resumen general de la comparación (2-3 oraciones)",
  "recommendation": "Cuál recomiendas y por qué (1-2 oraciones)",
  "pros_cons": [
    {
      "product": "Nombre del producto",
      "pros": ["Pro 1", "Pro 2", "Pro 3"],
      "cons": ["Con 1", "Con 2"]
    }
  ],
  "price_analysis": {
    "cheapest": "Nombre del más económico",
    "best_value": "Nombre del mejor valor (diferente del cheapest)",
    "price_range": "Rango de precios"
  },
  "product_badges": [
    {
      "product_index": 0,
      "badge_label": "MEJOR PRECIO",
      "badge_type": "price",
      "badge_color": "green"
    },
    {
      "product_index": 1,
      "badge_label": "MEJOR VALOR",
      "badge_type": "value",
      "badge_color": "blue"
    },
    {
      "product_index": 2,
      "badge_label": "MÁS POTENTE",
      "badge_type": "power",
      "badge_color": "orange"
    }
  ],
  "specifications_comparison": {
    "key_differences": ["Diferencia 1", "Diferencia 2"],
    "similarities": ["Similitud 1", "Similitud 2"]
  }
}

IMPORTANTE: Responde SOLO con el JSON, sin texto adicional.`;

    try {
      const openai = this.getOpenAI();
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,  // Bajo para análisis técnicos y comparaciones numéricas precisas
        max_tokens: 2000
      });

      const response = completion.choices[0]?.message?.content || '';
      
      // Parsear respuesta JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('No se pudo parsear la respuesta de GPT');

    } catch (error) {
      console.error('❌ Error en análisis GPT:', error);
      
      // Retornar análisis básico si falla GPT
      return this.getBasicAnalysis(products);
    }
  }

  /**
   * Análisis básico sin GPT (fallback)
   */
  private getBasicAnalysis(products: DetailedProduct[]): ComparisonAnalysis {
    const sortedByPrice = [...products].sort((a, b) => a.price - b.price);
    const cheapest = sortedByPrice[0];
    const mostExpensive = sortedByPrice[sortedByPrice.length - 1];

    return {
      summary: `Comparación de ${products.length} productos de diferentes tiendas. Rango de precios: ₡${cheapest.price.toLocaleString()} - ₡${mostExpensive.price.toLocaleString()}.`,
      recommendation: `Recomendamos analizar la relación calidad-precio considerando las especificaciones de cada producto.`,
      pros_cons: products.map(p => ({
        product: p.name,
        pros: [
          p.price === cheapest.price ? 'Precio más económico' : 'Especificaciones completas',
          `Disponible en ${p.store}`
        ],
        cons: [
          p.price === mostExpensive.price ? 'Precio más alto' : 'Requiere comparación detallada'
        ]
      })),
      price_analysis: {
        cheapest: cheapest.name,
        best_value: cheapest.name,
        price_range: `₡${cheapest.price.toLocaleString()} - ₡${mostExpensive.price.toLocaleString()}`
      },
      product_badges: products.map((_, idx) => ({
        product_index: idx,
        badge_label: idx === 0 ? 'MEJOR PRECIO' : 'COMPARAR',
        badge_type: idx === 0 ? 'price' as const : 'custom' as const,
        badge_color: idx === 0 ? 'green' as const : 'blue' as const
      })),
      specifications_comparison: {
        key_differences: ['Consultar especificaciones de cada producto'],
        similarities: ['Categoría similar de productos']
      }
    };
  }
}
