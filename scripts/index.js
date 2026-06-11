const fs = require("fs");
const dotenv = require("dotenv");
const csv = require("csv-parser");
const UserModel = require("../models/User");
const { generatePassword } = require("../helpers/utils");
const QRCode = require("qrcode");
const { uploadBufferToS3 } = require("../helpers/awsUpload");

dotenv.config();

const generateInviteUrlQr = async (userId, route = "exhibitor-invitee", model = UserModel) => {
  try {
    //const qrData = `${process.env.FRONTEND_BASE_URL.endsWith("/") ? process.env.FRONTEND_BASE_URL : `${process.env.FRONTEND_BASE_URL}/`}register/exhibitor-invitee/exhibitor-invitee-link?id=${userId}`;
    const qrData = `${process.env.FRONTEND_BASE_URL.endsWith("/") ? process.env.FRONTEND_BASE_URL : `${process.env.FRONTEND_BASE_URL}/`}register/${route === "exhibitor-invitee" ? "exhibitor-invitee/exhibitor-invitee-link" : route}?id=${userId}`;

    const qrBuffer = await QRCode.toBuffer(qrData, {
      type: "png",
      width: 600,
    });

    const qrUpload = await uploadBufferToS3({
      buffer: qrBuffer,
      originalname: `${userId}.png`,
      mimetype: "image/png",
      context: "EXHIBITOR_QR",
      isPublic: true,
    });

    const qrUrl = qrUpload.url;

    // Determine which fields to update based on route
    let urlField = "invite_url";
    let qrField = "invite_url_qr";
    if (typeof route === "string" && route.toLowerCase().includes("rsvp")) {
      urlField = "rsvp_invite_url";
      qrField = "rsvp_invite_url_qr";
    }

    //  STEP 5: Update QR LAST (write to appropriate fields)
    const updateObj = {};
    updateObj[urlField] = qrData;
    updateObj[qrField] = qrUrl;

    await model.findByIdAndUpdate(userId, updateObj);
  } catch (error) {
    console.error(`❌ Error generating QR for user ${userId}:`, error);
  }
};

module.exports = { generateInviteUrlQr };
 