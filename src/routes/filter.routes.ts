import { Router, Request, Response, NextFunction } from 'express';
import { getOpenAIService } from '../services/openai.service';
import { SimpleProduct } from '../types/product.types';

export const filterRouter = Router();

/**
 * POST /api/filter/rank
 * Filtra y rankea productos por relevancia usando GPT-4
 */
filterRouter.post('/rank', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { products, searchQuery, topN = 15 } = req.body;

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere array de productos'
      });
    }

    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere searchQuery'
      });
    }

    const openaiService = getOpenAIService();
    const result = await openaiService.filterAndRankProducts(
      products as SimpleProduct[],
      searchQuery,
      topN
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error en filtrado:', error);
    next(error);
  }
});

/**
 * POST /api/filter/natural
 * Aplica filtros en lenguaje natural
 */
filterRouter.post('/natural', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { products, filterQuery } = req.body;

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere array de productos'
      });
    }

    if (!filterQuery) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere filterQuery'
      });
    }

    const openaiService = getOpenAIService();
    const result = await openaiService.applyNaturalLanguageFilter(
      products as SimpleProduct[],
      filterQuery
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error aplicando filtro:', error);
    next(error);
  }
});

/**
 * POST /api/filter/combined
 * Scrape + Filtrado inteligente en un solo endpoint
 */
filterRouter.post('/combined', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scrapedProducts, searchQuery, topN = 15 } = req.body;

    if (!scrapedProducts || !Array.isArray(scrapedProducts)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere scrapedProducts'
      });
    }

    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere searchQuery'
      });
    }

    const openaiService = getOpenAIService();
    const result = await openaiService.filterAndRankProducts(
      scrapedProducts as SimpleProduct[],
      searchQuery,
      topN
    );

    res.json({
      success: true,
      ...result,
      message: `Mostrando top ${result.totalFiltered} de ${result.originalCount} productos`
    });
  } catch (error) {
    console.error('Error en filtrado combinado:', error);
    next(error);
  }
});
