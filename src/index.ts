import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { scrapeRouter } from './routes/scrape.routes';
import { storesRouter } from './routes/stores.routes';
import { filterRouter } from './routes/filter.routes';
import { searchRouter } from './routes/search.routes';
import { compareRouter } from './routes/compare.routes';
import { llmConfigRouter } from './routes/llm-config.routes';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app: express.Application = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/search', searchRouter);      // 🆕 Búsqueda multi-tienda (principal)
app.use('/api/compare', compareRouter);    // 🆕 Comparación de productos con IA
app.use('/api/llm-config', llmConfigRouter); // 🆕 Configuración de LLM providers
app.use('/api/scrape', scrapeRouter);      // Legacy: scraping directo
app.use('/api/stores', storesRouter);      // Gestión de tiendas
app.use('/api/filter', filterRouter);      // Filtrado post-scraping

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});
export default app;
