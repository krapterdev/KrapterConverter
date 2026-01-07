const mongoose = require("mongoose");

const apiUsageSchema = new mongoose.Schema({
  endpoint: {
    type: String,
    required: true,
  },
  method: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
  },
  responseTime: {
    type: Number,
  },
  statusCode: {
    type: Number,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("ApiUsage", apiUsageSchema);
