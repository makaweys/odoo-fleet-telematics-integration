trip = record
route = trip.x_studio_route
zone = trip.x_studio_zone
vehicle = trip.x_studio_vehicle
selected_date = trip.x_studio_trip_date_1
activated = trip.x_studio_active


# if activated and selected_date < datetime.date.today():
#     raise UserError(f"Trip date ({selected_date}) cannot be in the past.")

# Check if there are any other active trips for the same vehicle
active_trips_domain = [
    ('x_studio_vehicle', '=', vehicle.id),
    ('x_studio_active', '=', True),
    ('id', '!=', trip.id)  # Exclude current trip if it's being updated
]

existing_active_trips = env['x_trips'].search(active_trips_domain)

if activated and existing_active_trips:
    # Get the active trip details for the error message
    active_trip_info = []
    for active_trip in existing_active_trips:
        trip_date = active_trip.x_studio_trip_date_1
        date_str = trip_date.strftime('%Y-%m-%d') if trip_date else 'No date'
        active_trip_info.append(f"Trip: #{active_trip.id} {active_trip.x_name} (Date: {date_str})")
    
    error_message = f"Cannot save or activate trip. Vehicle {vehicle.display_name} already has active trips:\n"
    error_message += "\n".join(active_trip_info)
    raise UserError(error_message)

def get_date_object(input_date):
    """Convert any date-like object to a pure date object"""
    if not input_date:
        return None
    if isinstance(input_date, datetime.date):
        return input_date
    if isinstance(input_date, datetime.datetime):
        return input_date.date()
    if isinstance(input_date, str):
        try:
            return datetime.strptime(input_date, '%Y-%m-%d').date()
        except:
            return None
    return None
    

domain = [
    ('partner_id.x_studio_sales_teams_relationship', '=', route.id),
    # ('x_studio_trip_id', '!=', None),
    ('date', '=', selected_date),
    ('state', '=', 'posted'),
    ('move_type', 'in', ['out_invoice'])
]

invoices = env['account.move'].search(domain)
invoices_count = len(invoices)
# invoices.write({'x_studio_trip_id': None})


if not invoices or len(invoices) < 1:
    raise UserError("No Invoices found for the selected date and route for this trip")
    
pois = []

# One-liner using list comprehension
pois = [invoice.partner_id.id for invoice in invoices if invoice.partner_id]
invoice_data = []
total_value = 0
missing_locations = 0
for invoice in invoices:
    if invoice.partner_id:
        invoice_data.append({
            'partner_id': invoice.partner_id.id,
            'partner_name': invoice.partner_id.name,
            'route_name': invoice.partner_id.x_studio_sales_teams_relationship.name if invoice.partner_id.x_studio_sales_teams_relationship else '',
            'invoice_date': invoice.invoice_date.strftime('%Y-%m-%d') if invoice.invoice_date else '',
            'amount_total': invoice.amount_total_signed,
            'latitude': invoice.partner_id.x_studio_latitude,
            'longitude':invoice.partner_id.x_studio_latitude,
            'delivery':"UNKNOWN",
        })
        
        if not invoice.partner_id.x_studio_latitude or not invoice.partner_id.x_studio_longitude:
            missing_locations = missing_locations + 1
            
    total_value += invoice.amount_total_signed
    
        
        
payload = {
    "odooVehicleId": vehicle.id,
    "odooCustomerIds": pois,
    "zoneId": zone.x_studio_zoneid,
    'invoices_count':invoices_count,
    'total_value':total_value,
    "invoices": invoice_data,
    "x_studio_trip_id": trip.id
}

headers = {"Content-Type": "application/json"}
api_url = "YOUR-NODE-{SERVER-IP:PORT|URL}/api/vehicles/assign-trip"
if activated:
    try:
        response = requests.post(api_url, json=payload, headers=headers, timeout=5)
        if response.status_code != 200:
            raise Exception(f"Failed with status {response.status_code}: {response.text}")
        
        trip['x_studio_total_value'] = total_value
        trip['x_studio_no_of_customers'] = invoices_count
        trip['x_studio_missing_locations'] = invoices_count
        trip['x_studio_track_vehicle'] = f'<a href="MAP_APP-FRONT-END-IP|URL" target="_blank">Click Here to view vehicle on map</a>'
        # Update invoices with the trip ID after successful sync
        invoices.write({'x_studio_trip_id': trip.id})
    except Exception as e:
        raise UserError(f"Vehicle sync failed: {str(e)}")