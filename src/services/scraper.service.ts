import { getPlaywrightService } from './playwright.service';
import { getStoreConfigService } from './store-config.service';
import { getSelectorExtractorService } from './selector-extractor.service';
import { getPaginationService } from './pagination.service';
import { SimpleProduct, ScrapeOptions } from '../types/product.types';
import { createContextLogger } from '../utils/logger';

export interface ScraperResult {
  success: boolean;
  products: SimpleProduct[];  // Formato simple para búsqueda general
  totalFound: number;
  source: string;
  timestamp: Date;
  summary?: string;
  error?: string;
  method?: 'selector' | 'ai';  // Método usado para extracción
}

/**
 * Servicio principal de scraping
 * - Requiere configuración YAML para cada dominio
 * - Usa selectores CSS para extracción rápida y precisa
 * - Playwright para scraping + rendering JS
 */
export class ScraperService {
  private playwrightService = getPlaywrightService();
  private configService = getStoreConfigService();
  private extractorService = getSelectorExtractorService();
  private paginationService = getPaginationService();

  /**
   * Scrape una URL y extrae productos usando configuración YAML
   * REQUIERE que el dominio tenga configuración
   */
  async scrapeProducts(url: string, options?: ScrapeOptions): Promise<ScraperResult> {
    const startTime = Date.now();
    
    // 1. Verificar si existe configuración para este dominio
    const config = this.configService.getConfigFromUrl(url);
    
    if (!config) {
      const logger = createContextLogger('');
      logger.section(`🚀 Iniciando scraping: ${url}`);
      logger.error('No existe configuración para este dominio');
      throw new Error(
        `No existe configuración para este dominio. ` +
        `Por favor crea un archivo de configuración YAML en src/config/stores/`
      );
    }

    // Crear logger con contexto de tienda
    const logger = createContextLogger(config.name);
    logger.section(`🚀 Iniciando scraping: ${url}`);

    try {
      return await this.scrapeWithSelectors(url, config, options, logger);
      
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      const logger = createContextLogger(config.name);
      logger.error(`Error en scraping (${duration}s):`, error);

      return {
        success: false,
        products: [],
        totalFound: 0,
        source: url,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Scraping usando selectores CSS configurados
   * Soporta paginación automática
   */
  private async scrapeWithSelectors(
    url: string,
    config: any,
    options?: ScrapeOptions,
    logger?: ReturnType<typeof createContextLogger>
  ): Promise<ScraperResult> {
    const log = logger || createContextLogger(config.name);
    const startTime = Date.now();
    let allProducts: any[] = [];
    let currentUrl = url;
    let pageNumber = 1;

    // Verificar si la paginación está habilitada
    const paginationEnabled = config.scraping.pagination?.enabled;

    // Establecer contexto para el servicio de Playwright
    this.playwrightService.setContext(config.name);

    while (true) {
      log.info(`Página ${pageNumber}`);

      // 1. Scraping con Playwright
      const scrapedContent = await this.playwrightService.scrapeUrl(currentUrl, {
        waitTime: options?.waitFor || config.scraping.wait_time,
        waitForSelectors: config.scraping.wait_for_selectors,
      });

      // 2. Extraer productos de esta página
      const products = this.extractorService.extractProductList(scrapedContent.html, config);
      log.info(`Productos encontrados: ${products.length}`);

      // 3. Agregar a la lista total
      allProducts.push(...products);

      // 4. Si no hay paginación o no queremos más páginas, terminar
      if (!paginationEnabled) {
        break;
      }

      // 5. Detectar si hay siguiente página
      const paginationInfo = this.paginationService.detectPagination(
        scrapedContent.html,
        config.scraping.pagination,
        currentUrl
      );

      // 6. Verificar si debemos continuar
      if (paginationInfo.hasNextPage && paginationInfo.nextUrl) {
        log.debug(`Siguiente página: ${paginationInfo.nextUrl}`);
        currentUrl = paginationInfo.nextUrl;
        pageNumber++;
      } else {
        log.debug('No hay más páginas');
        break;
      }

      // Pequeña pausa entre páginas para ser respetuosos
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Normalizar todos los productos
    const normalizedProducts = this.extractorService.normalizeProducts(allProducts, url);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    log.success(`Scraping completado en ${duration}s`);
    log.info(`Páginas: ${pageNumber} | Productos: ${allProducts.length}`);

    return {
      success: true,
      products: normalizedProducts,
      totalFound: normalizedProducts.length,
      source: url,
      timestamp: new Date(),
      method: 'selector',
      summary: `Extraídos ${normalizedProducts.length} productos de ${pageNumber} página(s) con selectores CSS`
    };
  }


  /**
   * Scrape múltiples URLs en paralelo (más rápido que secuencial)
   */
  async scrapeMultiple(urls: string[], options?: ScrapeOptions): Promise<ScraperResult[]> {
    console.log(`🚀 Scraping múltiple: ${urls.length} URLs`);

    const results = await Promise.allSettled(
      urls.map(url => this.scrapeProducts(url, options))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          products: [],
          totalFound: 0,
          source: urls[index],
          timestamp: new Date(),
          error: result.reason?.message || 'Failed to scrape'
        };
      }
    });
  }

  /**
   * Cierra recursos (llamar al terminar la app)
   */
  async cleanup(): Promise<void> {
    await this.playwrightService.close();
  }
}

// Singleton instance
let instance: ScraperService | null = null;

export const getScraperService = (): ScraperService => {
  if (!instance) {
    instance = new ScraperService();
  }
  return instance;
};
