const QRCode = require("qrcode");

const AssociationVisitorModel = require("../../models/AssociationVisitor");
const path =require("path");
const PDFDocument = require("pdfkit");

const {renderVisitorBadgePdf} = require("../../helpers/badgePdf");
const { sendMailCallApi } = require("../../helpers/sendMailHelper");
const {uploadBufferToS3} = require("../../helpers/awsUpload");
const { FILE_CONTEXTS } = require("../../utils/constants");

const generatePdfBuffer = async ({
  bgPath,
  qrSource,
  pdfData,
  visitingDates,
}) => {
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

const createAssociationVisitor = async (req, res, next) => {
  try {
    const { email, phone } = req.body;

    // Check duplicate email
    const existingEmail = await AssociationVisitorModel.findOne({ email });

    if (existingEmail) {
      return res.status(400).json({
        status: false,
        message: "Email already registered.",
      });
    }

    // Check duplicate phone
    const existingPhone = await AssociationVisitorModel.findOne({ phone });

    if (existingPhone) {
      return res.status(400).json({
        status: false,
        message: "Phone number already registered.",
      });
    }

    const bookingNo = "ASSOC-" + Date.now();

    const visitor = await AssociationVisitorModel.create({
      ...req.body,
      booking_no: bookingNo,
    });

    const qrData = JSON.stringify({
      booking_no: bookingNo,
      user_id: visitor._id,
      name: visitor.full_name,
      email: visitor.email,
      phone: visitor.phone,
      role: "ASSOCIATION VISITOR",
    })

    const qrBuffer = await QRCode.toBuffer(qrData, {
      type: "png",
      width: 600,
    });

    const qrUpload = await uploadBufferToS3({
      buffer: qrBuffer,
      originalname: `${visitor._id}.png`,
      mimetype: "image/png",
      context: "ASSOCIATION_VISITOR_QR",
      isPublic: true,
    });

    const qrUrl = qrUpload.url;

    await AssociationVisitorModel.findByIdAndUpdate(
      visitor._id,
      {
        association_visitor_qr_url: qrUrl,
      }
    );

    const pdfData = {
      id: visitor._id,
      visitorId: bookingNo,
      name: visitor.full_name,
      position: visitor.designation,
      brand: visitor.company_name,
      role: "ASSOCIATION VISITOR",
    };

    const bgPath = path.resolve(
      process.cwd(),
      "assets/templates/visitor.jpeg"
    );

    const pdfBuffer = await generatePdfBuffer({
      bgPath,
      qrSource: qrBuffer,
      pdfData,
      //visitingDates: "Association Visitor",
      visitingDates:"2026-10-09,2026-10-10,2026-10-11",
    });

    const pdfUpload = await uploadBufferToS3({
      buffer: pdfBuffer,
      originalname: `${bookingNo}.pdf`,
      mimetype: "application/pdf",
      context: "ASSOCIATION_VISITOR_PASS",
      isPublic: true,
    });

    await sendMailCallApi({
      email: visitor.email,
      name: visitor.full_name,
      pdf_link: pdfUpload.url,
    });

    await AssociationVisitorModel.findByIdAndUpdate(
      visitor._id,
      {
        association_visitor_pdf_url: pdfUpload.url,
      }
    );

    return res.status(201).json({
      status: true,
      data: {
        ...visitor.toObject(),
        association_visitor_qr_url: qrUrl,
        association_visitor_pdf_url: pdfUpload.url,
      },
      message: "Association visitor registered successfully.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAssociationVisitor,
};