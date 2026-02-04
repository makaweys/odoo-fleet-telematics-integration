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
        "route": customer.x_studio_sales_teams_relationship.name,
        "latitude": latitude,
        "longitude": longitude,
    }
    
    headers = {"Content-Type": "application/json"}
    api_url = "http://YOUR-NODE-{SERVER-IP:PORT|URL}/api/vehicles/odoo-sync"  # Replace with your actual API URL, e.g., "http://localhost:5000/api/pois/odoo-customer-poi-sync"
    
    try:
        response = requests.post(api_url, json=payload, headers=headers, timeout=5)
        if response.status_code != 200:
            raise Exception(f"Failed with status {response.status_code}: {response.text}")
    except Exception as e:
        raise UserError(f"Customer location sync failed: {str(e)}")