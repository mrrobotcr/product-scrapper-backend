import { Router, Request, Response } from 'express';
import { getStoreConfigService } from '../services/store-config.service';

export const storesRouter: Router = Router();

/**
 * GET /api/stores
 * Lista todas las tiendas configuradas
 */
storesRouter.get('/', (_req: Request, res: Response) => {
  const configService = getStoreConfigService();
  const stores = configService.listAvailableStores();

  res.json({
    success: true,
    stores,
    total: stores.length
  });
});

/**
 * GET /api/stores/:domain
 * Obtiene la configuración de una tienda específica
 */
storesRouter.get('/:domain', (req: Request, res: Response) => {
  const { domain } = req.params;
  const configService = getStoreConfigService();
  const config = configService.getConfig(domain);

  if (!config) {
    return res.status(404).json({
      success: false,
      error: `No existe configuración para el dominio: ${domain}`
    });
  }

  res.json({
    success: true,
    config
  });
});

/**
 * POST /api/stores/search-url
 * Genera URL de búsqueda para una tienda
 */
storesRouter.post('/search-url', (req: Request, res: Response) => {
  const { domain, query } = req.body;

  if (!domain || !query) {
    return res.status(400).json({
      success: false,
      error: 'domain y query son requeridos'
    });
  }

  const configService = getStoreConfigService();
  const searchUrl = configService.buildSearchUrl(domain, query);

  if (!searchUrl) {
    return res.status(404).json({
      success: false,
      error: `No existe configuración para el dominio: ${domain}`
    });
  }

  res.json({
    success: true,
    searchUrl,
    domain,
    query
  });
});
