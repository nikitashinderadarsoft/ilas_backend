const BusinessVisitor = require("../../models/BusinessVisitor");
const QRCode = require("qrcode");
const path = require("path");
const PDFDocument = require("pdfkit");
const { renderVisitorBadgePdf } = require("../../helpers/badgePdf");
const { callApi, sendDataToDashboard } = require("../../helpers/sendMsgHelper");
const { uploadBufferToS3 } = require("../../helpers/awsUpload");
const { buildBadgeValidityText } = require("../../helpers/badgeDate");

const generatePdfBuffer = async ({ bgPath, qrSource, pdfData, visitingDates }) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [600, 800],
      margin: 0,
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    renderVisitorBadgePdf({
      doc,
      bgPath,
      qrPath: qrSource,
      pdfData,
      visitingDates,
    });

    doc.end();
  });
};

const createBusinessVisitor = async (req, res) => {
  try {
    const {
      full_name,
      email,
      phone,
      country_code,
      city,
      business_type,
      company_name,
      designation,
      visitor_profile,
      visiting_date,
      other_designation,
      years_in_business,
      gst_number,
      website_url,
      budget_range,
      categories,
      other_category,
    } = req.body;

    // ---------------- DUPLICATE CHECK ----------------
    const existingUser = await BusinessVisitor.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      const isEmailExists = existingUser.email === email;
      const isPhoneExists = existingUser.phone === phone;

      return res.status(400).json({
        status: false,

        // Common message (always shown)
        message: "Email or phone already exists. Please use different credentials.",

        // Detailed info (optional use on frontend)
        errors: {
          email: isEmailExists ? "Email already exists" : null,
          phone: isPhoneExists ? "Phone already exists" : null,
        },
      });
    }

    // ---------------- BOOKING NO ----------------
    const bookingNo = "AceTech-" + Date.now();

    // ---------------- CREATE (ONLY SCHEMA FIELDS) ----------------
    const businessvisitor = await BusinessVisitor.create({
      booking_no: bookingNo,
      full_name,
      email,
      phone,
      country_code,
      city,
      business_type,
      role: "BUSINESS VISITOR",
      company_name,
      designation,
      visitor_profile,
      visiting_date: visiting_date || "12 June 2026",
      other_designation,
      years_in_business,
      gst_number,
      website_url,
      budget_range,
      categories,
      other_category,
    });

    const userId = businessvisitor._id;

    // ---------------- QR DATA ----------------
    const qrData = JSON.stringify({
      booking_id: bookingNo,
      user_id: userId,
      name: full_name,
      email,
      phone,
      role: "BUSINESS VISITOR",
    });

    // ---------------- QR GENERATION ----------------
    const qrBuffer = await QRCode.toBuffer(qrData, {
      type: "png",
      width: 600,
    });

    const qrUpload = await uploadBufferToS3({
      buffer: qrBuffer,
      originalname: `${userId}.png`,
      mimetype: "image/png",
      context: "BUSINESS_VISITOR_QR",
      isPublic: true,
    });

    const qrUrl = qrUpload.url;

    // ---------------- UPDATE QR ----------------
    await BusinessVisitor.findByIdAndUpdate(userId, {
      business_visitor_qr_url: qrUrl,
    });

    // generate pdf
    const pdf_data = {
      id: userId,
      visitorId: bookingNo,
      name: full_name,
      position: designation || other_designation,
      brand: company_name,
      role: "BUSINESS VISITOR",
    };

    const bgPath = path.resolve(process.cwd(), "assets/templates/business-visitor.jpeg");
    const pdfBuffer = await generatePdfBuffer({
      bgPath,
      qrSource: qrBuffer,
      pdfData: pdf_data,
      visitingDates: visiting_date,
    });

    const pdfUpload = await uploadBufferToS3({
      buffer: pdfBuffer,
      originalname: `${pdf_data.visitorId}.pdf`,
      mimetype: "application/pdf",
      context: "BUSINESS_VISITOR_PASS",
      isPublic: true,
    });

    const relativePathPdf = pdfUpload.url;

    //  Update DB
    const updatedDatapdf = await BusinessVisitor.findOneAndUpdate({ _id: pdf_data.id }, { business_visitor_pdf_url: relativePathPdf });
    // pdf code

    // send whatsapp
    const cleanCountryCode = (country_code || "").replace(/\D/g, "");
    const cleanPhone = (phone || "").replace(/\D/g, "");

    const toNumber = `${cleanCountryCode}${cleanPhone}`;

    // WhatsApp notification
    callApi({
      to: toNumber,
      params: [full_name],
      templateId: "ogviputility",
    });

    sendDataToDashboard({
      uid: businessvisitor._id.toString(),
      firstName: businessvisitor.full_name.split(" ")[0],
      lastName: businessvisitor.full_name.split(" ").slice(1).join(" ") || "",
      jobTitle: businessvisitor.designation,
      organization: businessvisitor.company_name,
      email: businessvisitor.email,
      mobile: businessvisitor.phone,
      countryCode: businessvisitor.country_code,
      country: businessvisitor.country || "",
      state: businessvisitor.state || "",
      city: businessvisitor.city || "",
      additionalData: {
        ticket_name:
          businessvisitor.visiting_date.split(",").length > 2 ? "All Three Days" : buildBadgeValidityText(businessvisitor.visiting_date, true).trim(),
        type: "BUSINESS VISITOR",
        business_type: businessvisitor.business_type,
        other_designation: businessvisitor.other_designation,
        years_in_business: businessvisitor.years_in_business,
        gst_number: businessvisitor.gst_number,
        categories: businessvisitor.categories.join(", "),
        other_category: businessvisitor.other_category,
        budget_range: businessvisitor.budget_range,
        website_url: businessvisitor.website_url,
      },
      label: "PAID",
      badgeUrl: relativePathPdf,
    });

    businessvisitor.dataSentToDashboard = true;
    await businessvisitor.save();

    // ---------------- RESPONSE ----------------
    return res.status(201).json({
      status: true,
      message: "Business visitor created successfully",
      data: {
        ...businessvisitor._doc,
        business_visitor_qr_url: qrUrl,
        business_visitor_pdf_url: relativePathPdf,
      },
    });
  } catch (error) {
    console.error("BusinessVisitor Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

module.exports = { createBusinessVisitor };
