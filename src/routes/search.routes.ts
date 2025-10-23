import { Router, Request, Response, NextFunction } from 'express';
import { getMultiStoreSearchService } from '../services/multi-store-search.service';

export const searchRouter = Router();

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

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error en búsqueda específica:', error);
    next(error);
  }
});
