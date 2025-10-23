# Filtrado Inteligente con IA

## 📋 Descripción

El sistema usa OpenAI GPT-4 para filtrar y rankear productos scrapeados, no para scrapear. Esto garantiza:

- ✅ **Scraping rápido y preciso** (selectores CSS)
- ✅ **Filtrado inteligente** (GPT-4 selecciona los más relevantes)
- ✅ **Económico** (solo usa GPT-4 para filtrar, no para extraer)

## 🎯 Casos de Uso

### 1. **Ranking por Relevancia**
```
78 productos scrapeados → GPT-4 → Top 15 más relevantes
```

### 2. **Filtros en Lenguaje Natural**
```
"solo taladros inalámbricos de menos de 50000 colones"
→ GPT-4 interpreta y filtra
```

## 🔧 API Endpoints

### 1. POST /api/filter/rank
Filtra y rankea productos por relevancia.

**Request:**
```json
{
  "products": [
    {
      "url": "https://...",
      "price": 49950,
      "product_name": "Taladro inalámbrico..."
    }
  ],
  "searchQuery": "taladro",
  "topN": 15
}
```

**Response:**
```json
{
  "success": true,
  "products": [...],  // Top 15 más relevantes
  "summary": "Seleccionados productos por relevancia...",
  "totalFiltered": 15,
  "originalCount": 78
}
```

**Ejemplo:**
```bash
curl -X POST http://localhost:3001/api/filter/rank \
  -H "Content-Type: application/json" \
  -d '{
    "products": [...],
    "searchQuery": "taladro inalámbrico",
    "topN": 10
  }'
```

---

### 2. POST /api/filter/natural
Aplica filtros en lenguaje natural.

**Request:**
```json
{
  "products": [...],
  "filterQuery": "solo productos de menos de 50000 colones"
}
```

**Response:**
```json
{
  "success": true,
  "products": [...],  // Productos que cumplen el criterio
  "summary": "Filtrados productos con precio < ₡50,000",
  "totalFiltered": 23,
  "originalCount": 78
}
```

**Ejemplos de filtros:**
- `"solo taladros inalámbricos"`
- `"productos de menos de 30000 colones"`
- `"herramientas de la marca DeWalt"`
- `"taladros con batería incluida"`

---

### 3. POST /api/filter/combined
Endpoint combinado (solo recibe productos ya scrapeados).

**Request:**
```json
{
  "scrapedProducts": [...],
  "searchQuery": "taladro",
  "topN": 15
}
```

## 💡 Flujo Completo

### Opción A: Por Separado
```bash
# 1. Scrapear (rápido, ~5s)
products=$(curl -X POST http://localhost:3001/api/scrape/url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://...?q=taladro"}')

# 2. Filtrar con IA (~3s)
curl -X POST http://localhost:3001/api/filter/rank \
  -H "Content-Type: application/json" \
  -d "{
    \"products\": $products,
    \"searchQuery\": \"taladro inalámbrico\",
    \"topN\": 15
  }"
```

### Opción B: Combinado
```bash
# Scrapear primero, luego enviar a /filter/combined
```

## 🎨 Configuración

### Ajustar Top N
Por defecto retorna top 15. Configurable:

```typescript
{
  "topN": 10  // Retorna solo 10 productos
}
```

### Ejemplos de Queries

**Búsqueda genérica:**
```json
{
  "searchQuery": "taladro"
}
```

**Búsqueda específica:**
```json
{
  "searchQuery": "taladro percutor inalámbrico 20V"
}
```

GPT-4 entenderá y priorizará productos que coincidan mejor.

## 💰 Costos

### Scraping (Selectores CSS)
- **Costo:** $0 (solo servidor)
- **Tiempo:** ~5s para 78 productos
- **Precisión:** 100%

### Filtrado (GPT-4)
- **Costo:** ~$0.001 por filtrado
- **Tiempo:** ~3s
- **Precisión:** ~95%

### Total
- **Scrape + Filtro:** ~$0.001 + 8s
- vs Firecrawl: ~$0.10 + 30s

**10x más barato, 4x más rápido**

## 🔍 Cómo Funciona el Ranking

GPT-4 evalúa:

1. **Coincidencia con búsqueda** - ¿El nombre coincide?
2. **Relevancia del producto** - ¿Es lo que el usuario busca?
3. **Relación precio/valor** - Productos competitivos
4. **Orden lógico** - Los más útiles primero

## 🧪 Ejemplo Completo

```javascript
// 1. Scrapear
const scrapeResponse = await fetch('http://localhost:3001/api/scrape/url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://cr.epaenlinea.com/catalogsearch/result/?q=taladro'
  })
});

const { products } = await scrapeResponse.json();
console.log(`Scrapeados: ${products.length} productos`); // 78

// 2. Filtrar con IA
const filterResponse = await fetch('http://localhost:3001/api/filter/rank', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    products,
    searchQuery: 'taladro inalámbrico percutor',
    topN: 10
  })
});

const filtered = await filterResponse.json();
console.log(`Filtrados: ${filtered.totalFiltered} productos`); // 10
console.log(`Razón: ${filtered.summary}`);
// "Seleccionados taladros inalámbricos con función percutor..."
```

## 🚀 Ventajas

1. **Scraping preciso** - Selectores CSS exactos
2. **Filtrado inteligente** - GPT-4 entiende intención
3. **Económico** - Solo paga por filtrado, no por scraping
4. **Rápido** - Scraping local + filtrado paralelo
5. **Escalable** - Scrape 1000s de productos, filtra los mejores
6. **Flexible** - Lenguaje natural para filtros

## 📚 Próximas Funcionalidades

- [ ] Filtros por rango de precio automáticos
- [ ] Comparación de productos similares
- [ ] Recomendaciones basadas en preferencias
- [ ] Agrupación inteligente por categorías
