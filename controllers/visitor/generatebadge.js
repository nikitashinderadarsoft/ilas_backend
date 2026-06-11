const QRCode = require("qrcode");
const { createCanvas, loadImage } = require("canvas");
const { uploadBufferToS3 } = require("../../helpers/awsUpload");

async function generateBadge(data) {
  const { bookingNo, fullName, jobTitle, companyName, email, phone } = data;

  const width = 180;
  const height = 220;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#000";

  // FULL NAME
  ctx.font = "bold 16px Arial";
  ctx.fillText(fullName, width / 2, 30);

  // JOB TITLE
  ctx.font = "14px Arial";
  ctx.fillText(jobTitle, width / 2, 55);

  // COMPANY NAME
  ctx.font = "12px Arial";
  ctx.fillText(companyName, width / 2, 75);

  // QR DATA
  const qrData = JSON.stringify({
    bookingNo,
    name: fullName,
    email,
    phone,
  });

  const qrImage = await QRCode.toDataURL(qrData);
  const qr = await loadImage(qrImage);

  const qrSize = 100;
  const qrX = (width - qrSize) / 2;
  const qrY = 100;

  ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

  // FOOTER
  ctx.font = "bold 9px Arial";
  ctx.fillText("Powered by RadarSoft Technologies", width / 2, 212);

  //   ctx.font = "12px Arial";
  //   ctx.fillText("Technologies", width / 2, 235);

  const buffer = canvas.toBuffer("image/png");

  const upload = await uploadBufferToS3({
    buffer,
    originalname: `${bookingNo}.png`,
    mimetype: "image/png",
    context: "BOOKING_QR",
    createFileRecord: false,
    isPublic: true,
  });

  return upload.url;
}

module.exports = generateBadge;
