const mongoose = require("mongoose");
const { Schema } = mongoose;

const RazorpayWebhookLogSchema = new Schema(
  {
    event: { type: String, index: true },
    signatureValid: { type: Boolean, default: false, index: true },
    orderId: { type: String, index: true },
    paymentId: { type: String, index: true },
    paymentStatus: { type: String, index: true },
    payload: { type: Schema.Types.Mixed },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true },
);

const RazorpayWebhookLogModel = mongoose.model(
  "RazorpayWebhookLog",
  RazorpayWebhookLogSchema,
);

module.exports = RazorpayWebhookLogModel;
