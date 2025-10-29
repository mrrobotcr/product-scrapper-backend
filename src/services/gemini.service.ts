import { GoogleGenAI } from '@google/genai';

export interface ProductDetails {
  description: string;
  specifications: Record<string, string>;
  technicalInfo?: string;
}

export interface GeminiProductEnrichmentResult {
  success: boolean;
  details?: ProductDetails;
  error?: string;
}

/**
 * Servicio para enriquecer información de productos usando Gemini
 * Especialmente útil para tiendas como infesa.com que no tienen páginas de detalle
 */
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY no está definida en las variables de entorno');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Obtiene detalles de un producto usando su imagen y título
   * Utiliza Google Search grounding para información actualizada
   */
  async getProductDetailsFromImage(
    imageUrl: string,
    productTitle: string
  ): Promise<GeminiProductEnrichmentResult> {
    console.log(`🤖 Obteniendo detalles con Gemini para: "${productTitle}"`);
    console.log(`  📸 Imagen: ${imageUrl}`);

    try {
      // Configurar Google Search tool para grounding
      const groundingTool = {
        googleSearch: {}
      };

      // Descargar imagen desde URL
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        throw new Error(`Error descargando imagen: ${response.status} ${response.statusText}`);
      }

      const imageArrayBuffer = await response.arrayBuffer();
      const base64ImageData = Buffer.from(imageArrayBuffer).toString('base64');

      // Crear prompt para obtener detalles del producto
      const prompt = `Analiza esta imagen y el título del producto: "${productTitle}".

Proporciona la siguiente información en formato JSON:

1. **description**: Una descripción detallada del producto (2-3 párrafos) que incluya:
   - Tipo de producto y su función principal
   - Características destacadas visibles en la imagen
   - Aplicaciones y usos comunes
   
2. **specifications**: Un objeto con especificaciones técnicas clave del producto. Incluye solo especificaciones relevantes como:
   - Voltaje (si aplica)
   - Potencia (si aplica)
   - Dimensiones aproximadas
   - Peso aproximado
   - Material
   - Marca (si es visible o deducible)
   - Modelo (si es visible)
   - Cualquier otra especificación técnica relevante
   
3. **technicalInfo**: Información técnica adicional relevante (opcional)

IMPORTANTE: 
- Si no puedes determinar alguna especificación, NO la incluyas
- Sé preciso y basate en la imagen y el título
- Usa Google Search para complementar información si es necesario
- Formato de respuesta DEBE ser JSON válido sin markdown

Formato de respuesta:
{
  "description": "descripción detallada aquí",
  "specifications": {
    "voltaje": "18V",
    "tipo": "Inalámbrico",
    ...
  },
  "technicalInfo": "información adicional si existe"
}`;

      // Generar contenido con Gemini
      const result = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
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
      
      if (!responseText) {
        throw new Error('No se recibió respuesta de Gemini');
      }

      // Limpiar markdown si existe (```json ... ```)
      let cleanedResponse = responseText.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Parsear JSON
      const details: ProductDetails = JSON.parse(cleanedResponse);

      console.log(`✅ Detalles obtenidos exitosamente`);
      console.log(`  📝 Descripción: ${details.description.substring(0, 100)}...`);
      console.log(`  🔧 Especificaciones: ${Object.keys(details.specifications).length} encontradas`);

      return {
        success: true,
        details
      };

    } catch (error) {
      console.error('❌ Error obteniendo detalles con Gemini:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Enriquece un producto con detalles obtenidos de Gemini
   * Útil para productos que solo tienen información básica
   */
  async enrichProduct(
    productName: string,
    imageUrl?: string
  ): Promise<GeminiProductEnrichmentResult> {
    
    if (!imageUrl) {
      return {
        success: false,
        error: 'No se proporcionó URL de imagen'
      };
    }

    return this.getProductDetailsFromImage(imageUrl, productName);
  }

  /**
   * Enriquece múltiples productos en batch
   * Útil para procesar varios productos de infesa.com
   */
  async enrichProductsBatch(
    products: Array<{ name: string; imageUrl?: string }>
  ): Promise<GeminiProductEnrichmentResult[]> {
    console.log(`🤖 Enriqueciendo ${products.length} productos con Gemini...`);
    
    const results: GeminiProductEnrichmentResult[] = [];
    
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
let instance: GeminiService | null = null;

export const getGeminiService = (): GeminiService => {
  if (!instance) {
    instance = new GeminiService();
  }
  return instance;
};
