const mongoose = require("mongoose");

const conversionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  originalFiles: [
    {
      type: String,
    },
  ],
  inputFormats: [
    {
      type: String,
    },
  ],
  outputFormat: {
    type: String,
    required: true,
  },
  convertedFiles: [
    {
      type: String,
    },
  ],
  fileCount: {
    type: Number,
    default: 1,
  },
  totalSize: {
    type: Number,
  },
  processingTime: {
    type: Number, // in milliseconds
  },
  deviceType: {
    type: String,
    enum: ["mobile", "desktop", "tablet", "unknown"],
    default: "desktop",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Conversion", conversionSchema);
