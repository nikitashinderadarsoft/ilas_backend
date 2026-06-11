const mongoose = require("mongoose");
const dotenv = require("dotenv").config();

const BusinessVisitorSchema = new mongoose.Schema(
  {
    booking_no: { type: String, default: null },
    full_name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    country_code: { type: String, required: true, default: "+91" },
    city: { type: String, required: true, default: null },
    visitor_profile: { type: String, required: true, default: null },
    visiting_date: { type: String, required: true },
    role: { type: String, default: "BUSINESS VISITOR" },
    business_type: { type: String, required: true, default: null },
    company_name: { type: String, required: true, default: null },
    designation: { type: String, required: true, default: null },
    other_designation: { type: String, default: null },
    years_in_business: { type: Number, required: true, default: null },
    gst_number: { type: String, default: null },
    website_url: { type: String, default: null },
    categories: { type: Array, required: true, default: null },
    other_category: { type: String, default: null },
    budget_range: { type: String, required: true, default: null },
    business_visitor_qr_url: { type: String, default: null },
    business_visitor_pdf_url: { type: String, default: null },
    booking_status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    dataSentToDashboard: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const businessVisitorModel = mongoose.model("BusinessVisitor", BusinessVisitorSchema);
module.exports = businessVisitorModel;
