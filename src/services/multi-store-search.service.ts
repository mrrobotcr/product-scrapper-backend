import { getStoreConfigService } from './store-config.service';
import { getScraperService } from './scraper.service';
import { getOpenAIService } from './openai.service';
import { SimpleProduct } from '../types/product.types';

export interface StoreSearchResult {
  store: string;
  domain: string;
  products: SimpleProduct[];
  count: number;
  success: boolean;
  error?: string;
  searchUrl: string;
  duration: number;
}

export interface MultiStoreSearchResult {
  search: string;
  totalStores: number;
  successfulStores: number;
  totalProducts: number;
  stores: StoreSearchResult[];
  duration: number;
  filtered?: boolean;
  filterSummary?: string;
}

export interface SearchOptions {
  type: 'open_search';  // Futuro: 'category', 'brand', etc.
  topN?: number;        // Si se especifica, aplica filtrado con GPT-4
  filter?: string;      // Filtro en lenguaje natural opcional
  maxPages?: number;    // Limitar número de páginas a scrapear (sobrescribe config)
}

/**
 * Servicio para búsqueda multi-tienda
 * Busca en todas las tiendas configuradas automáticamente
 */
export class MultiStoreSearchService {
  private configService = getStoreConfigService();
  private scraperService = getScraperService();
  private openaiService = getOpenAIService();

  /**
   * Busca en todas las tiendas configuradas
   */
  async searchAllStores(
    query: string,
    options: SearchOptions
  ): Promise<MultiStoreSearchResult> {
    const startTime = Date.now();
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔍 BÚSQUEDA MULTI-TIENDA: "${query}"`);
    console.log(`${'='.repeat(70)}\n`);

    // 1. Obtener todas las tiendas disponibles
    const availableStores = this.configService.listAvailableStores();
    console.log(`📦 Tiendas disponibles: ${availableStores.length}`);
    availableStores.forEach(domain => {
      const config = this.configService.getConfig(domain);
      console.log(`   - ${config?.name} (${domain})`);
    });
    console.log();

    // 2. Generar URLs de búsqueda para cada tienda
    const searchUrls: Array<{ domain: string; url: string; name: string }> = [];
    
    for (const domain of availableStores) {
      const searchUrl = this.configService.buildSearchUrl(domain, query);
      const config = this.configService.getConfig(domain);
      
      if (searchUrl && config) {
        searchUrls.push({
          domain,
          url: searchUrl,
          name: config.name
        });
        console.log(`🔗 ${config.name}: ${searchUrl}`);
      }
    }
    console.log();

    // 3. Scrapear todas las tiendas en paralelo
    console.log(`⚡ Scraping ${searchUrls.length} tiendas en paralelo...\n`);
    
    const scrapePromises = searchUrls.map(async ({ domain, url, name }) => {
      const storeStartTime = Date.now();
      
      try {
        // Pasar maxPages al scraper si se especificó
        const scrapeOptions = options.maxPages ? { maxPages: options.maxPages } : undefined;
        const result = await this.scraperService.scrapeProducts(url, scrapeOptions);
        const duration = Date.now() - storeStartTime;
        
        console.log(`✅ ${name}: ${result.products.length} productos (${(duration / 1000).toFixed(2)}s)`);
        
        return {
          store: name,
          domain,
          products: result.products,
          count: result.products.length,
          success: true,
          searchUrl: url,
          duration
        } as StoreSearchResult;
      } catch (error) {
        const duration = Date.now() - storeStartTime;
        console.error(`❌ ${name}: Error - ${error instanceof Error ? error.message : 'Unknown'}`);
        
        return {
          store: name,
          domain,
          products: [],
          count: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          searchUrl: url,
          duration
        } as StoreSearchResult;
      }
    });

    const storeResults = await Promise.all(scrapePromises);

    // 4. Calcular totales
    const successfulStores = storeResults.filter(r => r.success).length;
    const totalProducts = storeResults.reduce((sum, r) => sum + r.count, 0);
    const duration = Date.now() - startTime;

    console.log(`\n${'='.repeat(70)}`);
    console.log(`✅ Búsqueda completada en ${(duration / 1000).toFixed(2)}s`);
    console.log(`📊 Tiendas exitosas: ${successfulStores}/${storeResults.length}`);
    console.log(`📦 Total productos: ${totalProducts}`);
    console.log(`${'='.repeat(70)}\n`);

    // 5. Aplicar filtrado inteligente si se solicita
    let filteredResults = storeResults;
    let filterSummary: string | undefined;

    if (options.topN && totalProducts > 0) {
      console.log(`🤖 Aplicando filtrado inteligente (top ${options.topN} por tienda)...\n`);
      
      filteredResults = await Promise.all(
        storeResults.map(async (storeResult) => {
          if (!storeResult.success || storeResult.products.length === 0) {
            return storeResult;
          }

          try {
            const filtered = await this.openaiService.filterProductsByRelevance(
              storeResult.products,
              query,
              options.topN!
            );

            return {
              ...storeResult,
              products: filtered.products,
              count: filtered.products.length,
            };
          } catch (error) {
            console.warn(`⚠️  Error filtrando ${storeResult.store}, mostrando todos`);
            return storeResult;
          }
        })
      );

      filterSummary = `Top ${options.topN} productos más relevantes por tienda`;
    }

    // 6. Aplicar filtro en lenguaje natural si se especifica
    if (options.filter && totalProducts > 0) {
      console.log(`🤖 Aplicando filtro: "${options.filter}"...\n`);
      
      filteredResults = await Promise.all(
        storeResults.map(async (storeResult) => {
          if (!storeResult.success || storeResult.products.length === 0) {
            return storeResult;
          }

          try {
            const filtered = await this.openaiService.applyNaturalLanguageFilter(
              storeResult.products,
              options.filter!
            );

            return {
              ...storeResult,
              products: filtered.products,
              count: filtered.products.length,
            };
          } catch (error) {
            console.warn(`⚠️  Error filtrando ${storeResult.store}`);
            return storeResult;
          }
        })
      );

      filterSummary = options.filter;
    }

    // 7. Ordenar productos por similaridad entre tiendas
    console.log(`\n🤖 Ordenando productos por similaridad entre tiendas...`);
    const sortedResults = await this.openaiService.sortProductsBySimilarity(
      filteredResults.map(r => ({ store: r.store, products: r.products })),
      query
    );

    // Actualizar resultados con el nuevo orden
    const finalResults = filteredResults.map(r => {
      const sorted = sortedResults.find(s => s.store === r.store);
      return sorted ? { ...r, products: sorted.products } : r;
    });

    return {
      search: query,
      totalStores: finalResults.length,
      successfulStores,
      totalProducts: finalResults.reduce((sum, r) => sum + r.count, 0),
      stores: finalResults,
      duration,
      filtered: !!(options.topN || options.filter),
      filterSummary
    };
  }

  /**
   * Busca en una tienda específica
   */
  async searchInStore(
    domain: string,
    query: string
  ): Promise<StoreSearchResult> {
    const config = this.configService.getConfig(domain);
    
    if (!config) {
      throw new Error(`No existe configuración para: ${domain}`);
    }

    const searchUrl = this.configService.buildSearchUrl(domain, query);
    
    if (!searchUrl) {
      throw new Error(`No se pudo generar URL de búsqueda para: ${domain}`);
    }

    const startTime = Date.now();
    
    try {
      const result = await this.scraperService.scrapeProducts(searchUrl);
      const duration = Date.now() - startTime;
      
      return {
        store: config.name,
        domain,
        products: result.products,
        count: result.products.length,
        success: true,
        searchUrl,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        store: config.name,
        domain,
        products: [],
        count: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        searchUrl,
        duration
      };
    }
  }
}

// Singleton
let instance: MultiStoreSearchService | null = null;

export const getMultiStoreSearchService = (): MultiStoreSearchService => {
  if (!instance) {
    instance = new MultiStoreSearchService();
  }
  return instance;
};
