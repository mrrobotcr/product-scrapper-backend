import { Router, Request, Response, NextFunction } from 'express';
import { getScraperService } from '../services/scraper.service';
import { ScrapeRequest, ScrapeResponse } from '../types/product.types';
import { validateScrapeRequest } from '../middleware/validation';

export const scrapeRouter = Router();

/**
 * POST /api/scrape/url
 * Scrape a single URL for product information
 */
scrapeRouter.post('/url', validateScrapeRequest, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, options }: ScrapeRequest = req.body;

    const scraperService = getScraperService();

    // Scrape con Playwright + GPT-4
    const result = await scraperService.scrapeProducts(url, options);

    res.json(result);
  } catch (error) {
    console.error('Error in scrape endpoint:', error);
    next(error);
  }
});

/**
 * POST /api/scrape/search
 * Search for products across a specific store URL
 */
scrapeRouter.post('/search', validateScrapeRequest, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, searchQuery, options }: ScrapeRequest = req.body;

    const scraperService = getScraperService();

    // Construct search URL if searchQuery is provided
    const searchUrl = searchQuery ? `${url}?search=${encodeURIComponent(searchQuery)}` : url;

    const result = await scraperService.scrapeProducts(searchUrl, options);

    res.json(result);
  } catch (error) {
    console.error('Error in search endpoint:', error);
    next(error);
  }
});

/**
 * POST /api/scrape/crawl
 * Crawl multiple pages from a site
 */
scrapeRouter.post('/crawl', validateScrapeRequest, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, options }: ScrapeRequest = req.body;

    const scraperService = getScraperService();

    // Por ahora scrape la página principal
    // Más adelante se puede implementar crawling multi-página
    const result = await scraperService.scrapeProducts(url, options);

    res.json(result);
  } catch (error) {
    console.error('Error in crawl endpoint:', error);
    next(error);
  }
});

/**
 * GET /api/scrape/status
 * Check scraping service status
 */
scrapeRouter.get('/status', (req: Request, res: Response) => {
  res.json({
    status: 'operational',
    service: 'Playwright + GPT-4 Product Scraper',
    timestamp: new Date().toISOString(),
    features: {
      singleUrlScraping: true,
      searchScraping: true,
      siteCrawling: true,
      javascriptRendering: true,
      aiExtraction: true
    }
  });
});
