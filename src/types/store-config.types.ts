/**
 * Tipos para configuración de tiendas
 */

export interface SelectorConfig {
  [key: string]: string | SelectorConfig;
}

export interface ProductListSelectors {
  container: string;
  item: string;
  selectors: {
    url: string;
    url_attribute: string;
    title: string;
    title_attribute: string;
    price: string;
    price_attribute: string;
    currency?: string;
    currency_attribute?: string;
    image?: string;
    image_attribute?: string;
    availability?: string;
    availability_attribute?: string;
  };
}

export interface ProductDetailSelectors {
  title: string;
  price: string;
  price_attribute: string;
  description?: string;
  images?: {
    main: string;
    main_attribute: string;
    thumbnails?: string;
    thumbnails_attribute?: string;
  };
  specifications?: string;
  availability?: string;
  sku?: string;
  sku_attribute?: string;
}

export interface SearchConfig {
  url_template: string;
  params: Array<{
    name: string;
    required: boolean;
  }>;
}

export interface PaginationConfig {
  enabled: boolean;
  next_button: string;              // Selector del botón "siguiente"
  next_button_attribute: string;    // Atributo con la URL (href, data-url, etc)
  max_pages?: number;               // Límite de páginas a scrapear
  page_param?: string;              // Parámetro de página en URL (ej: "page", "p")
  current_page_selector?: string;   // Selector para página actual
  total_pages_selector?: string;    // Selector para total de páginas
}

export interface ScrapingConfig {
  wait_time: number;
  scroll: boolean;
  user_agent: string;
  wait_for_selectors?: string[];        // Selectores para página de listado/búsqueda
  wait_for_selectors_detail?: string[]; // Selectores para página de detalle individual
  pagination?: PaginationConfig;
}

export interface StoreConfig {
  domain: string;
  name: string;
  country: string;
  currency: string;
  search: SearchConfig;
  product_list: ProductListSelectors;
  product_detail: ProductDetailSelectors;
  scraping: ScrapingConfig;
}

export interface ExtractedProduct {
  url: string;
  product_name: string;
  price: number;
  currency?: string;
  image?: string;
  availability?: string;
}
