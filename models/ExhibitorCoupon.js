const mongoose = require("mongoose");

const exhibitorCouponSchema = new mongoose.Schema(
  {
    exhibitor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    coupon_code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    is_used: {
      type: Boolean,
      default: false,
    },

    used_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExhibitorInvitee",
      default: null,
    },

    used_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "ExhibitorCoupon",
  exhibitorCouponSchema
);