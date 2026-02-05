#!/bin/bash

# Comprehensive API Test Suite - Vehicle Telematics Tracker
# Run with options: ./api-tests.sh [--all|--vehicles|--location|--odoo|--geofences|--pois|--zones|--simulator] [--verbose]

set -e

# Load port from .env file or use default
if [ -f "../.env" ]; then
    # Try to extract PORT from .env file
    PORT=$(grep -E '^PORT=' ../.env | cut -d '=' -f2)
    if [ -z "$PORT" ]; then
        PORT=$(grep -E '^GEO_PORT=' ../.env | cut -d '=' -f2)
    fi
fi

# Use default if not found
PORT=${PORT:-5000}
BASE_URL="http://localhost:$PORT"
API_URL="$BASE_URL/api"

VERBOSE=false
TEST_ALL=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse arguments
for arg in "$@"; do
    case $arg in
        --all) TEST_ALL=true ;;
        --vehicles) TEST_VEHICLES=true ;;
        --location) TEST_LOCATION=true ;;
        --odoo) TEST_ODOO=true ;;
        --geofences) TEST_GEOFENCES=true ;;
        --pois) TEST_POIS=true ;;
        --zones) TEST_ZONES=true ;;
        --simulator) TEST_SIMULATOR=true ;;
        --verbose) VERBOSE=true ;;
        --port=*)
            PORT="${arg#*=}"
            BASE_URL="http://localhost:$PORT"
            API_URL="$BASE_URL/api"
            ;;
        --url=*)
            BASE_URL="${arg#*=}"
            API_URL="$BASE_URL/api"
            ;;
        --help)
            echo "Usage: ./api-tests.sh [OPTIONS]"
            echo "Options:"
            echo "  --all           Test all endpoints"
            echo "  --vehicles      Test vehicle APIs"
            echo "  --location      Test location/Traccar APIs"
            echo "  --odoo          Test Odoo integration APIs"
            echo "  --geofences     Test geofence APIs"
            echo "  --pois          Test POI APIs"
            echo "  --zones         Test zone APIs"
            echo "  --simulator     Test simulator control APIs"
            echo "  --verbose       Show detailed output"
            echo "  --port=NUMBER   Use specific port (default: 5000 or from .env)"
            echo "  --url=URL       Use specific base URL"
            echo "  --help          Show this help"
            exit 0
            ;;
    esac
done

echo "Vehicle Telematics API Test Suite"
echo "===================================="
echo "Server: $BASE_URL"
echo "API Base: $API_URL"
echo "Port: $PORT"
echo ""

# If no specific test selected, run all
if [ "$TEST_ALL" = false ] && [ -z "$TEST_VEHICLES" ] && [ -z "$TEST_LOCATION" ] && \
   [ -z "$TEST_ODOO" ] && [ -z "$TEST_GEOFENCES" ] && [ -z "$TEST_POIS" ] && \
   [ -z "$TEST_ZONES" ] && [ -z "$TEST_SIMULATOR" ]; then
    TEST_ALL=true
fi

print_header() {
    echo -e "\n${PURPLE}$1${NC}"
    echo "--------------------------------------------------"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    if [ "$VERBOSE" = true ] && [ -n "$2" ]; then
        echo -e "${YELLOW}Response: $2${NC}"
    fi
}

test_endpoint() {
    local method=$1
    local url=$2
    local data=$3
    local description=$4
    
    if [ "$VERBOSE" = true ]; then
        echo -e "${CYAN}Testing: $description${NC}"
        echo "URL: $method $url"
        if [ -n "$data" ]; then
            echo "Data: $data"
        fi
    fi
    
    local response
    if [ -n "$data" ]; then
        response=$(curl -s -X "$method" "$url" -H "Content-Type: application/json" -d "$data" 2>/dev/null || echo '{"success":false,"error":"curl failed"}')
    else
        response=$(curl -s -X "$method" "$url" 2>/dev/null || echo '{"success":false,"error":"curl failed"}')
    fi
    
    # Check for success in various formats
    local success=$(echo "$response" | grep -o '"success":[ ]*true' || true)
    local is_running=$(echo "$response" | grep -o '"isRunning":[ ]*true' || true)
    local running=$(echo "$response" | grep -o '"running":[ ]*true' || true)
    
    if [ -n "$success" ] || [ -n "$is_running" ] || [ -n "$running" ] || \
       echo "$response" | grep -q '"status":"ok"' || \
       echo "$response" | grep -q '"vehicles":' || \
       echo "$response" | grep -q '"zones":' || \
       echo "$response" | grep -q '"geofences":' || \
       echo "$response" | grep -q '"pois":'; then
        print_success "$description"
        if [ "$VERBOSE" = true ]; then
            echo -e "${BLUE}Response:${NC}"
            echo "$response" | jq '.' 2>/dev/null || echo "$response"
            echo ""
        fi
        return 0
    else
        print_error "$description" "$response"
        if [ "$VERBOSE" = true ]; then
            echo ""
        fi
        return 1
    fi
}

# Generate test data
TEST_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TEST_VEHICLE_ID=99999
TEST_CUSTOMER_ID=88888
TEST_TRIP_ID=77777

# Health Check
print_header "1. SERVER HEALTH"
test_endpoint "GET" "$BASE_URL/health" "" "Server health check"
test_endpoint "GET" "$API_URL/socket/stats" "" "Socket.io connection statistics"
test_endpoint "GET" "$API_URL/zones/stats" "" "Zone statistics"

if [ "$TEST_ALL" = true ] || [ -n "$TEST_VEHICLES" ]; then
    print_header "2. VEHICLE API TESTS"
    
    test_endpoint "GET" "$API_URL/vehicles" "" "Get all vehicles"
    test_endpoint "GET" "$API_URL/vehicles/dashboard-stats" "" "Get dashboard statistics"
    test_endpoint "GET" "$API_URL/vehicles/online" "" "Get online vehicles"
    test_endpoint "GET" "$API_URL/vehicles/low-battery" "" "Get low battery vehicles"
    test_endpoint "GET" "$API_URL/vehicles/odoo/$TEST_VEHICLE_ID" "" "Get vehicle by Odoo ID"
    
    # Test zone assignment
    test_endpoint "POST" "$API_URL/vehicles/dummy_1/assign-zones" \
        "{\"zoneIds\":[\"test_zone_1\",\"test_zone_2\"]}" \
        "Assign zones to vehicle"
    
    test_endpoint "GET" "$API_URL/vehicles/dummy_1/zones" "" "Get assigned zones for vehicle"
fi

if [ "$TEST_ALL" = true ] || [ -n "$TEST_ODOO" ]; then
    print_header "3. ODOO INTEGRATION TESTS"
    
    # Vehicle sync (using new endpoint)
    test_endpoint "POST" "$API_URL/odoo/vehicles/sync" \
        "{\"odooVehicleId\":$TEST_VEHICLE_ID,\"name\":\"Test Truck\",\"licensePlate\":\"TEST-001\",\"deviceId\":\"test_device_$TEST_VEHICLE_ID\"}" \
        "Sync vehicle from Odoo"
    
    # Customer POI sync
    test_endpoint "POST" "$API_URL/odoo/customers/sync-poi" \
        "{\"odooCustomerId\":$TEST_CUSTOMER_ID,\"name\":\"Test Customer\",\"latitude\":-1.2921,\"longitude\":36.8219}" \
        "Sync customer POI from Odoo"
    
    # Get customer POIs
    test_endpoint "POST" "$API_URL/odoo/customers/get-pois" \
        "{\"customerIds\":[$TEST_CUSTOMER_ID]}" \
        "Get customer POIs by IDs"
    
    # Trip assignment
    test_endpoint "POST" "$API_URL/odoo/trips/assign" \
        "{\"odooVehicleId\":$TEST_VEHICLE_ID,\"odooCustomerIds\":[$TEST_CUSTOMER_ID],\"zoneId\":\"test_zone\",\"x_studio_trip_id\":$TEST_TRIP_ID}" \
        "Assign trip to vehicle"
    
    # Get active trips
    test_endpoint "GET" "$API_URL/odoo/trips/active" "" "Get active trips"
    
    # Legacy vehicle sync (backward compatibility)
    test_endpoint "POST" "$API_URL/vehicles/sync" \
        "{\"odooVehicleId\":$((TEST_VEHICLE_ID + 1)),\"name\":\"Legacy Sync Truck\",\"licensePlate\":\"LEGACY-001\",\"deviceId\":\"legacy_device\"}" \
        "Legacy Odoo vehicle sync"
fi

if [ "$TEST_ALL" = true ] || [ -n "$TEST_GEOFENCES" ]; then
    print_header "4. GEOFENCE API TESTS"
    test_endpoint "GET" "$API_URL/geofences" "" "Get all geofences"
    
    # Create polygon geofence
    test_endpoint "POST" "$API_URL/geofences" \
        "{\"name\":\"Test Polygon Area\",\"type\":\"polygon\",\"path\":[{\"lat\":-1.292,\"lng\":36.821},{\"lat\":-1.291,\"lng\":36.822},{\"lat\":-1.293,\"lng\":36.823}]}" \
        "Create polygon geofence"
fi

if [ "$TEST_ALL" = true ] || [ -n "$TEST_POIS" ]; then
    print_header "5. POI API TESTS"
    test_endpoint "GET" "$API_URL/pois" "" "Get all POIs"
    
    # Create POI
    test_endpoint "POST" "$API_URL/pois" \
        "{\"name\":\"Test Location\",\"location\":{\"lat\":-1.2921,\"lng\":36.8219},\"radius\":100}" \
        "Create POI"
    
    # Get POI by Odoo ID
    test_endpoint "GET" "$API_URL/pois/odoo/$TEST_CUSTOMER_ID" "" "Get POI by Odoo customer ID"
fi

if [ "$TEST_ALL" = true ] || [ -n "$TEST_ZONES" ]; then
    print_header "6. ZONE API TESTS"
    test_endpoint "GET" "$API_URL/zones" "" "Get all zones"
    
    # Create zone
    test_endpoint "POST" "$API_URL/zones" \
        "{\"name\":\"Test Delivery Zone\",\"description\":\"Test zone for API testing\"}" \
        "Create zone"
fi

if [ "$TEST_ALL" = true ] || [ -n "$TEST_LOCATION" ]; then
    print_header "7. LOCATION/TRACCAR API TESTS"
    
    # Send location update
    test_endpoint "POST" "$API_URL/traccar/location" \
        "{\"device_id\":\"test_device_$TEST_VEHICLE_ID\",\"location\":{\"coords\":{\"latitude\":-1.2921,\"longitude\":36.8219,\"speed\":45,\"accuracy\":15},\"is_moving\":true,\"timestamp\":\"$TEST_TIMESTAMP\"}}" \
        "Send location update"
    
    # Send location update with full data
    test_endpoint "POST" "$API_URL/traccar/location" \
        "{\"device_id\":\"T001\",\"deviceToken\":\"device_token_001\",\"location\":{\"coords\":{\"latitude\":-1.2921,\"longitude\":36.8219,\"speed\":60,\"heading\":45,\"accuracy\":10,\"altitude\":1122},\"battery\":{\"level\":0.75,\"is_charging\":false},\"odometer\":123456,\"timestamp\":\"$TEST_TIMESTAMP\",\"is_moving\":true}}" \
        "Send detailed location update"
    
    # Get active vehicles from Traccar
    test_endpoint "GET" "$API_URL/traccar/vehicles/active" "" "Get active vehicles (Traccar)"
    
    # Get vehicle status
    test_endpoint "GET" "$API_URL/traccar/vehicles/test_device_$TEST_VEHICLE_ID/status" "" "Get vehicle status"
fi

if [ "$TEST_ALL" = true ] || [ -n "$TEST_SIMULATOR" ]; then
    print_header "8. SIMULATOR CONTROL API TESTS"
    
    # Get simulator status
    test_endpoint "GET" "$API_URL/simulator/status" "" "Get simulator status"
    
    # Get simulated vehicles
    test_endpoint "GET" "$API_URL/simulator/vehicles" "" "Get simulated vehicles"
    
    # Start simulator
    test_endpoint "POST" "$API_URL/simulator/control" \
        "{\"action\":\"start\"}" \
        "Start vehicle simulator"
    
    # Wait a moment for simulator to start
    sleep 2
    
    # Get updated simulator status
    test_endpoint "GET" "$API_URL/simulator/status" "" "Get simulator status (after start)"
    
    # Trigger manual location update
    test_endpoint "POST" "$API_URL/simulator/update-locations" \
        "" \
        "Trigger manual location updates"
    
    # Add a new simulated vehicle
    test_endpoint "POST" "$API_URL/simulator/vehicles" \
        "{\"name\":\"API Test Vehicle\",\"deviceId\":\"TEST_API_001\",\"plateNumber\":\"TEST-API-001\",\"type\":\"van\",\"driver\":{\"name\":\"API Tester\",\"phone\":\"+254700123456\"}}" \
        "Add new simulated vehicle"
    
    # Get vehicles again to see the new one
    test_endpoint "GET" "$API_URL/simulator/vehicles" "" "Get simulated vehicles (after add)"
    
    # Control a specific vehicle
    test_endpoint "POST" "$API_URL/simulator/vehicles/sim_$(date +%s)/control" \
        "{\"action\":\"set_status\",\"status\":\"active\"}" \
        "Control simulated vehicle status"
    
    # Update simulator settings
    test_endpoint "PUT" "$API_URL/simulator/settings" \
        "{\"updateInterval\":15000}" \
        "Update simulator settings"
    
    # Stop simulator
    test_endpoint "POST" "$API_URL/simulator/control" \
        "{\"action\":\"stop\"}" \
        "Stop vehicle simulator"
    
    # Get final simulator status
    test_endpoint "GET" "$API_URL/simulator/status" "" "Get simulator status (after stop)"
fi

print_header "TEST SUMMARY"
echo -e "${GREEN}All selected tests completed!${NC}"
echo ""
echo -e "${BLUE}Test Data Created:${NC}"
echo "- Test Vehicle ID: $TEST_VEHICLE_ID"
echo "- Test Customer ID: $TEST_CUSTOMER_ID"
echo "- Test Trip ID: $TEST_TRIP_ID"
echo "- Timestamp: $TEST_TIMESTAMP"
echo ""
echo -e "${YELLOW}Run individual test suites:${NC}"
echo "./api-tests.sh --vehicles    # Test vehicle APIs"
echo "./api-tests.sh --location    # Test location/Traccar APIs"
echo "./api-tests.sh --odoo        # Test Odoo integration"
echo "./api-tests.sh --geofences   # Test geofence APIs"
echo "./api-tests.sh --pois        # Test POI APIs"
echo "./api-tests.sh --zones       # Test zone APIs"
echo "./api-tests.sh --simulator   # Test simulator control APIs"
echo "./api-tests.sh --port=4308   # Test on port 4308"
echo "./api-tests.sh --verbose     # Show detailed output"
echo "===================================="

# Print additional notes
echo ""
echo -e "${CYAN}Note:${NC} The simulator APIs are only available in development mode."
echo "Make sure your server is running in development mode (NODE_ENV=development)."
echo ""
echo -e "${CYAN}Testing Simulator:${NC}"
echo "1. First, test that the simulator is accessible:"
echo "   curl $API_URL/simulator/status"
echo ""
echo "2. Start the simulator:"
echo "   curl -X POST $API_URL/simulator/control \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"action\":\"start\"}'"
echo ""
echo "3. Monitor location updates in your server logs or dashboard."
echo "4. Use the simulator to test real-time features without real GPS devices."