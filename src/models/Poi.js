const mongoose = require("mongoose");

const POISchema = new mongoose.Schema({
  odooCustomerId: { type: String, required: true },
  name: { type: String, required: true },
  description: String,
  icon: String,
  radius: { type: Number, default: 100 },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  isCustomer: { type: Boolean, default: false },
  updatedOn: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

// Add indexes
poiSchema.index({ odooCustomerId: 1 }, { unique: true });
poiSchema.index({ location: '2dsphere' }); // For geospatial queries

module.exports = mongoose.model("Poi", POISchema);
