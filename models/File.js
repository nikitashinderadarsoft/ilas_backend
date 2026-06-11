const mongoose = require("mongoose");
const { FILE_CONTEXTS } = require("../utils/constants");

const FileSchema = new mongoose.Schema(
  {
    bucket: {
      type: String,
      required: true,
    },

    key: {
      type: String,
      required: true,
      unique: true,
    },

    originalName: {
      type: String,
      required: true,
    },

    mimeType: {
      type: String,
      required: true,
    },

    size: {
      type: Number,
      required: true,
    },

    context: {
      type: String,
      required: true,
      enum: Object.keys(FILE_CONTEXTS),
      index: true,
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    isPublic: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

FileSchema.index({ ownerId: 1, context: 1 });
FileSchema.index({ context: 1, createdAt: -1 });

const FileModel = mongoose.model("File", FileSchema);

module.exports = FileModel;
