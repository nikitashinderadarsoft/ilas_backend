const mongoose = require("mongoose");

const associationVisitorSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    full_name: {
      type: String,
      required: true,
      trim: true,
    },

    company_name: {
      type: String,
      required: true,
      trim: true,
    },

    designation: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      required: true,
    },

    country_code: {
      type: String,
      required: true,
    },

    country: {
      type: String,
      required: true,
    },

    city: {
      type: String,
      required: true,
    },

    association_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Association",
      required: true,
    },

    booking_no: {
      type: String,
    },

    association_visitor_pdf_url: {
      type: String,
    },

    association_visitor_qr_url: {
      type: String,

    }
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "AssociationVisitor",
  associationVisitorSchema
);