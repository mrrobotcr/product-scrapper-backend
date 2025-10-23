#!/bin/bash

# Ejemplos de uso de la API usando cURL

echo "=== Health Check ==="
curl http://localhost:3001/health
echo -e "\n"

echo "=== Scraping Service Status ==="
curl http://localhost:3001/api/scrape/status
echo -e "\n"

echo "=== Scrape Single URL - Example with Costa Rica store ==="
curl -X POST http://localhost:3001/api/scrape/url \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://cr.epaenlinea.com/catalogsearch/result/?q=taladro",
    "options": {
      "timeout": 172800000
    }
  }'
echo -e "\n"

echo "=== Search Products ==="
curl -X POST http://localhost:3001/api/scrape/search \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.example-store.com/search",
    "searchQuery": "laptop",
    "options": {
      "waitFor": 3000
    }
  }'
echo -e "\n"

echo "=== Crawl Site ==="
curl -X POST http://localhost:3001/api/scrape/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.example-store.com",
    "options": {
      "timeout": 60000
    }
  }'
echo -e "\n"
