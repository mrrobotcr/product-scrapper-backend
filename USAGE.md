# Guía de Uso - Product Scraper

## 🚀 Inicio Rápido

### 1. Búsqueda Simple (Recomendado)

```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "search": "taladro",
    "type": "open_search"
  }'
```

**Resultado:** Busca "taladro" en TODAS las tiendas configuradas automáticamente.

### 2. Búsqueda con Filtrado Inteligente

```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "search": "taladro",
    "type": "open_search",
    "topN": 15
  }'
```

**Resultado:** Top 15 productos más relevantes por tienda.

### 3. Búsqueda con Filtro en Lenguaje Natural

```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "search": "taladro",
    "type": "open_search",
    "filter": "solo productos de menos de 50000 colones"
  }'
```

## 📊 Respuesta del API

```json
{
  "success": true,
  "search": "taladro",
  "totalStores": 2,
  "successfulStores": 2,
  "totalProducts": 150,
  "duration": 8500,
  "filtered": false,
  "stores": [
    {
      "store": "EPA en línea",
      "domain": "cr.epaenlinea.com",
      "products": [
        {
          "url": "https://cr.epaenlinea.com/producto.html",
          "price": 49950,
          "product_name": "Taladro Percutor Inalámbrico 20V"
        }
      ],
      "count": 78,
      "success": true,
      "searchUrl": "https://cr.epaenlinea.com/catalogsearch/result/?q=taladro",
      "duration": 5200
    },
    {
      "store": "Novex",
      "domain": "novex.cr",
      "products": [...],
      "count": 72,
      "success": true,
      "searchUrl": "https://novex.cr/...",
      "duration": 4800
    }
  ]
}
```

## 🎯 Endpoints Disponibles

### 1. POST /api/search
**Búsqueda multi-tienda (PRINCIPAL)**

Busca en todas las tiendas configuradas automáticamente.

### 2. POST /api/search/store/:domain
**Búsqueda en tienda específica**

```bash
curl -X POST http://localhost:3001/api/search/store/cr.epaenlinea.com \
  -H "Content-Type: application/json" \
  -d '{"search": "taladro"}'
```

### 3. GET /api/stores
**Lista de tiendas configuradas**

```bash
curl http://localhost:3001/api/stores
```

### 4. POST /api/filter/rank
**Filtrado manual de productos**

Si ya tienes productos y quieres filtrarlos:

```bash
curl -X POST http://localhost:3001/api/filter/rank \
  -H "Content-Type: application/json" \
  -d '{
    "products": [...],
    "searchQuery": "taladro inalámbrico",
    "topN": 10
  }'
```

## 💡 Casos de Uso Comunes

### Búsqueda General
```json
{
  "search": "laptop",
  "type": "open_search"
}
```

### Comparación de Precios
```json
{
  "search": "taladro dewalt 20v",
  "type": "open_search",
  "topN": 5
}
```
→ Compara top 5 de cada tienda

### Mejores Ofertas
```json
{
  "search": "herramientas",
  "type": "open_search",
  "topN": 10,
  "filter": "las 10 más baratas"
}
```

### Búsqueda Específica
```json
{
  "search": "sierra circular",
  "type": "open_search",
  "filter": "solo marca Bosch o Makita"
}
```

## 🔧 Configuración

### Agregar Nueva Tienda

1. Crear archivo YAML en `src/config/stores/`

```yaml
# src/config/stores/nuevatienda.com.yaml
domain: nuevatienda.com
name: Nueva Tienda
country: CR
currency: CRC

search:
  url_template: "https://nuevatienda.com/search?q={query}"
  params:
    - name: query
      required: true

product_list:
  container: ".products-grid"
  item: ".product-item"
  selectors:
    url: "a.product-link"
    url_attribute: "href"
    title: ".product-name"
    title_attribute: "text"
    price: ".price"
    price_attribute: "text"

scraping:
  wait_time: 3000
  scroll: true
```

2. Reiniciar servidor

3. ¡Listo! Automáticamente incluida en búsquedas

### Ver Configuración de Tienda

```bash
curl http://localhost:3001/api/stores/cr.epaenlinea.com
```

## 📈 Performance

### 2 Tiendas (Actual)
- **Tiempo:** ~5-8s
- **Productos:** 150+
- **Costo:** $0

### Con Filtrado GPT-4
- **Tiempo:** +3s
- **Costo:** ~$0.002
- **Precisión:** 95%+

### 5 Tiendas (Escalable)
- **Tiempo:** ~6-10s (paralelo)
- **Productos:** 300-500+

## 🎨 Integración Frontend

### JavaScript/TypeScript

```typescript
const searchProducts = async (query: string, topN?: number) => {
  const response = await fetch('http://localhost:3001/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      search: query,
      type: 'open_search',
      topN
    })
  });
  
  return await response.json();
};

// Usar
const results = await searchProducts('taladro', 15);
console.log(`${results.totalProducts} productos en ${results.totalStores} tiendas`);

// Agrupar por tienda
results.stores.forEach(store => {
  console.log(`\n${store.store}:`);
  store.products.slice(0, 5).forEach(product => {
    console.log(`  - ${product.product_name}: ₡${product.price}`);
  });
});
```

### React

```tsx
import { useState } from 'react';

function ProductSearch() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (query: string) => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search: query,
          type: 'open_search',
          topN: 15
        })
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <SearchBar onSearch={handleSearch} />
      {loading && <Spinner />}
      {results?.stores.map(store => (
        <StoreResults key={store.domain} store={store} />
      ))}
    </div>
  );
}
```

## 🚨 Manejo de Errores

### Tienda Falla (Otras Continúan)

```json
{
  "totalStores": 3,
  "successfulStores": 2,
  "stores": [
    { "store": "EPA", "success": true, "products": [...] },
    { "store": "Novex", "success": false, "error": "Timeout" },
    { "store": "Otra", "success": true, "products": [...] }
  ]
}
```

### Sin Configuración

```json
{
  "success": false,
  "error": "No existe configuración para este dominio"
}
```

## 📚 Documentación Completa

- **MULTI_STORE_SEARCH.md** - Búsqueda multi-tienda
- **STORES_CONFIG.md** - Configuración de tiendas
- **AI_FILTERING.md** - Filtrado inteligente con IA

## 🎯 Best Practices

### 1. Usar Búsqueda Multi-Tienda
```javascript
// ✅ Recomendado
await fetch('/api/search', { body: { search: 'taladro' } });

// ❌ No recomendado (más trabajo)
await fetch('/api/scrape/url', { body: { url: 'https://...' } });
```

### 2. Aplicar Filtrado Cuando Sea Necesario
```javascript
// Sin filtro: todos los productos (rápido, gratis)
await search({ search: 'taladro' });

// Con filtro: top N (más lento, mínimo costo)
await search({ search: 'taladro', topN: 15 });
```

### 3. Cachear Resultados
```javascript
// Cachear búsquedas frecuentes
const cache = new Map();
const search = async (query) => {
  if (cache.has(query)) return cache.get(query);
  const result = await fetchSearch(query);
  cache.set(query, result);
  return result;
};
```

## 🔥 Ejemplos Avanzados

### Comparador de Precios

```typescript
const comparePrice = async (productQuery: string) => {
  const results = await searchProducts(productQuery, 5);
  
  // Encontrar mejor precio
  let bestDeal = null;
  results.stores.forEach(store => {
    store.products.forEach(product => {
      if (!bestDeal || product.price < bestDeal.price) {
        bestDeal = { ...product, store: store.store };
      }
    });
  });
  
  console.log(`Mejor precio: ${bestDeal.store} - ₡${bestDeal.price}`);
  return bestDeal;
};
```

### Búsqueda con Filtros Múltiples

```typescript
const advancedSearch = async (query: string) => {
  // 1. Búsqueda inicial
  const results = await searchProducts(query);
  
  // 2. Filtrar por precio
  const filtered = await fetch('/api/filter/natural', {
    method: 'POST',
    body: JSON.stringify({
      products: results.stores.flatMap(s => s.products),
      filterQuery: 'menos de 50000 colones'
    })
  }).then(r => r.json());
  
  // 3. Rankear por relevancia
  const ranked = await fetch('/api/filter/rank', {
    method: 'POST',
    body: JSON.stringify({
      products: filtered.products,
      searchQuery: query,
      topN: 10
    })
  }).then(r => r.json());
  
  return ranked;
};
```

## 🎉 ¡Listo!

El sistema está configurado y listo para usar. Solo envía la búsqueda y el backend hace todo el trabajo pesado automáticamente.
