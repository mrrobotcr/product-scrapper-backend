import * as cheerio from 'cheerio';
import { StoreConfig, ExtractedProduct } from '../types/store-config.types';

/**
 * Servicio para extraer productos usando selectores CSS configurables
 */
export class SelectorExtractorService {
  /**
   * Extrae productos de un listado usando la configuración de selectores
   */
  extractProductList(html: string, config: StoreConfig): ExtractedProduct[] {
    const $ = cheerio.load(html);
    const products: ExtractedProduct[] = [];

    const { product_list } = config;

    // Buscar el contenedor de productos
    const container = $(product_list.container);
    if (container.length === 0) {
      console.warn(`⚠️  Contenedor no encontrado: ${product_list.container}`);
      return [];
    }

    // Iterar sobre cada producto
    container.find(product_list.item).each((index, element) => {
      const $item = $(element);

      try {
        const product: ExtractedProduct = {
          url: this.extractAttribute($, $item, product_list.selectors.url, product_list.selectors.url_attribute),
          product_name: this.extractAttribute($, $item, product_list.selectors.title, product_list.selectors.title_attribute),
          price: this.extractPrice($, $item, product_list.selectors.price, product_list.selectors.price_attribute),
        };

        // Campos opcionales
        if (product_list.selectors.currency) {
          product.currency = this.extractAttribute(
            $, $item,
            product_list.selectors.currency,
            product_list.selectors.currency_attribute || 'text'
          );
        } else {
          product.currency = config.currency;
        }

        if (product_list.selectors.image) {
          product.image = this.extractAttribute(
            $, $item,
            product_list.selectors.image,
            product_list.selectors.image_attribute || 'src'
          );
        }

        if (product_list.selectors.availability) {
          product.availability = this.extractAttribute(
            $, $item,
            product_list.selectors.availability,
            product_list.selectors.availability_attribute || 'text'
          );
        }

        // Validar que tenga al menos nombre y precio
        if (product.product_name && product.price > 0) {
          products.push(product);
        }
      } catch (error) {
        console.warn(`⚠️  Error extrayendo producto ${index + 1}:`, error);
      }
    });

    console.log(`✅ Extraídos ${products.length} productos usando selectores`);
    return products;
  }

  /**
   * Extrae un atributo de un elemento usando selector y tipo de atributo
   */
  private extractAttribute(
    $: cheerio.CheerioAPI,
    $context: cheerio.Cheerio<any>,
    selector: string,
    attribute: string
  ): string {
    const element = $context.find(selector);
    
    if (element.length === 0) {
      return '';
    }

    if (attribute === 'text') {
      return element.text().trim();
    } else if (attribute === 'html') {
      return element.html()?.trim() || '';
    } else {
      return element.attr(attribute)?.trim() || '';
    }
  }

  /**
   * Extrae y parsea el precio
   */
  private extractPrice(
    $: cheerio.CheerioAPI,
    $context: cheerio.Cheerio<any>,
    selector: string,
    attribute: string
  ): number {
    const priceStr = this.extractAttribute($, $context, selector, attribute);
    
    if (!priceStr) return 0;

    // Detectar si es notación científica (ej: 2.499e5, 1.599e5)
    if (/^\d+\.?\d*e[+-]?\d+$/i.test(priceStr.trim())) {
      return parseFloat(priceStr) || 0;
    }

    // Limpiar el precio: quitar símbolos de moneda y separadores, mantener solo dígitos y punto decimal
    const cleanPrice = priceStr.replace(/[^\d.]/g, '');
    return parseFloat(cleanPrice) || 0;
  }

  /**
   * Convierte URLs relativas a absolutas
   */
  makeAbsoluteUrl(url: string, baseUrl: string): string {
    if (!url) return baseUrl;
    
    try {
      // Si ya es absoluta, retornarla
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }

      const base = new URL(baseUrl);
      
      // Si comienza con /, es relativa al dominio
      if (url.startsWith('/')) {
        return `${base.origin}${url}`;
      }

      // Si no, es relativa al path actual
      return new URL(url, baseUrl).href;
    } catch (error) {
      console.warn(`⚠️  Error construyendo URL absoluta: ${url}`, error);
      return baseUrl;
    }
  }

  /**
   * Normaliza los productos extraídos
   * Para búsquedas generales, incluye: url, product_name, price, currency, image
   * NO incluye: availability (solo para vistas detalladas)
   */
  normalizeProducts(products: ExtractedProduct[], baseUrl: string): ExtractedProduct[] {
    return products.map(product => {
      const normalized: any = {
        url: this.makeAbsoluteUrl(product.url, baseUrl),
        product_name: product.product_name.trim(),
        price: Math.round(product.price), // Redondear precios
      };

      // Agregar campos opcionales si existen (excepto availability)
      if (product.currency) {
        normalized.currency = product.currency;
      }
      
      if (product.image) {
        normalized.image = this.makeAbsoluteUrl(product.image, baseUrl);
      }

      // availability NO se incluye en búsquedas generales
      // Solo se agregaría en endpoints de detalle de producto

      return normalized as ExtractedProduct;
    });
  }
}

// Singleton
let instance: SelectorExtractorService | null = null;

export const getSelectorExtractorService = (): SelectorExtractorService => {
  if (!instance) {
    instance = new SelectorExtractorService();
  }
  return instance;
};
