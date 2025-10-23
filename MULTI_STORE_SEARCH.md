# Búsqueda Multi-Tienda

## 🎯 Concepto

**Input simple** → El backend busca en todas las tiendas configuradas automáticamente

```bash
# Usuario solo envía la búsqueda
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "search": "taladro",
    "type": "open_search"
  }'

# El backend automáticamente:
# 1. Lee todas las tiendas configuradas
# 2. Genera URLs de búsqueda para cada una
# 3. Scrapea todas en paralelo
# 4. Agrupa resultados por tienda
```

## 🚀 Endpoint Principal

### POST /api/search

Busca en todas las tiendas configuradas.

**Request:**
```json
{
  "search": "taladro",
  "type": "open_search",
  "topN": 15,           // Opcional: top N más relevantes por tienda
  "filter": "..."       // Opcional: filtro en lenguaje natural
}
```

**Response:**
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
          "url": "https://...",
          "price": 49950,
          "product_name": "Taladro..."
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

## 📊 Ventajas

### 1. **Simplicidad para el Cliente**
```javascript
// Antes (por cada tienda)
await fetch('/api/scrape/url', { 
  body: JSON.stringify({ url: 'https://epa...' }) 
});
await fetch('/api/scrape/url', { 
  body: JSON.stringify({ url: 'https://novex...' }) 
});

// Ahora (automático)
await fetch('/api/search', { 
  body: JSON.stringify({ search: 'taladro', type: 'open_search' }) 
});
```

### 2. **Scraping Paralelo**
```
EPA     [====] 5.2s
Novex   [====] 4.8s
        ↓
Total:  5.2s (no 10s)
```

### 3. **Resultados Agrupados**
```json
{
  "stores": [
    { "store": "EPA", "products": [...] },
    { "store": "Novex", "products": [...] }
  ]
}
```

## 🎨 Opciones Avanzadas

### 1. Filtrado por Relevancia
```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "search": "taladro percutor",
    "type": "open_search",
    "topN": 10
  }'

# Retorna top 10 más relevantes por tienda
# EPA: 10 productos
# Novex: 10 productos
# Total: 20 productos (los mejores)
```

### 2. Filtro en Lenguaje Natural
```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "search": "taladro",
    "type": "open_search",
    "filter": "solo productos de menos de 50000 colones"
  }'

# GPT-4 interpreta y filtra en cada tienda
```

### 3. Combinado
```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "search": "taladro",
    "type": "open_search",
    "topN": 15,
    "filter": "solo inalámbricos"
  }'

# 1. Scrapea todas las tiendas
# 2. Filtra por "inalámbricos"
# 3. Retorna top 15 por tienda
```

## 🔧 Búsqueda en Tienda Específica

### POST /api/search/store/:domain

```bash
curl -X POST http://localhost:3001/api/search/store/cr.epaenlinea.com \
  -H "Content-Type: application/json" \
  -d '{
    "search": "taladro"
  }'

# Busca solo en EPA
```

## 📈 Performance

### Ejemplo Real: 2 tiendas
```
EPA:    78 productos en 5.2s
Novex:  72 productos en 4.8s
Total:  150 productos en 5.2s (paralelo)
```

### Con 5 tiendas
```
Todas en paralelo:  ~6-8s
Total productos:    300-500
```

### Con filtrado GPT-4
```
Scraping:  5-8s
Filtrado:  +3s
Total:     8-11s
```

## 💡 Casos de Uso

### 1. Búsqueda General
```json
{
  "search": "taladro",
  "type": "open_search"
}
```
→ Todos los taladros de todas las tiendas

### 2. Comparación de Precios
```javascript
const result = await search({ search: 'taladro dewalt 20v' });

// Agrupar por producto similar y comparar precios
result.stores.forEach(store => {
  console.log(`${store.store}: ₡${store.products[0].price}`);
});
```

### 3. Mejores Ofertas
```json
{
  "search": "laptop",
  "type": "open_search",
  "topN": 5,
  "filter": "las 5 ofertas más baratas"
}
```

### 4. Búsqueda Específica
```json
{
  "search": "sierra circular",
  "type": "open_search",
  "filter": "solo de marca Bosch o Makita"
}
```

## 🏗️ Arquitectura

```
┌─────────────────┐
│  POST /search   │
│  search: "..."  │
└────────┬────────┘
         │
         ▼
┌────────────────────┐
│ MultiStoreService  │
└─────────┬──────────┘
          │
    ┌─────┴──────┐
    │ Get Stores │
    │ Configured │
    └─────┬──────┘
          │
    ┌─────┴────────────┐
    │ Generate Search  │
    │ URLs per Store   │
    └─────┬────────────┘
          │
    ┌─────┴─────────────┐
    │ Scrape in Parallel│
    └─────┬─────────────┘
          │
    ┌─────┴──────────┐
    │ Group by Store │
    └─────┬──────────┘
          │
    ┌─────┴────────────┐
    │ Optional: Filter │
    │ with GPT-4       │
    └─────┬────────────┘
          │
          ▼
    ┌─────────────┐
    │  Response   │
    └─────────────┘
```

## 🎯 Tipos de Búsqueda (Futuro)

```typescript
type: 'open_search'  // Búsqueda libre ✅ Implementado
type: 'category'     // Por categoría 🔜
type: 'brand'        // Por marca 🔜
type: 'price_range'  // Rango de precio 🔜
```

## 📝 Agregar Nueva Tienda

```yaml
# 1. Crear config YAML en src/config/stores/
domain: nuevatienda.com
name: Nueva Tienda
search:
  url_template: "https://nuevatienda.com/search?q={query}"
...

# 2. Reiniciar servidor
# 3. ¡Automáticamente incluida en búsquedas!
```

## 🚨 Manejo de Errores

Si una tienda falla, las demás continúan:

```json
{
  "totalStores": 3,
  "successfulStores": 2,
  "stores": [
    {
      "store": "EPA",
      "success": true,
      "products": [...]
    },
    {
      "store": "Novex",
      "success": false,
      "error": "Timeout",
      "products": []
    },
    {
      "store": "Otra",
      "success": true,
      "products": [...]
    }
  ]
}
```

## 💰 Costos

### Sin filtrado
- **Scraping**: $0 (solo servidor)
- **Tiempo**: 5-8s
- **Total**: $0

### Con filtrado GPT-4
- **Scraping**: $0
- **Filtrado**: $0.001 por tienda
- **Tiempo**: 8-11s
- **Total**: ~$0.002 (2 tiendas)

## 📚 Ejemplos Completos

### JavaScript
```javascript
const search = async (query) => {
  const response = await fetch('http://localhost:3001/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      search: query,
      type: 'open_search',
      topN: 15
    })
  });
  
  return await response.json();
};

// Usar
const results = await search('taladro');
console.log(`Encontrados ${results.totalProducts} productos en ${results.totalStores} tiendas`);
```

### Python
```python
import requests

def search(query, top_n=15):
    response = requests.post('http://localhost:3001/api/search', json={
        'search': query,
        'type': 'open_search',
        'topN': top_n
    })
    return response.json()

# Usar
results = search('taladro')
print(f"Encontrados {results['totalProducts']} productos")
```

## 🎉 Resumen

**Antes:**
- Cliente maneja URLs
- Cliente llama a cada tienda
- Cliente agrupa resultados

**Ahora:**
- Cliente envía búsqueda simple
- Backend hace todo automáticamente
- Respuesta consolidada y lista para usar

**¡10x más simple para el cliente!**
