const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, default: null },
    exhibitorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    bookingNo: { type: String, required: true, default: null },
    phone: { type: String, required: true, default: null },
    email: { type: String, required: true, default: null },
    note: { type: String, default: null },
  },
  { timestamps: true },
);

const LeadModel = mongoose.model("Lead", leadSchema);
module.exports = LeadModel;
