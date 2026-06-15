const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { GetBucketLoggingCommand } = require("@aws-sdk/client-s3");

dotenv.config();

const visitorSchema = new mongoose.Schema(
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
      default: null,
    },

    category: {
      type: String,
      required: true,
    },

    // subcategory: {
    //   type: String,
    //   default: null,
    // },

    category_price: {
      type: Number,
      default: 0,
    },

    // usd_price: {
    //   type: Number,
    //   default: 0,
    // },
    // visitor_profile: { type: String, required: true, default: null },
    // interest_areas: { type: Array, required: true, default: null },
    subtotal_amount: { type: Number, required: true, default: 0 },
    gst_amount: { type: Number, default: 0 },
    total_amount: { type: Number, required: true, default: 0 },
    role: {
      type: String,
      default: "GENERAL VISITOR",
    },
    order_id: { type: String, default: null },
    payment_id: { type: String, default: null },
    razorpay_signature: { type: String, default: null },
    payment_status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "AUTHORIZED", "CANCELLED", "FAILED", "REFUNDED"],
      default: "PENDING",
    },
    visitor_qr_url: { type: String, default: null },
    visitor_pdf_url: { type: String, default: null },

    coupon_code: String,

    coupon_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref:"Coupon"
    },

    discount_amount: {
    type:Number,
    default:0
    },

    final_payable_amount:Number,

    webhookUpdatedAt: { type: Date, default: null },
    dataSentToDashboard: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const visitorModel = mongoose.model("Visitor", visitorSchema);
module.exports = visitorModel;
