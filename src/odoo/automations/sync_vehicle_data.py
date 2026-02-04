vehicle = record

driver = vehicle.driver_id

payload = {
    "odooVehicleId": vehicle.id,
    "name": vehicle.name,
    "licensePlate": vehicle.license_plate,
    "type": vehicle.model_id.name if vehicle.model_id else None,
    "driverName": driver.name if driver else None,
    "driverId": driver.id if driver else None,
    "deviceId": vehicle.x_studio_tracking_device_id or "",
    "traccarId": vehicle.x_studio_traccar_id
}

headers = {"Content-Type": "application/json"}
api_url = "YOUR-NODE-{SERVER-IP:PORT|URL}/api/vehicles/odoo-sync"

try:
    response = requests.post(api_url, json=payload, headers=headers, timeout=5)
    if response.status_code != 200:
        raise Exception(f"Failed with status {response.status_code}: {response.text}")
except Exception as e:
    raise UserError(f"Vehicle sync failed: {str(e)}")