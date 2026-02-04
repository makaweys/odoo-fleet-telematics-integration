// models/Vehicle.js
const mongoose = require("mongoose");

const zoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    assignedGeofeatures: {
      geofences: [{ type: mongoose.Schema.Types.ObjectId, ref: "Geofence" }],
      pois: [{ type: mongoose.Schema.Types.ObjectId, ref: "Poi" }],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Zone", zoneSchema);
