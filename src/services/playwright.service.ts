import { chromium, Browser, Page } from 'playwright';
import * as cheerio from 'cheerio';
import { createContextLogger } from '../utils/logger';

export interface ScrapedContent {
  html: string;
  text: string;
  url: string;
  title: string;
}

export class PlaywrightService {
  private browser: Browser | null = null;
  private logger = createContextLogger('');  // Sin contexto por defecto

  /**
   * Establece el contexto del logger (nombre de tienda)
   */
  setContext(context: string): void {
    this.logger = createContextLogger(context);
  }

  /**
   * Inicializa el browser de Playwright
   */
  async initialize(): Promise<void> {
    if (!this.browser) {
      this.logger.debug('Iniciando Playwright browser...');
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.logger.debug('Browser iniciado');
    }
  }

  /**
   * Scrape una URL y retorna el contenido HTML y texto
   */
  async scrapeUrl(url: string, options?: { 
    waitTime?: number; 
    selector?: string;
    waitForSelectors?: string[];  // Múltiples selectores para SPAs
    scroll?: boolean;  // Si hacer scroll o no
  }): Promise<ScrapedContent> {
    await this.initialize();

    if (!this.browser) {
      throw new Error('Browser no inicializado');
    }

    this.logger.scraping(`Iniciando: ${url}`);

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page: Page = await context.newPage();

    try {
      // Estrategia optimizada: usar domcontentloaded con timeout corto
      // Es más rápido y suficiente para la mayoría de SPAs
      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000  // 30 segundos máximo
        });
        this.logger.debug('Navegación exitosa con domcontentloaded');
      } catch (navError) {
        // Fallback: intentar con networkidle solo si falla
        this.logger.debug('Intentando fallback con networkidle');
        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: 30000
        });
      }

      // Esperar selectores específicos si se proporcionan (importante para SPAs)
      if (options?.waitForSelectors && options.waitForSelectors.length > 0) {
        this.logger.debug('Esperando selectores dinámicos...');
        for (const selector of options.waitForSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 15000 });
            this.logger.debug(`Selector encontrado: ${selector}`);
          } catch {
            this.logger.debug(`Selector no encontrado: ${selector}`);
          }
        }
      } else {
        const waitTime = options?.waitTime || 3000;
        this.logger.debug(`Esperando ${waitTime}ms`);
        await page.waitForTimeout(waitTime);
      }

      // Hacer scroll solo si está habilitado (por defecto true para compatibilidad)
      const shouldScroll = options?.scroll !== false;
      if (shouldScroll) {
        this.logger.debug('Haciendo scroll...');
        await this.autoScroll(page);
      } else {
        this.logger.debug('Scroll deshabilitado');
      }

      // Esperar selector específico adicional si se proporciona
      if (options?.selector) {
        try {
          await page.waitForSelector(options.selector, { timeout: 10000 });
          this.logger.debug(`Selector adicional encontrado: ${options.selector}`);
        } catch {
          this.logger.debug(`Selector adicional no encontrado: ${options.selector}`);
        }
      }

      // Obtener el HTML completo
      const html = await page.content();
      
      // Obtener el texto visible con fallback
      let text = '';
      try {
        text = await page.textContent('body') || '';
      } catch {
        text = '';
      }
      
      // Obtener el título
      const title = await page.title();

      this.logger.success(`Completado: ${title} (${(html.length / 1024).toFixed(2)} KB)`);

      await context.close();

      return {
        html,
        text,
        url,
        title
      };
    } catch (error) {
      await context.close();
      this.logger.error('Error en scraping:', error);
      throw new Error(`Failed to scrape: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Auto-scroll optimizado para cargar contenido lazy-loaded
   */
  private async autoScroll(page: Page): Promise<void> {
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 200;
        const maxScrolls = 20;
        let scrollCount = 0;

        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          scrollCount++;

          if (totalHeight >= scrollHeight || scrollCount >= maxScrolls) {
            clearInterval(timer);
            resolve();
          }
        }, 50);
      });
    });

    // Esperar menos después del scroll
    await page.waitForTimeout(500);
  }

  /**
   * Extrae contenido principal usando cheerio
   * Mantiene los atributos importantes como href para las URLs
   */
  extractMainContent(html: string): string {
    const $ = cheerio.load(html);

    // Solo remover scripts, styles y elementos que no aportan contenido
    $('script, style, iframe, noscript').remove();

    // Intentar encontrar el contenido principal
    const mainSelectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '#main-content',
      '.content',
      '#content',
      'article',
      '.product-list',
      '.products',
      '.search-results',
      '.category-products',
      '.products-grid'
    ];

    for (const selector of mainSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        // En vez de solo text(), obtener HTML con estructura
        const htmlContent = element.html();
        if (htmlContent && htmlContent.length > 100) {
          return this.htmlToStructuredText($, element);
        }
      }
    }

    // Si no encuentra, procesar el body completo
    return this.htmlToStructuredText($, $('body'));
  }

  /**
   * Convierte HTML a texto estructurado manteniendo URLs de productos
   */
  private htmlToStructuredText($: cheerio.CheerioAPI, element: cheerio.Cheerio<any>): string {
    let result = '';
    
    // Extraer productos con sus URLs
    element.find('a[href]').each((_, link) => {
      const $link = $(link);
      const href = $link.attr('href');
      const text = $link.text().trim();
      
      // Solo incluir links que parecen ser de productos
      if (href && text && text.length > 3) {
        result += `\n[PRODUCT] ${text} | URL: ${href}`;
      }
    });

    // También incluir el texto normal
    result += '\n\n' + element.text().trim();
    
    return result;
  }

  /**
   * Cierra el browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      this.logger.debug('Cerrando browser...');
      await this.browser.close();
      this.browser = null;
      this.logger.debug('Browser cerrado');
    }
  }
}

// Singleton instance
let instance: PlaywrightService | null = null;

export const getPlaywrightService = (): PlaywrightService => {
  if (!instance) {
    instance = new PlaywrightService();
  }
  return instance;
};
