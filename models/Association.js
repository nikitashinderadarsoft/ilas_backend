const mongoose = require("mongoose");

const AssociationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

const AssociationModel = mongoose.model("Association", AssociationSchema);

module.exports = AssociationModel;