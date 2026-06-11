const mongoose = require("mongoose");

const RelationManagerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    invite_url: { type: String },
    invite_url_qr: { type: String },
    // Reserved for future RSVP invite support. Not shown on frontend by default.
    rsvp_invite_url: { type: String },
    rsvp_invite_url_qr: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const RelationManagerModel = mongoose.model("RelationManager", RelationManagerSchema);

module.exports = RelationManagerModel;
