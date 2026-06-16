const mongoose = require("mongoose");


const associationVisitorSchema = new mongoose.Schema(
  {
    booking_no: { type: String, required: true, default: null },

    title: { type: String, enum: ["Mr.", "Mrs.", "Miss", "Dr.", "Ar."] },
    designation: { type: String },
    country: { type: String },

    full_name: { type: String, required: true, default: null },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    country_code: { type: String, required: true, default: "+91" },
    company_name: { type: String, required: true, default: null },
    city: { type: String, required: true, default: null },
    visiting_dates: { type: String, required: true },

    pass_selection: {
      type: String,
      enum: ["mumbai_pass", "delhi_pass"],
      required: true,
    },

    category: {
      type: String,
      enum: [
        "conference_pass",
        "silver_delegate",
        "gold_delegate",
        "platinum_delegate",
      ],
      required: true,
    },

    event_type: {
      type: String,
      enum: ["MUMBAI", "DELHI"],
      required: true,
    },


    category_price: {
      type: Number,
      default: 0,
    },

    original_price: {
      type: Number,
      default: 0,
    },

    category_discount_amount: {
      type: Number,
      default: 0,
    },

    category_discount_percentage: {
      type: Number,
      default: 0,
    },

   
    subtotal_amount: { type: Number, required: true, default: 0 },
    gst_amount: { type: Number, default: 0 },
    total_amount: { type: Number, required: true, default: 0 },
    role: {
      type: String,
      default: "ASSOCIATION VISITOR",
    },
    order_id: { type: String, default: null },
    payment_id: { type: String, default: null },
    razorpay_signature: { type: String, default: null },
    payment_status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "AUTHORIZED", "CANCELLED", "FAILED", "REFUNDED"],
      default: "PENDING",
    },
    association_visitor_qr_url: { type: String, default: null },
     association_visitor_pdf_url: { type: String, default: null },

    coupon_code: String,

    coupon_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref:"Coupon"
    },

    discount_amount: {
    type:Number,
    default:0
    },

    association_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Association",
    },

    final_payable_amount:Number,

    webhookUpdatedAt: { type: Date, default: null },
    dataSentToDashboard: { type: Boolean, default: false },
  },
  { timestamps: true },
);


module.exports = mongoose.model(
  "AssociationVisitor",
  associationVisitorSchema
);
