import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Zod schema for scrape request validation
const scrapeRequestSchema = z.object({
  url: z.string().url('Invalid URL format'),
  searchQuery: z.string().optional(),
  options: z.object({
    waitFor: z.number().min(0).max(30000).optional(),
    screenshot: z.boolean().optional(),
    mobile: z.boolean().optional(),
    timeout: z.number().min(1000).max(60000).optional(),
  }).optional(),
});

export const validateScrapeRequest = (req: Request, res: Response, next: NextFunction) => {
  try {
    scrapeRequestSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    } else {
      next(error);
    }
  }
};
