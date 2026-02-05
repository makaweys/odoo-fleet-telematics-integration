const mongoose = require("mongoose");

const violationSchema = new mongoose.Schema({
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle",
    required: true,
  },
  type: { type: String, enum: ["entry", "exit"], required: true },
  reason: String,
  violatedZones: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      required: false,
    },
  ],
  zoneId: mongoose.Schema.Types.ObjectId,
  zoneType: { type: String, enum: ["poi", "geofence"] },
  zoneName: String,
  location: { lat: Number, lng: Number },
  speed: Number,
  altitude: Number,
  motion: Boolean,
  timestamp: { type: Date, default: Date.now },
});


// indexes
violationSchema.index({ vehicleId: 1, timestamp: -1 });
violationSchema.index({ timestamp: -1 });
violationSchema.index({ violatedZones: 1 });

module.exports = mongoose.model("Violation", violationSchema);
