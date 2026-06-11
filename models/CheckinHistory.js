const mongoose = require("mongoose");

const dotenv = require("dotenv");

dotenv.config(); 

const checkinHistorySchema = new mongoose.Schema(
  {
    visitor_name: {
      type: String,
      default: null,
    },
    visitor_phone: {
      type: String,
      default: null,
    },
    visitor_id: {
      type: String,
      required: true, 
      index: true    
    },
    visitor_email: {
      type: String,
      default: null,
    },
    visitor_type: {
      type: String,
      required: true, 
    },

    visitor_date: {
      type: Date,
      default: Date.now,
      index: true
    },
  },
  { timestamps: true }
);

checkinHistorySchema.index(
  { visitor_id: 1, visitor_date: 1 },
  { unique: true }
);

const CheckinHistoryModel = mongoose.model("CheckinHistory", checkinHistorySchema);
module.exports = { CheckinHistoryModel };