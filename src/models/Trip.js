// models/Trip.js
const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema(
  {
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
    trip_id: { type: Number, required: true },
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
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Trip", tripSchema);
