// models/VehicleLocation.js
const mongoose = require('mongoose');

const vehicleLocationSchema = new mongoose.Schema({
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle",
    required: true,
  },
  latitude: Number,
  longitude: Number,
  speed: Number,
  accuracy: Number,
  altitude: Number,
  odometer: Number,
  battery: {
    level: Number,
    is_charging: Boolean,
  },
  event: { type: String, enum: ["entry", "exit", "violation", "in_zone", "outside_zones"] },
  Geofence: { type: mongoose.Schema.Types.ObjectId, ref: "Geofence" },
  Poi: { type: mongoose.Schema.Types.ObjectId, ref: "Poi" },
  currentZones: [{ type: String }], // Add this to match Vehicle.lastLocation
  timestamp: { type: Date, default: Date.now },
});


vehicleLocationSchema.index({ vehicle: 1, timestamp: -1 });
vehicleLocationSchema.index({ timestamp: -1 });
vehicleLocationSchema.index({ event: 1 });

module.exports = mongoose.model("VehicleLocation", vehicleLocationSchema);