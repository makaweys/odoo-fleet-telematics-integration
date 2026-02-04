const mongoose = require("mongoose");

const geofenceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    type: { type: String, default: "route" },
    start: { lat: Number, lng: Number, address: String },
    end: { lat: Number, lng: Number, address: String },
    path: [
      {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
    ],
    routePolyline: [{ lat: Number, lng: Number }],
    createdAt: { type: Date, default: Date.now },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Add indexes
geofenceSchema.index({ name: 1 });
geofenceSchema.index({ type: 1 });

module.exports = mongoose.model("Geofence", geofenceSchema);
