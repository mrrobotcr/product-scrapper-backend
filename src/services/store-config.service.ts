import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { StoreConfig } from '../types/store-config.types';

export class StoreConfigService {
  private configCache: Map<string, StoreConfig> = new Map();
  private configDir: string;

  constructor() {
    this.configDir = path.join(__dirname, '../config/stores');
  }

  /**
   * Obtiene la configuración para un dominio específico
   * Busca automáticamente variantes con y sin 'www.'
   */
  getConfig(domain: string): StoreConfig | null {
    // Verificar caché
    if (this.configCache.has(domain)) {
      return this.configCache.get(domain)!;
    }

    // Generar variantes del dominio para buscar
    const variants = this.getDomainVariants(domain);
    
    // Intentar con cada variante
    for (const variant of variants) {
      const configPath = path.join(this.configDir, `${variant}.yaml`);
      
      if (fs.existsSync(configPath)) {
        try {
          const fileContents = fs.readFileSync(configPath, 'utf8');
          const config = yaml.load(fileContents) as StoreConfig;
          
          // Guardar en caché con el dominio original
          this.configCache.set(domain, config);
          
          console.log(`✅ Configuración cargada para: ${domain} (usando ${variant}.yaml)`);
          return config;
        } catch (error) {
          console.error(`❌ Error cargando configuración para ${variant}:`, error);
        }
      }
    }

    console.warn(`⚠️  No existe configuración para dominio: ${domain} (probadas variantes: ${variants.join(', ')})`);
    return null;
  }

  /**
   * Genera variantes del dominio para buscar configuraciones
   * Ej: 'www.example.com' -> ['www.example.com', 'example.com']
   */
  private getDomainVariants(domain: string): string[] {
    const variants: string[] = [domain]; // Primero intentar con el dominio exacto
    
    if (domain.startsWith('www.')) {
      // Si tiene www, agregar variante sin www
      variants.push(domain.substring(4));
    } else {
      // Si no tiene www, agregar variante con www
      variants.push(`www.${domain}`);
    }
    
    return variants;
  }

  /**
   * Obtiene la configuración basada en una URL
   */
  getConfigFromUrl(url: string): StoreConfig | null {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      return this.getConfig(domain);
    } catch (error) {
      console.error('❌ URL inválida:', url);
      return null;
    }
  }

  /**
   * Genera URL de búsqueda usando el template de la configuración
   */
  buildSearchUrl(domain: string, query: string): string | null {
    const config = this.getConfig(domain);
    if (!config) return null;

    return config.search.url_template.replace('{query}', encodeURIComponent(query));
  }

  /**
   * Lista todas las tiendas configuradas
   */
  listAvailableStores(): string[] {
    if (!fs.existsSync(this.configDir)) {
      return [];
    }

    const files = fs.readdirSync(this.configDir);
    return files
      .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
      .map(file => file.replace(/\.(yaml|yml)$/, ''));
  }

  /**
   * Limpia el caché de configuraciones
   */
  clearCache(): void {
    this.configCache.clear();
    console.log('🗑️  Caché de configuraciones limpiado');
  }
}

// Singleton
let instance: StoreConfigService | null = null;

export const getStoreConfigService = (): StoreConfigService => {
  if (!instance) {
    instance = new StoreConfigService();
  }
  return instance;
};
