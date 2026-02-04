# Test the exact endpoint your Odoo automation calls
curl -X POST http://localhost:5000/api/pois/odoo-customer-poi-sync \
  -H "Content-Type: application/json" \
  -d '{
    "odooCustomerId": 12345,
    "name": "Test Customer",
    "route": "Nairobi Route A",
    "latitude": -1.2921,
    "longitude": 36.8219,
    "address": "123 Test Street, Nairobi"
  }'

# Test bulk sync
curl -X POST http://localhost:5000/api/pois/odoo-bulk-sync \
  -H "Content-Type: application/json" \
  -d '{
    "customers": [
      {
        "odooCustomerId": 1001,
        "name": "Customer One",
        "latitude": -1.2921,
        "longitude": 36.8219,
        "route": "Route A"
      },
      {
        "odooCustomerId": 1002,
        "name": "Customer Two",
        "latitude": -1.3000,
        "longitude": 36.8300,
        "route": "Route B"
      }
    ]
  }'

# Get POIs by Odoo customer IDs
curl -X POST http://localhost:5000/api/pois/by-odoo-ids \
  -H "Content-Type: application/json" \
  -d '{
    "customerIds": [1001, 1002, 1003]
  }'