// models/Vehicle.js
const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {
    odooVehicleId: { type: Number, unique: true, required: true },
    name: { type: String, required: true },
    licensePlate: { type: String },
    type: { type: String },
    driverName: { type: String },
    icon: { type: String },
    driverId: { type: Number },
    deviceId: { type: String },
    traccarId: { type: String },
    lastTelematics: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VehicleTracking",
    },
    lastLocation: {
      currentZones: [{ type: mongoose.Schema.Types.ObjectId }],
      latitude: Number,
      longitude: Number,
      speed: Number,
      accuracy: Number,
      altitude: Number,
      odometer: Number,
      motion: Boolean,
      event: { type: String, enum: ["entry", "exit", "violation", "in_zone"] },
      battery: {
        level: Number,
        is_charging: Boolean,
      },
      Geofence: { type: mongoose.Schema.Types.ObjectId, ref: "Geofence" },
      Poi: { type: mongoose.Schema.Types.ObjectId, ref: "Poi" },
      timestamp: { type: Date, default: Date.now },
    },
    trip_id: { type: Number },
    trip_details: {
      invoices_count: { type: Number },
      total_value: { type: Number },
      invoices: [],
    },
    assignedZones: [
      {
        parentZoneId: { type: mongoose.Schema.Types.ObjectId, ref: "Zone" },
        geofences: [{ type: mongoose.Schema.Types.ObjectId, ref: "Geofence" }],
        pois: [{ type: mongoose.Schema.Types.ObjectId, ref: "Poi" }],
      },
    ],
  },
  { timestamps: true }
);

// Add to vehicleSchema definition
vehicleSchema.virtual('isOnline').get(function() {
  if (!this.lastLocation || !this.lastLocation.timestamp) return false;
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  return new Date(this.lastLocation.timestamp) > tenMinutesAgo;
});

vehicleSchema.virtual('batteryLevel').get(function() {
  return this.lastLocation?.battery?.level || null;
});

vehicleSchema.virtual('currentSpeed').get(function() {
  return this.lastLocation?.speed || 0;
});

// Ensure virtuals are included in toJSON and toObject
vehicleSchema.set('toJSON', { virtuals: true });
vehicleSchema.set('toObject', { virtuals: true });

vehicleSchema.index({ odooVehicleId: 1 }, { unique: true });
vehicleSchema.index({ deviceId: 1 });
vehicleSchema.index({ traccarId: 1 });
vehicleSchema.index({ "lastLocation.timestamp": -1 });
vehicleSchema.index({ "assignedZones.parentZoneId": 1 });

module.exports = mongoose.model("Vehicle", vehicleSchema);
