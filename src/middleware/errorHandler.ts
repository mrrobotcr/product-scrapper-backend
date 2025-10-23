import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('❌ Error:', error);

  // Determine status code
  let statusCode = 500;
  let message = 'Internal server error';

  if (error.message.includes('not defined') || error.message.includes('API key')) {
    statusCode = 503;
    message = 'Service configuration error';
  } else if (error.message.includes('Failed to scrape') || error.message.includes('Failed to crawl')) {
    statusCode = 502;
    message = 'External service error';
  } else if (error.message.includes('timeout')) {
    statusCode = 504;
    message = 'Request timeout';
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    timestamp: new Date().toISOString(),
  });
};
