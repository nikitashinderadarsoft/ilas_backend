const mongoose = require("mongoose");
const { Schema } = mongoose;

const EmailHistorySchema = new Schema(
  {
    to: { type: String, required: true, index: true },
    templateId: { type: String, required: true },
    variables: { type: Object, default: {} },

    status: {
      type: String,
      enum: ["SUCCESS", "FAILED"],
      required: true,
      index: true,
    },

    referenceId: {
      type: Schema.Types.ObjectId,
      refPath: "referenceModel",
      index: true,
    },
    referenceModel: {
      type: String,
      enum: ["PurchaseOrder", "User"],
    },

    provider: { type: String, default: "MSG91" },
    providerResponse: { type: Object },
    errorMessage: { type: String },

    payload: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

const EmailHistoryModel = mongoose.model("EmailHistory", EmailHistorySchema);

module.exports = EmailHistoryModel;
