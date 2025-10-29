import { Router, Request, Response, NextFunction } from 'express';
import { getLLMConfig } from '../config/llm-config';
import { LLMOperation, LLMProvider, AvailableModels } from '../types/llm.types';

export const llmConfigRouter = Router();

/**
 * GET /api/llm-config
 * Obtiene la configuración actual de providers y modelos
 */
llmConfigRouter.get('/', (req: Request, res: Response) => {
  const config = getLLMConfig();
  
  res.json({
    success: true,
    config: config.getConfig(),
    availableProviders: Object.values(LLMProvider),
    availableOperations: Object.values(LLMOperation),
    availableModels: AvailableModels
  });
});

/**
 * PUT /api/llm-config/:operation
 * Actualiza el provider y/o modelo para una operación específica
 */
llmConfigRouter.put('/:operation', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { operation } = req.params;
    const { provider, model } = req.body;

    if (!provider && !model) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar al menos "provider" o "model"'
      });
    }

    // Validar que la operación sea válida
    if (!Object.values(LLMOperation).includes(operation as LLMOperation)) {
      return res.status(400).json({
        success: false,
        error: `Operación inválida. Operaciones válidas: ${Object.values(LLMOperation).join(', ')}`
      });
    }

    // Validar que el provider sea válido (si se proporciona)
    if (provider && !Object.values(LLMProvider).includes(provider as LLMProvider)) {
      return res.status(400).json({
        success: false,
        error: `Provider inválido. Providers válidos: ${Object.values(LLMProvider).join(', ')}`
      });
    }

    const config = getLLMConfig();
    
    // Actualizar provider si se proporciona
    if (provider) {
      config.setProvider(operation as LLMOperation, provider as LLMProvider);
    }
    
    // Actualizar modelo si se proporciona
    if (model) {
      config.setModel(operation as LLMOperation, model);
    }

    const changes = [];
    if (provider) changes.push(`provider: ${provider}`);
    if (model) changes.push(`modelo: ${model}`);

    res.json({
      success: true,
      message: `Configuración actualizada para ${operation}: ${changes.join(', ')}`,
      config: config.getConfig()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/llm-config/batch
 * Actualiza múltiples providers a la vez
 */
llmConfigRouter.post('/batch', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { config: newConfig } = req.body;

    if (!newConfig || typeof newConfig !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'El campo "config" es requerido y debe ser un objeto'
      });
    }

    // Validar todas las operaciones y providers
    for (const [operation, provider] of Object.entries(newConfig)) {
      if (!Object.values(LLMOperation).includes(operation as LLMOperation)) {
        return res.status(400).json({
          success: false,
          error: `Operación inválida: ${operation}`
        });
      }

      if (!Object.values(LLMProvider).includes(provider as LLMProvider)) {
        return res.status(400).json({
          success: false,
          error: `Provider inválido: ${provider} para operación ${operation}`
        });
      }
    }

    const config = getLLMConfig();
    config.updateConfig(newConfig);

    res.json({
      success: true,
      message: 'Configuración actualizada correctamente',
      config: config.getConfig()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/llm-config/reset
 * Resetea la configuración a los valores por defecto
 */
llmConfigRouter.post('/reset', (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = getLLMConfig();
    config.resetToDefault();

    res.json({
      success: true,
      message: 'Configuración reseteada a valores por defecto',
      config: config.getConfig()
    });
  } catch (error) {
    next(error);
  }
});
