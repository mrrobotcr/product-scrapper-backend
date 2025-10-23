// Formato simple para búsqueda general
export interface SimpleProduct {
  url: string;
  price: number;
  product_name: string;
}

// Formato detallado para producto específico
export interface ProductData {
  name: string;
  price: number;
  currency: string;
  availability: string;
  image?: string;
  url: string;
  store?: string;
  description?: string;
  extractedAt: Date;
}

export interface ScrapeRequest {
  url: string;
  searchQuery?: string;
  options?: ScrapeOptions;
}

export interface ScrapeOptions {
  waitFor?: number;
  screenshot?: boolean;
  mobile?: boolean;
  timeout?: number;
  maxPages?: number;  // Limitar número de páginas a scrapear
}

export interface ScrapeResponse {
  success: boolean;
  products: SimpleProduct[];  // Búsqueda general usa formato simple
  totalFound: number;
  source: string;
  timestamp: Date;
  error?: string;
}

