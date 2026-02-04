# Vehicle Telematics Tracker

A real-time vehicle tracking system with geofencing, zone violation detection, and live location updates via WebSocket.

## Features

- **Real-time Tracking**: Live vehicle location updates via WebSocket
- **Geofencing**: Define zones and monitor vehicle entry/exit
- **Violation Detection**: Alert when vehicles violate assigned zones
- **POI Management**: Points of interest with radius-based detection
- **Vehicle Simulator**: Test system with simulated vehicle movements
- **REST API**: Manage vehicles, zones, and view violations

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB (with dummy data fallback)
- **Real-time**: Socket.io
- **Geospatial**: Geolib, custom zone checking
- **Testing**: Vehicle simulator included

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/vehicle-telematics-tracker.git
   cd vehicle-telematics-tracker
   ```
