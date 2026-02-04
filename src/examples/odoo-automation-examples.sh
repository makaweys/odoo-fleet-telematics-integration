#!/bin/bash

# Odoo Automation Examples - Vehicle Telematics Tracker
# This file contains example curl commands for Odoo automation scenarios

set -e

# Load port from .env file or use default
if [ -f "../.env" ]; then
    # Try to extract PORT from .env file
    PORT=$(grep -E '^PORT=' ../.env | cut -d '=' -f2)
    if [ -z "$PORT" ]; then
        PORT=$(grep -E '^GEO_PORT=' ../.env | cut -d '=' -f2)
    fi
    if [ -z "$PORT" ]; then
        # Try PORT_CODE2 for SMS sender port
        PORT=$(grep -E '^PORT_CODE2=' ../.env | cut -d '=' -f2)
    fi
fi

# Use default if not found
PORT=${PORT:-5000}
BASE_URL="http://localhost:$PORT"
API_URL="$BASE_URL/api"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "🚚 Odoo Automation Examples"
echo "============================"
echo "Server: localhost:$PORT"
echo "API Base: $API_URL"
echo "Timestamp: $TIMESTAMP"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

print_section() {
    echo -e "\n${PURPLE}$1${NC}"
    echo "--------------------------------------------------"
}

run_example() {
    local title="$1"
    local command="$2"
    local description="$3"
    
    echo -e "${CYAN}$title${NC}"
    if [ -n "$description" ]; then
        echo -e "${BLUE}Description: $description${NC}"
    fi
    echo -e "${YELLOW}Command:${NC}"
    echo "$command"
    echo ""
    echo -e "${GREEN}Running...${NC}"
    
    # Actually run the command
    eval "$command" 2>/dev/null || echo "Command failed or server not responding"
    
    echo ""
    echo "--------------------------------------------------"
}

# Function to create a test API call
create_api_call() {
    local endpoint="$1"
    local method="$2"
    local data="$3"
    
    echo "curl -s -X '$method' '$API_URL$endpoint' \\
      -H 'Content-Type: application/json' \\
      -d '$data'"
}

# ==================== 1. VEHICLE SYNC AUTOMATION ====================
print_section "1. VEHICLE SYNC AUTOMATION"
echo "Trigger: When vehicle is created/updated in Odoo Fleet"
echo "Endpoint: POST $API_URL/odoo/vehicles/sync"

# Example 1.1: Sync new delivery truck
run_example "Example 1.1: Sync Delivery Truck" \
"$(create_api_call "/odoo/vehicles/sync" "POST" '{
  "odooVehicleId": 1001,
  "name": "Delivery Truck 01",
  "licensePlate": "KAA-123A",
  "type": "Isuzu NQR",
  "driverName": "John Kamau",
  "driverId": 501,
  "deviceId": "traccar_device_001",
  "traccarId": "traccar_001"
}')" \
"Sync a new delivery truck from Odoo to telematics system"

# Example 1.2: Sync bakery van
run_example "Example 1.2: Sync Bakery Van" \
"$(create_api_call "/odoo/vehicles/sync" "POST" '{
  "odooVehicleId": 1002,
  "name": "Bakery Van 02",
  "licensePlate": "KBB-456B",
  "type": "Toyota Hiace",
  "driverName": "Peter Mwangi",
  "driverId": 502,
  "deviceId": "traccar_device_002",
  "traccarId": "traccar_002"
}')" \
"Sync a bakery van for daily bread deliveries"

# Example 1.3: Update existing vehicle
run_example "Example 1.3: Update Vehicle Details" \
"$(create_api_call "/odoo/vehicles/sync" "POST" '{
  "odooVehicleId": 1001,
  "name": "Updated Delivery Truck 01",
  "licensePlate": "KAA-123A",
  "type": "Isuzu NQR 2024",
  "driverName": "John Kamau",
  "driverId": 501,
  "deviceId": "traccar_device_001_updated",
  "traccarId": "traccar_001"
}')" \
"Update vehicle details when changed in Odoo"

# ==================== 2. CUSTOMER POI SYNC AUTOMATION ====================
print_section "2. CUSTOMER POI SYNC AUTOMATION"
echo "Trigger: When customer is created/updated in Odoo"
echo "Endpoint: POST $API_URL/odoo/customers/sync-poi"

# Example 2.1: Sync supermarket customer
run_example "Example 2.1: Sync Supermarket Customer" \
"$(create_api_call "/odoo/customers/sync-poi" "POST" '{
  "odooCustomerId": 2001,
  "name": "Nairobi Supermarket",
  "route": "Central Route",
  "latitude": -1.2921,
  "longitude": 36.8219,
  "address": "Moi Avenue, Nairobi CBD"
}')" \
"Sync supermarket location as a POI for delivery tracking"

# Example 2.2: Sync hotel customer
run_example "Example 2.2: Sync Hotel Customer" \
"$(create_api_call "/odoo/customers/sync-poi" "POST" '{
  "odooCustomerId": 2003,
  "name": "Safari Park Hotel",
  "route": "Thika Road Route",
  "latitude": -1.2142,
  "longitude": 36.8997,
  "address": "Thika Road, Nairobi"
}')" \
"Sync hotel location for daily bread deliveries"

# ==================== 3. TRIP ASSIGNMENT AUTOMATION ====================
print_section "3. TRIP ASSIGNMENT AUTOMATION"
echo "Trigger: When trip is created/activated in Odoo"
echo "Endpoint: POST $API_URL/odoo/trips/assign"

# Example 3.1: Assign morning delivery trip
run_example "Example 3.1: Assign Morning Delivery Trip" \
"$(create_api_call "/odoo/trips/assign" "POST" '{
  "odooVehicleId": 1001,
  "odooCustomerIds": [2001, 2002, 2003],
  "zoneId": "zone_nairobi_central",
  "x_studio_trip_id": 3001,
  "invoices_count": 3,
  "total_value": 45000.50,
  "invoices": [
    {
      "partner_id": 2001,
      "partner_name": "Nairobi Supermarket",
      "invoice_date": "'"$(date +%Y-%m-%d)"'",
      "amount_total": 15000.00
    },
    {
      "partner_id": 2002,
      "partner_name": "Westgate Bakery",
      "invoice_date": "'"$(date +%Y-%m-%d)"'",
      "amount_total": 20000.50
    },
    {
      "partner_id": 2003,
      "partner_name": "Safari Park Hotel",
      "invoice_date": "'"$(date +%Y-%m-%d)"'",
      "amount_total": 10000.00
    }
  ]
}')" \
"Assign a delivery trip with multiple customer stops"

# ==================== 4. BULK OPERATIONS ====================
print_section "4. BULK OPERATIONS"
echo "For initial sync or batch updates"

# Example 4.1: Bulk sync customer POIs
run_example "Example 4.1: Bulk Sync Customer POIs" \
"$(create_api_call "/odoo/customers/bulk-sync-pois" "POST" '{
  "customers": [
    {
      "odooCustomerId": 2010,
      "name": "Karen Hub",
      "latitude": -1.3195,
      "longitude": 36.7081,
      "route": "Karen Route",
      "address": "Karen Shopping Centre"
    },
    {
      "odooCustomerId": 2011,
      "name": "Runda Stores",
      "latitude": -1.2183,
      "longitude": 36.8197,
      "route": "Runda Route",
      "address": "Runda Estate"
    }
  ]
}')" \
"Bulk sync multiple customers at once (initial setup)"

# ==================== 5. VERIFICATION & MONITORING ====================
print_section "5. VERIFICATION & MONITORING"
echo "Check status after automations run"

# Check vehicle sync
run_example "Check Vehicle Sync" \
"curl -s -X GET '$API_URL/vehicles/odoo/1001'" \
"Verify vehicle was synced successfully"

# Check POI sync
run_example "Check POI Sync" \
"curl -s -X GET '$API_URL/pois/odoo/2001'" \
"Verify customer POI was created"

# Check active trips
run_example "Check Active Trips" \
"curl -s -X GET '$API_URL/odoo/trips/active'" \
"List all active delivery trips"

# Check vehicle dashboard
run_example "Check Dashboard Stats" \
"curl -s -X GET '$API_URL/vehicles/dashboard-stats'" \
"Get delivery dashboard statistics"

# ==================== 6. COMPLETE AUTOMATION WORKFLOW ====================
print_section "6. COMPLETE DAILY WORKFLOW"

cat << EOF
${CYAN}Daily Bakery Delivery Automation Workflow:${NC}

${BLUE}Morning (6:00 AM) - Preparation:${NC}
1. Sync all delivery vehicles from Odoo
   ${YELLOW}POST $API_URL/odoo/vehicles/sync${NC}

2. Sync any new customer locations
   ${YELLOW}POST $API_URL/odoo/customers/sync-poi${NC}

${BLUE}Delivery Time (8:00 AM) - Trip Assignment:${NC}
3. Assign morning delivery trips
   ${YELLOW}POST $API_URL/odoo/trips/assign${NC}

${BLUE}Throughout Day - Monitoring:${NC}
4. Monitor vehicle locations in real-time
   ${YELLOW}GET $API_URL/traccar/vehicles/active${NC}

5. Check for violations
   ${YELLOW}GET $API_URL/vehicles/dashboard-stats${NC}

${BLUE}Afternoon (1:00 PM) - Second Shift:${NC}
6. Assign afternoon delivery trips

${BLUE}Evening (6:00 PM) - Completion:${NC}
7. Complete finished trips
   ${YELLOW}POST $API_URL/odoo/trips/complete${NC}

${BLUE}End of Day - Reporting:${NC}
8. Generate delivery reports
   ${YELLOW}GET $API_URL/vehicles/dashboard-stats${NC}
EOF
echo ""
echo -e "${GREEN} Odoo Automation Examples Ready!${NC}"
echo "============================"
echo ""
echo -e "${YELLOW}Usage Tips:${NC}"
echo "1. Copy any command above for your Odoo automations"
echo "2. Replace example IDs with your actual Odoo IDs"
echo "3. Test with --port option if using different port:"
echo "   ./odoo-automation-examples.sh  # Will auto-detect port from .env"
echo "4. Use these endpoints in your Odoo Python automations"
echo ""
echo -e "${BLUE}Common Odoo Automation Scenarios:${NC}"
echo "- Vehicle created/updated → POST /odoo/vehicles/sync"
echo "- Customer created/updated → POST /odoo/customers/sync-poi"
echo "- Trip activated → POST /odoo/trips/assign"
echo "- Trip completed → POST /odoo/trips/complete"
echo ""
echo -e "${GREEN}Happy Automating!${NC}"