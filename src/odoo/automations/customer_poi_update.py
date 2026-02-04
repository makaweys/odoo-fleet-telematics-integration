# Updated Odoo automation code with better error handling
latitude = record.x_studio_latitude
longitude = record.x_studio_longitude

customer = record

def is_valid_latitude(lat):
    """Check if latitude is valid (-90 to 90 degrees)"""
    try:
        lat = float(lat)
        return -90 <= lat <= 90
    except (ValueError, TypeError):
        return False

def is_valid_longitude(lon):
    """Check if longitude is valid (-180 to 180 degrees)"""
    try:
        lon = float(lon)
        return -180 <= lon <= 180
    except (ValueError, TypeError):
        return False

if latitude and longitude and is_valid_latitude(latitude) and is_valid_longitude(longitude):
    payload = {
        "odooCustomerId": customer.id,
        "name": customer.name,
        "route": customer.x_studio_sales_teams_relationship.name if customer.x_studio_sales_teams_relationship else "",
        "latitude": latitude,
        "longitude": longitude,
        "address": customer.street if customer.street else ""
    }
    
    headers = {"Content-Type": "application/json"}
    api_url = "http://YOUR-SERVER_URL/api/pois/odoo-customer-poi-sync"
    
    try:
        response = requests.post(api_url, json=payload, headers=headers, timeout=10)
        
        if response.status_code == 200:
            response_data = response.json()
            if response_data.get('success'):
                # Success - log the POI ID
                poi_id = response_data.get('data', {}).get('poiId')
                _logger.info(f"Customer {customer.id} location synced successfully. POI ID: {poi_id}")
            else:
                # API returned success: false
                error_msg = response_data.get('error', 'Unknown error')
                raise Exception(f"API error: {error_msg}")
        else:
            # HTTP error
            raise Exception(f"Failed with status {response.status_code}: {response.text}")
            
    except requests.exceptions.Timeout:
        raise UserError("Customer location sync timeout - server did not respond in time")
    except requests.exceptions.ConnectionError:
        raise UserError("Customer location sync failed - cannot connect to server")
    except Exception as e:
        _logger.error(f"Customer location sync failed: {str(e)}")
        raise UserError(f"Customer location sync failed: {str(e)}")
else:
    # Log but don't raise error for missing/invalid coordinates
    _logger.warning(f"Customer {customer.id} has invalid or missing coordinates: lat={latitude}, lng={longitude}")