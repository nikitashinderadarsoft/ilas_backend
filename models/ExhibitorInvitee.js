const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const exhibitorInviteeSchema = new mongoose.Schema(
  {

    title: {
      type: String,
      enum: ["Mr.", "Mrs.", "Miss", "Dr.", "Ar."],
    },

    designation: {
      type: String,
    },

    country: {
      type: String,
    },

    booking_no: { type: String, required: true, default: null },
    exhibitor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    full_name: { type: String, required: true, default: null },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    country_code: { type: String, required: true, default: "+91" },
    company_name: { type: String, required: true, default: null },
    relationship: { type: String, required: false, default: null },
    visitor_profile: { type: String, required: true, default: null },
    visiting_dates: { type: String, required: true, default: null },
    role: {
      type: String,
      default: "EXHIBITOR INVITEE",
    },
    exhibitor_invitee_qr_url: { type: String, default: null },
    exhibitor_invitee_pdf_url: { type: String, default: null },
    dataSentToDashboard: { type: Boolean, default: false },

    coupon_code: { type: String,}
  },
  { timestamps: true },
);

const exhibitorInviteeModel = mongoose.model("ExhibitorInvitee", exhibitorInviteeSchema);
module.exports = exhibitorInviteeModel;
