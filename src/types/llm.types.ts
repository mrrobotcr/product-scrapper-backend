import { SimpleProduct } from './product.types';

/**
 * Tipos de operaciones que pueden realizarse con LLMs
 */
export enum LLMOperation {
  FILTER_BY_RELEVANCE = 'filter_by_relevance',
  SORT_BY_SIMILARITY = 'sort_by_similarity',
  APPLY_NATURAL_LANGUAGE_FILTER = 'apply_natural_language_filter',
  ENRICH_PRODUCT = 'enrich_product'
}

/**
 * Tipos de providers soportados
 */
export enum LLMProvider {
  OPENAI = 'openai',
  GEMINI = 'gemini'
}

/**
 * Resultado del filtrado de productos
 */
export interface FilterResult {
  products: SimpleProduct[];
  summary: string;
  totalFiltered: number;
  originalCount: number;
}

/**
 * Detalles de un producto enriquecido
 */
export interface ProductDetails {
  description: string;
  specifications: Record<string, string>;
  technicalInfo?: string;
}

/**
 * Resultado del enriquecimiento de un producto
 */
export interface ProductEnrichmentResult {
  success: boolean;
  details?: ProductDetails;
  error?: string;
}

/**
 * Opciones para filtrar productos por relevancia
 */
export interface FilterByRelevanceOptions {
  products: SimpleProduct[];
  query: string;
  topN?: number;
  customFilter?: string;
  model?: string; // Modelo específico a usar (opcional)
  supportsThinking?: boolean; // Si el modelo soporta thinking (opcional, se detecta automáticamente)
  temperature?: number; // Temperatura personalizada (opcional)
}

/**
 * Opciones para ordenar productos por similaridad
 */
export interface SortBySimilarityOptions {
  storeProducts: Array<{ store: string; products: SimpleProduct[] }>;
  query: string;
  model?: string; // Modelo específico a usar (opcional)
  supportsThinking?: boolean; // Si el modelo soporta thinking (opcional, se detecta automáticamente)
  temperature?: number; // Temperatura personalizada (opcional)
}

/**
 * Opciones para aplicar filtro en lenguaje natural
 */
export interface ApplyNaturalLanguageFilterOptions {
  products: SimpleProduct[];
  query: string;
  topN?: number;
  customFilter?: string;
  model?: string; // Modelo específico a usar (opcional)
  supportsThinking?: boolean; // Si el modelo soporta thinking (opcional, se detecta automáticamente)
  temperature?: number; // Temperatura personalizada (opcional)
}

/**
 * Opciones para enriquecer un producto
 */
export interface EnrichProductOptions {
  productName: string;
  imageUrl?: string;
  model?: string; // Modelo específico a usar (opcional)
}

/**
 * Interface base que deben implementar todos los providers de LLM
 */
export interface ILLMProvider {
  readonly name: LLMProvider;
  
  /**
   * Filtra y rankea productos por relevancia
   */
  filterProductsByRelevance(options: FilterByRelevanceOptions): Promise<FilterResult>;
  
  /**
   * Ordena productos de múltiples tiendas por similaridad
   */
  sortProductsBySimilarity(options: SortBySimilarityOptions): Promise<Array<{ store: string; products: SimpleProduct[] }>>;
  
  /**
   * Aplica filtros inteligentes con lenguaje natural
   */
  applyNaturalLanguageFilter(options: ApplyNaturalLanguageFilterOptions): Promise<FilterResult>;
  
  /**
   * Enriquece información de un producto (opcional, no todos los providers lo soportan)
   */
  enrichProduct?(options: EnrichProductOptions): Promise<ProductEnrichmentResult>;
}

/**
 * Configuración de provider y modelo para una operación
 */
export interface OperationConfig {
  provider: LLMProvider;
  model: string;
  /**
   * Indica si el modelo soporta thinking/reasoning
   * Si no se especifica, se detecta automáticamente por el nombre del modelo
   */
  supportsThinking?: boolean;
  /**
   * Temperatura personalizada para el modelo
   * Si no se especifica, se usa un valor por defecto según la operación
   */
  temperature?: number;
}

/**
 * Configuración de providers por operación
 */
export interface LLMProviderConfig {
  [LLMOperation.FILTER_BY_RELEVANCE]: OperationConfig;
  [LLMOperation.SORT_BY_SIMILARITY]: OperationConfig;
  [LLMOperation.APPLY_NATURAL_LANGUAGE_FILTER]: OperationConfig;
  [LLMOperation.ENRICH_PRODUCT]: OperationConfig;
}

/**
 * Modelos disponibles por provider
 */
export const AvailableModels = {
  [LLMProvider.OPENAI]: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-3.5-turbo'
  ],
  [LLMProvider.GEMINI]: [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-1.5-pro'
  ]
} as const;
