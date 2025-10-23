import * as cheerio from 'cheerio';
import { PaginationConfig } from '../types/store-config.types';

export interface PaginationInfo {
  hasNextPage: boolean;
  nextPageUrl?: string;
  currentPage?: number;
  totalPages?: number;
}

/**
 * Servicio para detectar y manejar paginación
 */
export class PaginationService {
  /**
   * Detecta si hay más páginas y obtiene la URL de la siguiente
   */
  detectPagination(html: string, config: PaginationConfig, currentUrl: string): PaginationInfo {
    if (!config.enabled) {
      return { hasNextPage: false };
    }

    const $ = cheerio.load(html);

    // Buscar botón de siguiente página
    const nextButton = $(config.next_button);
    
    if (nextButton.length === 0) {
      console.log('  ℹ️  No se encontró botón de siguiente página');
      return { hasNextPage: false };
    }

    // Obtener URL de siguiente página
    let nextPageUrl = '';
    if (config.next_button_attribute === 'text') {
      nextPageUrl = nextButton.text().trim();
    } else {
      nextPageUrl = nextButton.attr(config.next_button_attribute)?.trim() || '';
    }

    if (!nextPageUrl) {
      console.log('  ℹ️  Botón de siguiente página no tiene URL');
      return { hasNextPage: false };
    }

    // Hacer la URL absoluta si es relativa
    if (!nextPageUrl.startsWith('http')) {
      const baseUrl = new URL(currentUrl).origin;
      nextPageUrl = nextPageUrl.startsWith('/') 
        ? `${baseUrl}${nextPageUrl}` 
        : `${baseUrl}/${nextPageUrl}`;
    }

    // Detectar página actual (opcional)
    let currentPage: number | undefined;
    if (config.current_page_selector) {
      const currentPageText = $(config.current_page_selector).text().trim();
      currentPage = parseInt(currentPageText) || undefined;
    }

    // También se puede detectar desde la URL
    if (!currentPage && config.page_param) {
      const urlObj = new URL(currentUrl);
      const pageParam = urlObj.searchParams.get(config.page_param);
      currentPage = pageParam ? parseInt(pageParam) : 1;
    }

    // Detectar total de páginas (opcional)
    let totalPages: number | undefined;
    if (config.total_pages_selector) {
      const totalPagesText = $(config.total_pages_selector).text().trim();
      totalPages = parseInt(totalPagesText) || undefined;
    }

    console.log(`  📄 Paginación detectada: página ${currentPage || '?'} de ${totalPages || '?'}`);
    console.log(`  ➡️  Siguiente: ${nextPageUrl}`);

    return {
      hasNextPage: true,
      nextPageUrl,
      currentPage,
      totalPages
    };
  }

  /**
   * Verifica si se debe continuar paginando
   */
  shouldContinuePagination(
    currentPageNum: number,
    config: PaginationConfig,
    paginationInfo: PaginationInfo
  ): boolean {
    // Verificar límite de páginas
    if (config.max_pages && currentPageNum >= config.max_pages) {
      console.log(`  🛑 Límite de páginas alcanzado: ${config.max_pages}`);
      return false;
    }

    // Verificar si hay siguiente página
    if (!paginationInfo.hasNextPage || !paginationInfo.nextPageUrl) {
      console.log('  🏁 No hay más páginas');
      return false;
    }

    // Verificar si ya llegamos al total de páginas
    if (paginationInfo.totalPages && paginationInfo.currentPage) {
      if (paginationInfo.currentPage >= paginationInfo.totalPages) {
        console.log('  🏁 Última página alcanzada');
        return false;
      }
    }

    return true;
  }

  /**
   * Extrae el número de página de una URL
   */
  extractPageNumber(url: string, pageParam: string = 'page'): number {
    try {
      const urlObj = new URL(url);
      const pageStr = urlObj.searchParams.get(pageParam);
      return pageStr ? parseInt(pageStr) : 1;
    } catch {
      return 1;
    }
  }
}

// Singleton
let instance: PaginationService | null = null;

export const getPaginationService = (): PaginationService => {
  if (!instance) {
    instance = new PaginationService();
  }
  return instance;
};
