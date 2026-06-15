const AssociationVisitor = require("../../models/AssociationVisitor");
const QRCode = require("qrcode");
const path = require("path");
const Razorpay = require("razorpay");

const { validateCoupon } = require("../../helpers/couponService");
const { uploadBufferToS3 } = require("../../helpers/awsUpload");
const { renderVisitorBadgePdf } = require("../../helpers/badgePdf");

const PDFDocument = require("pdfkit");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const EVENT_DAY_CLOSE_DATES = {
  mumbai_pass: new Date("2026-11-20"),
  delhi_pass: new Date("2026-12-18"),
};

const getClosedDays = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Object.entries(EVENT_DAY_CLOSE_DATES)
    .filter(([_, closeDate]) => closeDate < today)
    .map(([dayKey]) => dayKey);
};


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

const BASE_PRICING = {
  conference_pass: 5000,
  silver_delegate: 10000,
  gold_delegate: 15000,
  platinum_delegate: 20000,
};

const getAssociationPrice = (category) => {
  return BASE_PRICING[category] * 0.5;
};

const createAssociationVisitor = async (req, res) => {
  try {
    const {
      full_name,
      email,
      phone,
      city,
      title,
      designation,
      country,
      country_code,
      company_name,
      visiting_dates,
      // visitor_profile,
      // interest_areas,
      // subtotal_amount,
      // gst_amount,
      // total_amount,
      coupon_code,
      category,
      // subcategory,
      // usd_price,
      pass_selection,
      event_type,
      association_id,
    } = req.body;

    // ================= CLOSED DAY VALIDATION =================
    const passSelection = req.body.pass_selection || "";
    const closedDays = getClosedDays();

    if (closedDays.includes(passSelection)) {
      return res.status(400).json({
        status: false,
        message: "Registration for selected event is closed.",
      });
    }

   if (!BASE_PRICING[category]) {
      return res.status(400).json({
        status: false,
        message: "Invalid category",
      });
    }

    let payableAmount = getAssociationPrice(category);

    let discountAmount = 0;

    let couponDoc = null;

   if (coupon_code && coupon_code.trim()) {

          const result = await validateCoupon(
            coupon_code,
            payableAmount
          );

          if (!result.valid) {
            return res.status(400).json({
              status: false,
              message: result.message
            });
          }

          couponDoc = result.coupon;

          discountAmount = result.discount;

          payableAmount = result.finalAmount;
    }

      const gstAmount = payableAmount * 0.0;  //gst is 0% now

      const totalAmount = payableAmount + gstAmount;

   

    // ================= DUPLICATE CHECK =================
    const existingUser = await AssociationVisitor.findOne({
      payment_status: "SUCCESS",
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      const isEmailExists = existingUser.email === email;
      const isPhoneExists = existingUser.phone === phone;

      return res.status(400).json({
        status: false,
        message: "Email or phone already exists. Please use different credentials.",
        errors: {
          email: isEmailExists ? "Email already exists" : null,
          phone: isPhoneExists ? "Phone already exists" : null,
        },
      });
    }

    const existingPendingUser = await AssociationVisitor.findOne({
        payment_status: "PENDING",
        $or: [{ email }, { phone }],
      });

    // ================= CREATE ORDER =================
    const bookingNo = "ILAS-ASSO" + Date.now();

    const order = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: {
        booking_no: bookingNo,
        full_name: full_name || "",
        email: email || "",
        phone: phone || "",
        title: title || "",
        designation: designation || "",
        country: country || "",
        country_code: country_code || "+91",
        city: city || "",
        company_name: company_name || "",
        visiting_dates: visiting_dates || "",
        // visitor_profile: visitor_profile || "",
       // interest_areas: JSON.stringify(interest_areas || []),
       subtotal_amount: String( getAssociationPrice(category)),

        discount_amount: String(discountAmount || 0),

        final_payable_amount: String(payableAmount || 0),

        gst_amount: String(gstAmount || 0),

        total_amount: String(totalAmount || 0),
        coupon_code: couponDoc?.code || "",
        event_type,
        association_id,
      },
    });

   

    // ================= CREATE BOOKING (PENDING) =================
    let booking;

    if (existingPendingUser) {
      booking = await AssociationVisitor.findByIdAndUpdate(
        existingPendingUser._id,
        {
          booking_no: bookingNo,
          full_name,
          email,
          phone,
          title,
          designation,
          country,
          city,
          country_code,
          company_name,
          visiting_dates,

          coupon_code: couponDoc?.code || null,
          coupon_id: couponDoc?._id || null,

          subtotal_amount: getAssociationPrice(category),
          discount_amount: discountAmount,
          final_payable_amount: payableAmount,
          gst_amount: gstAmount,
          total_amount: totalAmount,

          order_id: order.id,
          payment_status: "PENDING",
          category,
          event_type: eventType,
          // subcategory,
          // usd_price,
          pass_selection,
          category_price: payableAmount,
          event_type,
          association_id,
        },
        { new: true }
      );
    } else 
  {
     booking = await AssociationVisitor.create({
      booking_no: bookingNo,
      full_name,
      email,
      phone,
      title,
      designation,
      country,
      city,
      country_code,
      company_name,
      visiting_dates,
      // visitor_profile,
      // interest_areas,
      coupon_code: couponDoc?.code || null,
      coupon_id: couponDoc?._id || null,

      subtotal_amount: getAssociationPrice(category),
      discount_amount: discountAmount,
      final_payable_amount: payableAmount,
      gst_amount: gstAmount,
      total_amount: totalAmount, 
      order_id: order.id,
      payment_status: "PENDING",
      category,
      // subcategory,
      // usd_price,
      pass_selection,
      category_price: payableAmount,
      event_type,
    });
  }
 

    // ================= QR GENERATION =================
    const qrData = JSON.stringify({
      booking_id: bookingNo,
      user_id: booking._id,
      name: full_name,
      email,
      phone,
      role: "ASSOCIATION VISITOR",
    });

    const qrBuffer = await QRCode.toBuffer(qrData, {
      type: "png",
      width: 600,
    });

    const qrUpload = await uploadBufferToS3({
      buffer: qrBuffer,
      originalname: `${booking._id}.png`,
      mimetype: "image/png",
      context: "ASSOCIATION_VISITOR_QR",
      isPublic: true,
    });

    const qrUrl = qrUpload.url;

    await AssociationVisitor.findByIdAndUpdate(booking._id, {
      association_visitor_qr_url: qrUrl,
    });

    // generate pdf
    const pdf_data = {
      id: booking._id,
      visitorId: bookingNo,
      name: full_name,
      position: "-",
      brand: company_name,
      role: "ASSOCIATION VISITOR",
    };

    const bgPath = path.resolve(process.cwd(), "assets/templates/visitor.jpeg");
    const pdfBuffer = await generatePdfBuffer({
      bgPath,
      qrSource: qrBuffer,
      pdfData: pdf_data,
      visitingDates: visiting_dates,
    });

    const pdfUpload = await uploadBufferToS3({
      buffer: pdfBuffer,
      originalname: `${pdf_data.visitorId}.pdf`,
      mimetype: "application/pdf",
      context: "ASSOCIATION_VISITOR_PASS",
      isPublic: true,
    });

    const relativePathPdf = pdfUpload.url;

    //  Update DB
    //const updatedDatapdf = await AssociationVisitor.findOneAndUpdate({ _id: pdf_data.id }, { association_visitor_pdf_url: relativePathPdf });

    await AssociationVisitor.findOneAndUpdate(
      { _id: pdf_data.id },
      {
        association_visitor_pdf_url:
          relativePathPdf,
      }
    );
    // pdf code

    // ================= RESPONSE =================
    return res.status(200).json({
      status: true,
      message: "Order created, payment pending",
      order_id: order.id,
      booking_no: bookingNo,
      user_id: booking._id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};


module.exports = {

  createAssociationVisitor,
};













// const QRCode = require("qrcode");

// const AssociationVisitorModel = require("../../models/AssociationVisitor");
// const path =require("path");
// const PDFDocument = require("pdfkit");

// const {renderVisitorBadgePdf} = require("../../helpers/badgePdf");
// const { sendMailCallApi } = require("../../helpers/sendMailHelper");
// const {uploadBufferToS3} = require("../../helpers/awsUpload");
// const { FILE_CONTEXTS } = require("../../utils/constants");

// const generatePdfBuffer = async ({
//   bgPath,
//   qrSource,
//   pdfData,
//   visitingDates,
// }) => {
//   return new Promise((resolve, reject) => {
//     const doc = new PDFDocument({
//       size: [600, 800],
//       margin: 0,
//     });

//     const chunks = [];

//     doc.on("data", (chunk) => chunks.push(chunk));
//     doc.on("end", () => resolve(Buffer.concat(chunks)));
//     doc.on("error", reject);

//     renderVisitorBadgePdf({
//       doc,
//       bgPath,
//       qrPath: qrSource,
//       pdfData,
//       visitingDates,
//     });

//     doc.end();
//   });
// };

// const createAssociationVisitor = async (req, res, next) => {
//   try {
//     const { email, phone } = req.body;

//     // Check duplicate email
//     const existingEmail = await AssociationVisitorModel.findOne({ email });

//     if (existingEmail) {
//       return res.status(400).json({
//         status: false,
//         message: "Email already registered.",
//       });
//     }

//     // Check duplicate phone
//     const existingPhone = await AssociationVisitorModel.findOne({ phone });

//     if (existingPhone) {
//       return res.status(400).json({
//         status: false,
//         message: "Phone number already registered.",
//       });
//     }

//     const bookingNo = "ASSOC-" + Date.now();

//     const visitor = await AssociationVisitorModel.create({
//       ...req.body,
//       booking_no: bookingNo,
//     });

//     const qrData = JSON.stringify({
//       booking_no: bookingNo,
//       user_id: visitor._id,
//       name: visitor.full_name,
//       email: visitor.email,
//       phone: visitor.phone,
//       role: "ASSOCIATION VISITOR",
//     })

//     const qrBuffer = await QRCode.toBuffer(qrData, {
//       type: "png",
//       width: 600,
//     });

//     const qrUpload = await uploadBufferToS3({
//       buffer: qrBuffer,
//       originalname: `${visitor._id}.png`,
//       mimetype: "image/png",
//       context: "ASSOCIATION_VISITOR_QR",
//       isPublic: true,
//     });

//     const qrUrl = qrUpload.url;

//     await AssociationVisitorModel.findByIdAndUpdate(
//       visitor._id,
//       {
//         association_visitor_qr_url: qrUrl,
//       }
//     );

//     const pdfData = {
//       id: visitor._id,
//       visitorId: bookingNo,
//       name: visitor.full_name,
//       position: visitor.designation,
//       brand: visitor.company_name,
//       role: "ASSOCIATION VISITOR",
//     };

//     const bgPath = path.resolve(
//       process.cwd(),
//       "assets/templates/visitor.jpeg"
//     );

//     const pdfBuffer = await generatePdfBuffer({
//       bgPath,
//       qrSource: qrBuffer,
//       pdfData,
//       //visitingDates: "Association Visitor",
//       visitingDates:"2026-10-09,2026-10-10,2026-10-11",
//     });

//     const pdfUpload = await uploadBufferToS3({
//       buffer: pdfBuffer,
//       originalname: `${bookingNo}.pdf`,
//       mimetype: "application/pdf",
//       context: "ASSOCIATION_VISITOR_PASS",
//       isPublic: true,
//     });

//     await sendMailCallApi({
//       email: visitor.email,
//       name: visitor.full_name,
//       pdf_link: pdfUpload.url,
//     });

//     await AssociationVisitorModel.findByIdAndUpdate(
//       visitor._id,
//       {
//         association_visitor_pdf_url: pdfUpload.url,
//       }
//     );

//     return res.status(201).json({
//       status: true,
//       data: {
//         ...visitor.toObject(),
//         association_visitor_qr_url: qrUrl,
//         association_visitor_pdf_url: pdfUpload.url,
//       },
//       message: "Association visitor registered successfully.",
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// module.exports = {
//   createAssociationVisitor,
// };