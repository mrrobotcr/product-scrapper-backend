# Project Context

## Purpose
Sistema de comparación de precios de productos de ferretería en Costa Rica. Permite buscar productos en múltiples tiendas simultáneamente, comparar precios, y obtener filtrado inteligente usando LLMs (OpenAI y Gemini).

**Objetivos principales:**
- Scrapear múltiples tiendas de ferretería automáticamente
- Comparar precios de productos similares entre tiendas
- Filtrar y rankear productos por relevancia usando IA
- Enriquecer información de productos con análisis de imágenes
- Proporcionar una API REST para el frontend

## Tech Stack

### Backend
- **Runtime**: Node.js con TypeScript
- **Framework**: Express.js
- **Web Scraping**: Playwright (navegador headless)
- **LLM Providers**: 
  - OpenAI (GPT-4o, GPT-4o-mini)
  - Google Gemini (2.5 Flash, 2.5 Flash Lite)
- **Package Manager**: pnpm
- **Dev Tools**: ts-node-dev (hot reload)

### Frontend
- **Framework**: Nuxt 4 (Vue 3)
- **UI**: TailwindCSS
- **Icons**: Lucide Icons
- **Estado**: Composables de Vue

### Configuración
- Archivos YAML para definir tiendas y selectores CSS
- Variables de entorno para API keys
- Sistema de configuración de providers LLM en runtime

## Project Conventions

### Code Style
- **TypeScript estricto**: Tipos explícitos, interfaces bien definadas
- **Naming conventions**:
  - Archivos: `kebab-case.ts` (e.g., `llm-config.ts`)
  - Clases: `PascalCase` (e.g., `LLMService`)
  - Interfaces: `IPascalCase` o `PascalCase` (e.g., `ILLMProvider`)
  - Constantes: `UPPER_SNAKE_CASE` (e.g., `LLM_PROVIDER`)
  - Variables/funciones: `camelCase`
- **Logging**: Usar console.log con emojis descriptivos (🤖, ✅, ❌, ⚡, 💡)
- **Comentarios**: JSDoc para funciones públicas y métodos importantes
- **NO crear archivos innecesarios**: Evitar `.md`, archivos de ejemplo, o documentación extra a menos que se solicite explícitamente

### Architecture Patterns

#### Patrón de Providers (Strategy Pattern)
- **Interface común**: `ILLMProvider` define contrato para todos los LLM providers
- **Factory Pattern**: `LLMProviderFactory` selecciona provider según configuración
- **Singleton**: Servicios (e.g., `LLMService`, `GeminiService`) usan patrón singleton
- **Configuración centralizada**: `LLMConfig` gestiona providers y modelos por operación

#### Estructura de Servicios
```
services/
├── llm.service.ts              # Servicio unificado (usa factory)
├── multi-store-search.service.ts  # Orquesta búsquedas multi-tienda
├── scraper.service.ts          # Web scraping con Playwright
└── store-config.service.ts     # Carga configs YAML de tiendas
```

#### Estructura de Providers
```
providers/
├── llm-provider.factory.ts     # Factory para crear providers
├── openai.provider.ts          # Implementación OpenAI
└── gemini.provider.ts          # Implementación Gemini
```

#### Configuración de Tiendas
- Archivos YAML en `config/stores/[dominio].yaml`
- Define: nombre, URL base, selectores CSS, paginación
- Permite agregar nuevas tiendas sin cambiar código

### Testing Strategy
- **Actualmente**: Sin tests automatizados
- **Desarrollo**: Testing manual con curl y ejemplos en `examples/`
- **Futuros tests**: Unit tests para providers, integration tests para servicios

### Git Workflow
- **Branch principal**: `main`
- **No hacer commits sin permiso explícito del usuario**
- **No ejecutar comandos destructivos** sin confirmación (git push, rm, etc.)

## Domain Context

### Dominio de Negocio
- **Ferretería en Costa Rica**: Productos de construcción, herramientas, materiales
- **Moneda**: Colones costarricenses (₡)
- **Tiendas soportadas**: 
  - ellagar.com
  - infesa.com
  - (Extensible a más tiendas vía YAML)

### Tipos de Productos
- Herramientas eléctricas (taladros, sierras, etc.)
- Herramientas manuales
- Materiales de construcción
- Repuestos y accesorios

### Operaciones LLM
1. **Filtrado por Relevancia** (`FILTER_BY_RELEVANCE`)
   - Selecciona productos más relevantes según query
   - Excluye accesorios y consumibles
   - Default: Gemini 2.5 Flash Lite

2. **Ordenamiento por Similaridad** (`SORT_BY_SIMILARITY`)
   - Agrupa productos similares entre tiendas
   - Facilita comparación
   - Default: Gemini 2.5 Flash

3. **Filtro en Lenguaje Natural** (`APPLY_NATURAL_LANGUAGE_FILTER`)
   - Filtros complejos en lenguaje humano
   - Default: OpenAI GPT-4o-mini

4. **Enriquecimiento de Productos** (`ENRICH_PRODUCT`)
   - Análisis de imágenes para extraer especificaciones
   - Útil para tiendas sin páginas de detalle
   - Default: Gemini 2.5 Flash Lite

## Important Constraints

### Técnicas
- **NUNCA ejecutar `npm run dev`, `pnpm dev` sin permiso**: Deja procesos corriendo en segundo plano
- **Rate limiting**: Pausas entre requests para evitar bloqueos
- **Memory**: Limitar productos a analizar (máx 50 por operación LLM)
- **API Keys requeridas**: `OPENAI_API_KEY` y `GEMINI_API_KEY`

### Legales/Éticas
- **Web scraping responsable**: Respetar robots.txt, no saturar servidores
- **Usar datos solo para comparación de precios**

### Performance
- **Scraping paralelo**: Múltiples tiendas a la vez
- **Pre-filtrado**: Reducir productos antes de LLM
- **Modelos rápidos**: Preferir Flash/Lite para operaciones frecuentes

## External Dependencies

### APIs de LLM
- **OpenAI API**: 
  - Modelos: gpt-4o, gpt-4o-mini, gpt-3.5-turbo
  - Uso: Filtros con mejor comprensión de contexto
  - Costo: Mayor, pero mejor calidad

- **Google Gemini API**:
  - Modelos: gemini-2.5-flash, gemini-2.5-flash-lite
  - Uso: Filtrado rápido, análisis de imágenes
  - Costo: Menor, mejor para operaciones frecuentes

### Servicios Web
- **Playwright**: Scraping con navegador headless
- **Tiendas target**: APIs no disponibles, requiere scraping HTML

### Configuración Dinámica
- **LLM Provider Configuration**: Cambiar provider/modelo sin recompilar
- **Store Configuration**: Agregar tiendas vía YAML
