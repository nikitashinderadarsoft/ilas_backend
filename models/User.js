const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");

dotenv.config();

const userSchema = new mongoose.Schema(
  {
    title: { type: String, enum: ["Mr.", "Mrs.", "Miss", "Dr.", "Ar."] },
    designation: { type: String },
  

    full_name: { type: String, required: true, default: null },
    email: { type: String, required: true, default: null },
    phone: { type: String, required: true, default: null },
    country: { type: String, default: null },
    country_code: { type: String, required: true, default: null },

    company_name: { type: String, default: null },
    company_email: { type: String, default: null },
    company_phone: { type: String, default: null },
    company_phone_code: { type: String, default: null },

    invitee_limit: { type: Number, default: 5 },
    stall_size: { type: Number, default: 0 },
    contact_person: { type: String, default: null },
    invite_url: { type: String, default: null },
    invite_url_qr: { type: String, default: null },
    user_pwd: { type: String, default: null },
    password: {
      type: String,
      set: (p) => bcrypt.hashSync(p, Number(process.env.BCRYPT_ROUNDS || 10)),
      required: true,
    },
    role: {
      type: String,
      enum: ["super_admin", "admin", "exhibitor"],
      default: "exhibitor",
    },

    fcm_token: { type: String, default: null },
    is_blocked: { type: Boolean, default: false },
    is_deleted: { type: Boolean, default: false },
    deleted_at: { type: Date, default: null },

    status: {
      type: String,
      enum: ["pending", "active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true },
);

const UserModel = mongoose.model("User", userSchema);
module.exports = UserModel;
