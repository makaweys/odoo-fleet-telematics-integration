const mongoose = require("mongoose");

const trackingSchema = new mongoose.Schema(
  {
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
    deviceId: String,
    latitude: Number,
    longitude: Number,
    deviceTime: Date,
    address: String,
    speed: Number,
    altitude: Number,
    batteryLevel: Number,
    motion: Boolean,
  },
  { timestamps: true }
);

module.exports = mongoose.model("VehicleTracking", trackingSchema);
