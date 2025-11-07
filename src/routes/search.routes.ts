import { Router, Request, Response, NextFunction } from 'express';
import { getMultiStoreSearchService } from '../services/multi-store-search.service';

export const searchRouter: Router = Router();

/**
 * POST /api/search
 * Busca en todas las tiendas configuradas automáticamente
 */
searchRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, type = 'open_search', topN, filter, maxPages } = req.body;

    if (!search) {
      return res.status(400).json({
        success: false,
        error: 'El campo "search" es requerido'
      });
    }

    if (type !== 'open_search') {
      return res.status(400).json({
        success: false,
        error: 'Por ahora solo se soporta type: "open_search"'
      });
    }

    const multiStoreService = getMultiStoreSearchService();
    const result = await multiStoreService.searchAllStores(search, {
      type,
      topN,
      filter,
      maxPages  // Permitir controlar cuántas páginas scrapear
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error en búsqueda multi-tienda:', error);
    next(error);
    return;
  }
});

/**
 * POST /api/search/store/:domain
 * Busca en una tienda específica
 */
searchRouter.post('/store/:domain', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { domain } = req.params;
    const { search } = req.body;

    if (!search) {
      return res.status(400).json({
        success: false,
        error: 'El campo "search" es requerido'
      });
    }

    const multiStoreService = getMultiStoreSearchService();
    const result = await multiStoreService.searchInStore(domain, search);

    res.json(result);
  } catch (error) {
    console.error('Error en búsqueda específica:', error);
    next(error);
    return;
  }
});

/**
 * POST /api/search/scrape
 * FASE 1: Solo realiza scraping de productos de todas las tiendas
 */
searchRouter.post('/scrape', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, maxPages } = req.body;

    if (!search) {
      return res.status(400).json({
        success: false,
        error: 'El campo "search" es requerido'
      });
    }

    const multiStoreService = getMultiStoreSearchService();
    const result = await multiStoreService.scrapeAllStores(search, { maxPages });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error en scraping:', error);
    next(error);
    return;
  }
});

/**
 * POST /api/search/filter
 * FASE 2: Aplica filtrado inteligente con LLM a productos ya scrapeados
 */
searchRouter.post('/filter', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, stores, topN, filter } = req.body;

    if (!search || !stores || !Array.isArray(stores)) {
      return res.status(400).json({
        success: false,
        error: 'Los campos "search" y "stores" son requeridos'
      });
    }

    const multiStoreService = getMultiStoreSearchService();
    const result = await multiStoreService.filterProducts(search, stores, { topN, filter });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error en filtrado:', error);
    next(error);
    return;
  }
});

/**
 * POST /api/search/sort
 * FASE 3: Ordena productos filtrados por similaridad entre tiendas
 */
searchRouter.post('/sort', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, stores } = req.body;

    if (!search || !stores || !Array.isArray(stores)) {
      return res.status(400).json({
        success: false,
        error: 'Los campos "search" y "stores" son requeridos'
      });
    }

    const multiStoreService = getMultiStoreSearchService();
    const result = await multiStoreService.sortProducts(search, stores);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error en ordenado:', error);
    next(error);
    return;
  }
});
