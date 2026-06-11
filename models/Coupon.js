// models/Coupon.js

const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
{
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },

  discount_type: {
    type: String,
    enum: ["PERCENTAGE", "FLAT"],
    required: true,
  },

  discount_value: {
    type: Number,
    required: true,
  },

  max_usage: {
    type: Number,
    default: null,
  },

  used_count: {
    type: Number,
    default: 0,
  },

  is_active: {
    type: Boolean,
    default: true,
  },

  valid_from: {
    type: Date,
  },

  valid_till: {
    type: Date,
  },

  description: String,
},
{
  timestamps: true,
}
);

module.exports = mongoose.model("Coupon", couponSchema);