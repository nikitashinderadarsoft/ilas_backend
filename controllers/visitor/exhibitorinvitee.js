const QRCode = require("qrcode");
const dotenv = require("dotenv").config();
const path = require("path");
const PDFDocument = require("pdfkit");
const ExhibitorInvitee = require("../../models/ExhibitorInvitee");
const User = require("../../models/User");
const { uploadBufferToS3 } = require("../../helpers/awsUpload");
const UserModel = require("../../models/User");
const { callApi, sendDataToDashboard } = require("../../helpers/sendMsgHelper");
const { sendMailCallApi } = require("../../helpers/sendMailHelper");
const { buildBadgeValidityText } = require("../../helpers/badgeDate");
const { renderVisitorBadgePdf } = require("../../helpers/badgePdf");
const { generateBadgeUrl } = require("../../helpers/utils");
const ExhibitorCoupon = require("../../models/ExhibitorCoupon");

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
      invitedBy: pdfData.invitedBy || null,
    });

    doc.end();
  });
};

const createExhibitorInviteeBooking = async (req, res, next) => {
  try {
    let {
      title,
      designation,
      country,

      full_name,
      email,
      phone,
      country_code,
      company_name,
      relationship,
      visitor_profile,
      visiting_dates = "2026-06-12 , 2026-06-13",
      exhibitor_id,
      coupon_code,
    } = req.body;

    //  Duplicate check
    const existingUser = await ExhibitorInvitee.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      return res.status(400).json({
        status: false,
        message: existingUser.email === email ? "Email already exists" : "Phone already exists",
      });
    }

    //  CHECK EXHIBITOR BADGE LIMIT (BEFORE BOOKING)
    const exhibitor = await User.findById(exhibitor_id);

    if (!exhibitor) {
      return res.status(404).json({
        status: false,
        message: "Exhibitor not found",
      });
    }


    //validate coupon
    const coupon = await ExhibitorCoupon.findOne({
      exhibitor_id,
      coupon_code: coupon_code?.toUpperCase().trim(),
    });

    if (!coupon) {
      return res.status(400).json({
        status: false,
        message: "Invalid coupon code",
      });
    }

    if (coupon.is_used) {
      return res.status(400).json({
        status: false,
        message: "Coupon already used",
      });
    }

    const existingBookings = await ExhibitorInvitee.countDocuments({
      exhibitor_id,
    });

    if (exhibitor.invitee_limit <= existingBookings) {
      return res.status(400).json({
        status: false,
        message: "Badge limit exceeded for this exhibitor",
      });
    }

    //  Generate booking number
    const bookingNo = "AceTech-" + Date.now();
    const fullName = full_name;



    // Create booking FIRST
    const booking = await ExhibitorInvitee.create({
      booking_no: bookingNo,

      title,
      designation,
      country,

      full_name,
      email,
      phone,
      relationship,
      visitor_profile,
      country_code,
      company_name,
      visiting_dates,
      exhibitor_id,
      coupon_code,
    });

    //marked coupon as used
    await ExhibitorCoupon.findByIdAndUpdate(
      coupon._id,
      {
        is_used: true,
        used_by: booking._id,
        used_at: new Date(),
      }
    );

    const userId = booking._id;

    //  Generate QR DATA
    const qrData = {
      booking_id: bookingNo,
      user_id: userId,
      name: fullName,
      email: email,
      phone: phone,
      role: "EXHIBITOR INVITEE",
    };

    const qrContent = JSON.stringify(qrData);

    const qrBuffer = await QRCode.toBuffer(qrContent, {
      type: "png",
      width: 600,
    });

    const qrUpload = await uploadBufferToS3({
      buffer: qrBuffer,
      originalname: `${userId}.png`,
      mimetype: "image/png",
      context: "EXHIBITOR_INVITEE_QR",
      isPublic: true,
    });

    const qrUrl = qrUpload.url;

    const badgeData = {
      id: userId,
      visitorId: bookingNo,
      name: full_name,
      position: relationship || "-",
      brand: company_name || "-",
      role: "EXHIBITOR INVITEE",
      invitedBy: exhibitor.company_name || null,
    };

    const bgPath = path.resolve(process.cwd(), "assets/templates/exhibitor-invitee.jpeg");
    const pdfBuffer = await generatePdfBuffer({
      bgPath,
      qrSource: qrBuffer,
      pdfData: badgeData,
      visitingDates: visiting_dates,
    });

    const pdfUpload = await uploadBufferToS3({
      buffer: pdfBuffer,
      originalname: `${badgeData.visitorId}.pdf`,
      mimetype: "application/pdf",
      context: "EXHIBITOR_INVITEE_PASS",
      isPublic: true,
    });

    const badgeUrl = pdfUpload.url;

    booking.exhibitor_invitee_qr_url = qrUrl;
    booking.exhibitor_invitee_pdf_url = badgeUrl;

    sendDataToDashboard({
      uid: booking._id.toString(),
      firstName: booking.full_name.split(" ")[0],
      lastName: booking.full_name.split(" ").slice(1).join(" ") || "",
      jobTitle: booking.designation || "",
      organization: booking.company_name,
      email: booking.email,
      mobile: booking.phone,
      countryCode: booking.country_code,
      country: booking.country || "",
      state: booking.state || "",
      city: booking.city || "",
      additionalData: {
        ticket_name: booking.visiting_dates.split(",").length > 2 ? "All Three Days" : buildBadgeValidityText(booking.visiting_dates, true).trim(),
        type: "EXHIBITOR INVITEE",
        visitor_profile: booking.visitor_profile,
        relationship: booking.relationship,
      },
      label: "PAID",
      badgeUrl: badgeUrl,
    });

    booking.dataSentToDashboard = true;
    await booking.save();

    const cleanCountryCode = (country_code || "").replace(/\D/g, "");
    const cleanPhone = (phone || "").replace(/\D/g, "");
    const toNumber = `${cleanCountryCode}${cleanPhone}`;

    const formatted = visiting_dates ? buildBadgeValidityText(visiting_dates) : "";

    try {
      await Promise.all([
        callApi({
          to: toNumber,
          params: [full_name, buildBadgeValidityText(visiting_dates), generateBadgeUrl(booking._id)],
        }),
        console.log("Exhibitor Invitee PDF:", badgeUrl),
        sendMailCallApi({
          email,
          name: full_name,
          // orderid: bookingNo,
          // datebooking: formatted,
          // qr_link: generateBadgeUrl(booking._id),
          pdf_link: badgeUrl,
        }),
      ]);
    } catch (notificationError) {
      console.error("Exhibitor invitee notification error:", notificationError);
    }

    //  AFTER BOOKING → INCREMENT COUNT
    // await User.findByIdAndUpdate(exhibitor_id, {
    //   $inc: { invitee_limit: 1 },
    // });

    // Final Response
    return res.status(201).json({
      status: true,
      message: "Booking successful",
      data: {
        ...booking._doc,
        exhibitor_invitee_qr_url: qrUrl,
        exhibitor_invitee_pdf_url: badgeUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

const validateExhibitorInviteeQR = async (req, res, next) => {
  try {
    const { exhibitor_id } = req.params;

    const user = await UserModel.findOne({
      _id: exhibitor_id,
    });

    if (!user) {
      return next({
        status: 404,
        message: "Invalid Reference ID.",
      });
    }

    const invitees = await ExhibitorInvitee.find({
      exhibitor_id,
    });

    if (invitees.length > user.invitee_limit) {
      return next({
        status: 400,
        message: "Invitee limit exceeded for this exhibitor.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Valid Reference ID.",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};


//exhibitor invitee coupon validation function
const validateCoupon = async (req, res) => {
  try {
    const { exhibitor_id, coupon_code } = req.body;

    const coupon = await ExhibitorCoupon.findOne({
      exhibitor_id,
      coupon_code: coupon_code.toUpperCase().trim(),
    });

    if (!coupon) {
      return res.status(400).json({
        status: false,
        message: "Invalid coupon code",
      });
    }

    if (coupon.is_used) {
      return res.status(400).json({
        status: false,
        message: "Coupon already used",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Coupon valid",
      data: coupon,
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};



module.exports = { createExhibitorInviteeBooking, validateExhibitorInviteeQR, validateCoupon };
