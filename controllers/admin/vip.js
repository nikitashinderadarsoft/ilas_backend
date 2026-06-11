const QRCode = require("qrcode");
const dotenv = require("dotenv").config();
const Vip = require("../../models/Vip");
const RelationManager = require("../../models/RelationManager");
const { uploadBufferToS3 } = require("../../helpers/awsUpload");
const path = require("path");
const PDFDocument = require("pdfkit");
const { callApi, sendDataToDashboard } = require("../../helpers/sendMsgHelper");
const { sendMailCallApi } = require("../../helpers/sendMailHelper");
const { buildBadgeValidityText } = require("../../helpers/badgeDate");
const { renderVisitorBadgePdf } = require("../../helpers/badgePdf");
const { applyQueryOptions } = require("../../helpers/query");
const { generateBadgeUrl } = require("../../helpers/utils");

const generatePdfBuffer = async ({ bgPath, qrSource, pdfData, visitingDates, invitedBy }) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [600, 800], margin: 0 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    renderVisitorBadgePdf({ doc, bgPath, qrPath: qrSource, pdfData, visitingDates, invitedBy });
    doc.end();
  });
};

const createVipBooking = async (req, res, next) => {
  try {
    const { full_name, email, phone, city, country_code, occupation, company_name, visiting_dates, invitedByRM } = req.body;

    const existingUser = await Vip.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({
        status: false,
        message: existingUser.email === email ? "Email already exists" : "Phone already exists",
      });
    }

    const bookingNo = "AceTech-" + Date.now();
    // Resolve Relation Manager name (if provided) for PDFs and dashboard
    let invitedByName = "-";
    if (invitedByRM) {
      try {
        const rm = await RelationManager.findById(invitedByRM).select("name");
        if (rm) invitedByName = rm.name;
      } catch (e) {
        // keep invitedByName as-is if lookup fails
      }
    }

    const booking = await Vip.create({
      booking_no: bookingNo,
      full_name,
      email,
      phone,
      city,
      country_code,
      occupation,
      company_name,
      visiting_dates,
      invitedByRM,
    });
    const userId = booking._id;

    const qrData = { booking_id: bookingNo, user_id: userId, name: full_name, email, phone, role: "VIP" };
    const qrBuffer = await QRCode.toBuffer(JSON.stringify(qrData), { type: "png", width: 600 });

    const qrUpload = await uploadBufferToS3({
      buffer: qrBuffer,
      originalname: `${userId}.png`,
      mimetype: "image/png",
      context: "VIP_QR",
      isPublic: true,
    });

    const qrUrl = qrUpload.url;
    const badgeData = { id: userId, visitorId: bookingNo, name: full_name, position: occupation || "-", brand: company_name || "-", role: "VIP" };
    const bgPath = path.resolve(process.cwd(), "assets/templates/vip.jpeg");
    const pdfBuffer = await generatePdfBuffer({
      bgPath,
      qrSource: qrBuffer,
      pdfData: badgeData,
      visitingDates: visiting_dates,
      invitedBy: invitedByName,
    });

    const pdfUpload = await uploadBufferToS3({
      buffer: pdfBuffer,
      originalname: `${badgeData.visitorId}.pdf`,
      mimetype: "application/pdf",
      context: "VIP_PASS",
      isPublic: true,
    });

    const badgeUrl = pdfUpload.url;

    await Vip.findByIdAndUpdate(userId, { vip_qr_url: qrUrl, vip_pdf_url: badgeUrl });

    const cleanCountryCode = (country_code || "").replace(/\D/g, "");
    const cleanPhone = (phone || "").replace(/\D/g, "");
    const toNumber = `${cleanCountryCode}${cleanPhone}`;
    const formatted = visiting_dates ? buildBadgeValidityText(visiting_dates) : "";

    try {
      await Promise.all([
        callApi({ to: toNumber, params: [full_name, buildBadgeValidityText(visiting_dates), generateBadgeUrl(booking._id)] }),
        sendMailCallApi({ 
          email, 
          name: full_name, 
          pdf_link: badgeUrl,
          // orderid: bookingNo, 
          // datebooking: formatted, 
          // qr_link: generateBadgeUrl(booking._id) 
        }),
      ]);
    } catch (notificationError) {
      console.error("VIP notification error:", notificationError);
    }

    sendDataToDashboard({
      uid: booking._id.toString(),
      firstName: booking.full_name.split(" ")[0],
      lastName: booking.full_name.split(" ").slice(1).join(" ") || "",
      jobTitle: booking.occupation || "",
      organization: booking.company_name,
      email: booking.email,
      mobile: booking.phone,
      countryCode: booking.country_code,
      country: booking.country || "",
      state: booking.state || "",
      city: booking.city || "",
      additionalData: {
        ticket_name: booking.visiting_dates.split(",").length > 2 ? "All Three Days" : buildBadgeValidityText(booking.visiting_dates, true).trim(),
        type: "VIP",
        invitedByRM: invitedByName,
      },
      label: "PAID",
      badgeUrl: badgeUrl,
    });

    booking.dataSentToDashboard = true;
    await booking.save();
    // include resolved RM name in response
    const respData = { ...booking._doc, vip_qr_url: qrUrl, vip_pdf_url: badgeUrl, invitedByRMName: invitedByName };

    return res.status(201).json({
      status: true,
      message: "VIP booking successful",
      data: respData,
    });
  } catch (error) {
    next(error);
  }
};

const getVipList = async (req, res, next) => {
  try {
    const response = await applyQueryOptions({
      model: Vip,
      req,
      searchFields: ["full_name", "email", "phone"],
      populate: { path: "invitedByRM", select: "name" },
    });
    return res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};

const getVipById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const vip = await Vip.findById(id).populate("invitedByRM", "name").lean();
    if (!vip) return res.status(404).json({ status: false, message: "VIP not found" });
    return res.status(200).json({ status: true, data: vip });
  } catch (err) {
    next(err);
  }
};

const updateVip = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await Vip.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ status: false, message: "VIP not found" });
    return res.status(200).json({ status: true, data: updated });
  } catch (err) {
    next(err);
  }
};

const deleteVip = async (req, res, next) => {
  try {
    const { id } = req.params;
    const removed = await Vip.findByIdAndDelete(id);
    if (!removed) return res.status(404).json({ status: false, message: "VIP not found" });
    return res.status(200).json({ status: true, message: "VIP deleted" });
  } catch (err) {
    next(err);
  }
};

const resendVipTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const vip = await Vip.findById(id).select("full_name email phone country_code vip_pdf_url visiting_dates booking_no");
    if (!vip) return res.status(404).json({ status: false, message: "VIP not found" });
    if (!vip.vip_pdf_url) return res.status(400).json({ status: false, message: "VIP badge not generated" });

    const cleanCountryCode = (vip.country_code || "").replace(/\D/g, "");
    const cleanPhone = (vip.phone || "").replace(/\D/g, "");
    const toNumber = `${cleanCountryCode}${cleanPhone}`;
    const formatted = vip?.visiting_dates ? buildBadgeValidityText(vip.visiting_dates) : "";

    try {
      await Promise.all([
        callApi({ to: toNumber, params: [vip.full_name, buildBadgeValidityText(vip.visiting_dates), generateBadgeUrl(vip._id)] }),
        sendMailCallApi({
          email: vip.email,
          name: vip.full_name,
          pdf_link: vip.vip_pdf_url,
          // orderid: vip.booking_no,
          // datebooking: formatted,
          // qr_link: generateBadgeUrl(vip._id),
        }),
      ]);
    } catch (notificationError) {
      console.error("Resend VIP notification error:", notificationError);
    }

    return res.status(200).json({ status: true, message: "VIP ticket resent" });
  } catch (err) {
    next(err);
  }
};

module.exports = { createVipBooking, getVipList, getVipById, updateVip, deleteVip, resendVipTicket };
