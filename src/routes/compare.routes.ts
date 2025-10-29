import express from 'express';
import { ComparisonService } from '../services/comparison.service';

const router = express.Router();
const comparisonService = new ComparisonService();

export interface CompareRequest {
  products: Array<{
    url: string;
    storeName: string;
    product_name: string;
    price: number;
    image?: string;  // Opcional: para tiendas sin detalle (ej: infesa.com)
  }>;
}

export interface CompareResponse {
  success: boolean;
  comparison?: {
    products: Array<{
      name: string;
      store: string;
      price: number;
      url: string;
      description?: string | string[];  // Puede ser texto o lista
      brand?: string;
      availability?: string;
      specifications?: Record<string, any>;
      images?: string[];
    }>;
    analysis: {
      summary: string;
      recommendation: string;
      pros_cons: Array<{
        product: string;
        pros: string[];
        cons: string[];
      }>;
      price_analysis: {
        cheapest: string;
        best_value: string;
        price_range: string;
      };
      product_badges?: Array<{
        product_index: number;
        badge_label: string;
        badge_type: string;
        badge_color: string;
      }>;
      specifications_comparison?: Record<string, any>;
    };
  };
  error?: string;
}

/**
 * POST /api/compare
 * Compara múltiples productos usando scraping y GPT
 */
router.post('/', async (req: express.Request, res: express.Response) => {
  try {
    const { products } = req.body as CompareRequest;

    // Validación
    if (!products || !Array.isArray(products) || products.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren al menos 2 productos para comparar'
      });
    }

    if (products.length > 4) {
      return res.status(400).json({
        success: false,
        error: 'Máximo 4 productos para comparar'
      });
    }

    // Validar que cada producto tenga los campos requeridos
    for (const product of products) {
      if (!product.url || !product.storeName) {
        return res.status(400).json({
          success: false,
          error: 'Cada producto debe tener url y storeName'
        });
      }
    }

    console.log(`📊 Comparando ${products.length} productos...`);

    // Ejecutar comparación
    const comparison = await comparisonService.compareProducts(products);

    const response: CompareResponse = {
      success: true,
      comparison
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Error en comparación:', error);
    
    const response: CompareResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido en la comparación'
    };

    res.status(500).json(response);
  }
});

export const compareRouter = router;
