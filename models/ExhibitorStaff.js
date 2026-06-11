const mongoose = require("mongoose");

const exhibitorStaffSchema = new mongoose.Schema(
  {
    staff_no: { type: String, required: true, unique: true },
    exhibitor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    created_by: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      name: { type: String, required: true },
       role: { 
        type: String, 
        enum: ["super_admin", "admin", "exhibitor"],  // ← matched with User model
        required: true 
      },
    },
    full_name: { type: String, required: true },
    display_name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    country_code: { type: String, default: "+91" },
    country: { type: String, default: null },
    role: { type: String, default: "EXHIBITOR STAFF" },
    qr_url: { type: String, default: null },
    is_deleted: {
    type: Boolean,
    default: false,
  },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ExhibitorStaff", exhibitorStaffSchema);