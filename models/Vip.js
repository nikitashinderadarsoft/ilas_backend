const mongoose = require("mongoose");

const vipSchema = new mongoose.Schema(
  {
    booking_no: { type: String, required: true, default: null },
    full_name: { type: String, required: true, default: null },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    country_code: { type: String, required: true, default: "+91" },
    occupation: { type: String, default: null },
    company_name: { type: String, required: true, default: null },
    city: { type: String, default: null },
    invitedByRM: { type: mongoose.Schema.Types.ObjectId, ref: "RelationManager", default: null },
    visiting_dates: { type: String, required: true, default: null },
    role: {
      type: String,
      default: "VIP",
    },
    vip_qr_url: { type: String, default: null },
    vip_pdf_url: { type: String, default: null },
    dataSentToDashboard: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const vipModel = mongoose.model("Vip", vipSchema);
module.exports = vipModel;
