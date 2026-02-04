// models/ZoneEvent.js
const mongoose = require("mongoose");

const zoneEventSchema = new mongoose.Schema({
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle",
    required: true,
  },
  zoneId: { type: String, required: true },
  zoneName: String,
  zoneType: { type: String, enum: ["geofence", "poi"], required: true },
  event: { type: String, enum: ["entry", "exit"], required: true },
  location: {
    latitude: Number,
    longitude: Number,
  },
  speed: Number,
  altitude: Number,
  motion: Boolean,
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ZoneEvent", zoneEventSchema);
