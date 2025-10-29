/**
 * Ejemplo de uso del servicio de Gemini para enriquecer productos de infesa.com
 * 
 * Este ejemplo muestra cómo usar Gemini para obtener detalles de productos
 * que solo tienen información básica (título, precio, imagen)
 */

import { getGeminiService } from '../services/gemini.service';

async function exampleSingleProduct() {
  console.log('\n📦 Ejemplo 1: Enriquecer un producto individual\n');
  
  const gemini = getGeminiService();
  
  // Datos básicos del producto (lo que obtenemos del scraping)
  const productTitle = 'CALADORA 18V';
  const imageUrl = 'https://www.infesa.com/fotos/57613.jpg';
  
  // Obtener detalles usando Gemini
  const result = await gemini.getProductDetailsFromImage(imageUrl, productTitle);
  
  if (result.success && result.details) {
    console.log('✅ Detalles obtenidos:\n');
    console.log('📝 Descripción:');
    console.log(result.details.description);
    console.log('\n🔧 Especificaciones:');
    console.log(JSON.stringify(result.details.specifications, null, 2));
    
    if (result.details.technicalInfo) {
      console.log('\n📚 Información técnica adicional:');
      console.log(result.details.technicalInfo);
    }
  } else {
    console.error('❌ Error:', result.error);
  }
}

async function exampleBatchProducts() {
  console.log('\n📦 Ejemplo 2: Enriquecer múltiples productos\n');
  
  const gemini = getGeminiService();
  
  // Lista de productos básicos (simulando datos del scraping)
  const products = [
    {
      name: 'CALADORA 18V',
      imageUrl: 'https://www.infesa.com/fotos/57613.jpg'
    },
    {
      name: 'TALADRO 1/2 20V 1 BAT BOLSO',
      imageUrl: 'https://www.infesa.com/fotos/93CD320H.jpg'
    },
    {
      name: 'SIERRA CALADORA 4.5A 650W',
      imageUrl: 'https://www.infesa.com/fotos/8700300SC.jpg'
    }
  ];
  
  // Enriquecer todos los productos
  const results = await gemini.enrichProductsBatch(products);
  
  // Mostrar resultados
  results.forEach((result, index) => {
    console.log(`\n--- Producto ${index + 1}: ${products[index].name} ---`);
    
    if (result.success && result.details) {
      console.log('✅ Enriquecido exitosamente');
      console.log(`📝 Descripción: ${result.details.description.substring(0, 100)}...`);
      console.log(`🔧 Especificaciones: ${Object.keys(result.details.specifications).length} encontradas`);
    } else {
      console.log('❌ Error:', result.error);
    }
  });
}

async function exampleIntegrationWithScraper() {
  console.log('\n📦 Ejemplo 3: Integración con scraper\n');
  
  const gemini = getGeminiService();
  
  // Simular datos del scraper (lo que obtendríamos de infesa.com)
  const scrapedProducts = [
    {
      product_name: 'CALADORA 20V 2A CON LASER',
      price: 41995,
      url: 'https://www.infesa.com/productosx.php?busqueda=caladora',
      image: 'https://www.infesa.com/fotos/93SCJS326.jpg',
      sku: '93SCJS326'
    },
    {
      product_name: 'TALADRO 1/2 Y ATORNILLADOR IMPAC 18V',
      price: 138990,
      url: 'https://www.infesa.com/productosx.php?busqueda=taladro',
      image: 'https://www.infesa.com/fotos/929914052.jpg',
      sku: '929914052'
    }
  ];
  
  // Enriquecer productos con detalles
  const enrichedProducts = [];
  
  for (const product of scrapedProducts) {
    console.log(`\n🔄 Procesando: ${product.product_name}...`);
    
    const details = await gemini.enrichProduct(product.product_name, product.image);
    
    if (details.success && details.details) {
      enrichedProducts.push({
        // Datos básicos del scraper
        ...product,
        // Datos enriquecidos por Gemini
        description: details.details.description,
        specifications: details.details.specifications,
        technicalInfo: details.details.technicalInfo,
        enrichedBy: 'gemini-2.5-flash-lite'
      });
      console.log('  ✅ Enriquecido');
    } else {
      // Si falla, guardar producto sin enriquecer
      enrichedProducts.push({
        ...product,
        enrichmentError: details.error
      });
      console.log('  ⚠️ No se pudo enriquecer');
    }
    
    // Pausa entre requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n📊 Resultados finales:');
  console.log(JSON.stringify(enrichedProducts, null, 2));
}

// Ejecutar ejemplos
async function main() {
  console.log('🚀 Iniciando ejemplos de uso de Gemini Service\n');
  console.log('=' .repeat(60));
  
  try {
    // Descomentar el ejemplo que quieras ejecutar:
    
    await exampleSingleProduct();
    // await exampleBatchProducts();
    // await exampleIntegrationWithScraper();
    
  } catch (error) {
    console.error('\n❌ Error ejecutando ejemplos:', error);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Ejemplos completados\n');
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  main();
}

export {
  exampleSingleProduct,
  exampleBatchProducts,
  exampleIntegrationWithScraper
};
