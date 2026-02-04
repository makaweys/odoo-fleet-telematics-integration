#!/bin/bash

# Comprehensive API Test Suite - Vehicle Telematics Tracker
# Run with options: ./api-tests.sh [--all|--vehicles|--location|--odoo|--geofences|--pois|--zones] [--verbose]

set -e

BASE_URL="http://localhost:5000"
VERBOSE=false
TEST_ALL=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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
        --verbose) VERBOSE=true ;;
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
            echo "  --verbose       Show detailed output"
            echo "  --help          Show this help"
            exit 0
            ;;
    esac
done

# If no specific test selected, run all
if [ "$TEST_ALL" = false ] && [ -z "$TEST_VEHICLES" ] && [ -z "$TEST_LOCATION" ] && \
   [ -z "$TEST_ODOO" ] && [ -z "$TEST_GEOFENCES" ] && [ -z "$TEST_POIS" ] && [ -z "$TEST_ZONES" ]; then
    TEST_ALL=true
fi

print_header() {
    echo -e "\n${BLUE}$1${NC}"
    echo "----------------------------------------"
}

print_success() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${GREEN}✓ $1${NC}"
    fi
}

print_error() {
    echo -e "${RED}✗ Error: $1${NC}"
    if [ "$VERBOSE" = true ] && [ -n "$2" ]; then
        echo "Response: $2"
    fi
}

test_endpoint() {
    local method=$1
    local url=$2
    local data=$3
    local description=$4
    
    if [ "$VERBOSE" = true ]; then
        echo -e "${YELLOW}Testing: $description${NC}"
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
    
    local success=$(echo "$response" | grep -o '"success":[ ]*true' || true)
    
    if [ -n "$success" ]; then
        print_success "$description"
        if [ "$VERBOSE" = true ]; then
            echo "Response: $response" | jq '.' 2>/dev/null || echo "$response"
        fi
        return 0
    else
        print_error "$description" "$response"
        return 1
    fi
}

# Generate test data
TEST_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TEST_VEHICLE_ID=99999
TEST_CUSTOMER_ID=88888
TEST_TRIP_ID=77777

echo "Vehicle Telematics API Test Suite"
echo "===================================="

# Health Check
print_header "1. Server Health"
test_endpoint "GET" "$BASE_URL/health" "" "Server health check"

if [ "$TEST_ALL" = true ] || [ -n "$TEST_VEHICLES" ]; then
    print_header "2. Vehicle API Tests"
    test_endpoint "GET" "$BASE_URL/api/vehicles" "" "Get all vehicles"
    test_endpoint "GET" "$BASE_URL/api/vehicles/dashboard-stats" "" "Get dashboard stats"
fi

if [ "$TEST_ALL" = true ] || [ -n "$TEST_ODOO" ]; then
    print_header "3. Odoo Integration Tests"
    
    # Vehicle sync
    test_endpoint "POST" "$BASE_URL/api/odoo/vehicles/sync" \
        "{\"odooVehicleId\":$TEST_VEHICLE_ID,\"name\":\"Test Truck\",\"licensePlate\":\"TEST-001\",\"deviceId\":\"test_device_$TEST_VEHICLE_ID\"}" \
        "Sync vehicle from Odoo"
    
    # Customer POI sync
    test_endpoint "POST" "$BASE_URL/api/odoo/customers/sync-poi" \
        "{\"odooCustomerId\":$TEST_CUSTOMER_ID,\"name\":\"Test Customer\",\"latitude\":-1.2921,\"longitude\":36.8219}" \
        "Sync customer POI from Odoo"
    
    # Get customer POIs
    test_endpoint "POST" "$BASE_URL/api/odoo/customers/get-pois" \
        "{\"customerIds\":[$TEST_CUSTOMER_ID]}" \
        "Get customer POIs by IDs"
    
    # Trip assignment
    test_endpoint "POST" "$BASE_URL/api/odoo/trips/assign" \
        "{\"odooVehicleId\":$TEST_VEHICLE_ID,\"odooCustomerIds\":[$TEST_CUSTOMER_ID],\"zoneId\":\"test_zone\",\"x_studio_trip_id\":$TEST_TRIP_ID}" \
        "Assign trip to vehicle"
    
    # Get active trips
    test_endpoint "GET" "$BASE_URL/api/odoo/trips/active" "" "Get active trips"
fi

if [ "$TEST_ALL" = true ] || [ -n "$TEST_GEOFENCES" ]; then
    print_header "4. Geofence API Tests"
    test_endpoint "GET" "$BASE_URL/api/geofences" "" "Get all geofences"
    
    # Create polygon geofence
    test_endpoint "POST" "$BASE_URL/api/geofences" \
        "{\"name\":\"Test Polygon\",\"type\":\"polygon\",\"path\":[{\"lat\":-1.292,\"lng\":36.821},{\"lat\":-1.291,\"lng\":36.822},{\"lat\":-1.293,\"lng\":36.823}]}" \
        "Create polygon geofence"
fi

if [ "$TEST_ALL" = true ] || [ -n "$TEST_POIS" ]; then
    print_header "5. POI API Tests"
    test_endpoint "GET" "$BASE_URL/api/pois" "" "Get all POIs"
    
    # Create POI
    test_endpoint "POST" "$BASE_URL/api/pois" \
        "{\"name\":\"Test Location\",\"location\":{\"lat\":-1.2921,\"lng\":36.8219},\"radius\":100}" \
        "Create POI"
fi

if [ "$TEST_ALL" = true ] || [ -n "$TEST_ZONES" ]; then
    print_header "6. Zone API Tests"
    test_endpoint "GET" "$BASE_URL/api/zones" "" "Get all zones"
    
    # Create zone
    test_endpoint "POST" "$BASE_URL/api/zones" \
        "{\"name\":\"Test Zone\"}" \
        "Create zone"
fi

if [ "$TEST_ALL" = true ] || [ -n "$TEST_LOCATION" ]; then
    print_header "7. Location/Traccar API Tests"
    
    # Send location update
    test_endpoint "POST" "$BASE_URL/api/traccar/location" \
        "{\"device_id\":\"test_device_$TEST_VEHICLE_ID\",\"location\":{\"coords\":{\"latitude\":-1.2921,\"longitude\":36.8219,\"speed\":45},\"is_moving\":true,\"timestamp\":\"$TEST_TIMESTAMP\"}}" \
        "Send location update"
    
    # Get active vehicles
    test_endpoint "GET" "$BASE_URL/api/traccar/vehicles/active" "" "Get active vehicles"
fi

print_header "Test Summary"
echo -e "${GREEN}All selected tests completed!${NC}"
echo -e "\nTest Data Created:"
echo "- Vehicle ID: $TEST_VEHICLE_ID"
echo "- Customer ID: $TEST_CUSTOMER_ID"
echo "- Trip ID: $TEST_TRIP_ID"
echo -e "\nRun individual tests:"
echo "./api-tests.sh --vehicles    # Test vehicle APIs"
echo "./api-tests.sh --location    # Test location APIs"
echo "./api-tests.sh --odoo        # Test Odoo integration"
echo "./api-tests.sh --geofences   # Test geofence APIs"
echo "===================================="