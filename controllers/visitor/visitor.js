const Visitor = require("../../models/Visitor");
const RazorpayWebhookLog = require("../../models/RazorpayWebhookLog");
const BusinessVisitor = require("../../models/BusinessVisitor");
const ExhibitorInvitee = require("../../models/ExhibitorInvitee");
const AssociationVisitor = require("../../models/AssociationVisitor");
const Vip = require("../../models/Vip");
const Rsvp = require("../../models/Rsvp");
const QRCode = require("qrcode");
const path = require("path");
const dotenv = require("dotenv").config();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");
const { callApi, sendDataToDashboard } = require("../../helpers/sendMsgHelper");
const { sendMailCallApi } = require("../../helpers/sendMailHelper");
const { buildBadgeValidityText } = require("../../helpers/badgeDate");
const { renderVisitorBadgePdf } = require("../../helpers/badgePdf");
const { uploadBufferToS3 } = require("../../helpers/awsUpload");
const { generateBadgeUrl } = require("../../helpers/utils");
const { validateCoupon } = require("../../helpers/couponService");
const Coupon = require("../../models/Coupon");
const { CheckinHistoryModel } = require("../../models/CheckinHistory");


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const parseJSONOrFallback = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
};

const toNumberOr = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
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

const buildVisitorUpsertDataFromOrderNotes = ({ orderId, notes = {}, amount }) => {
  const bookingNo = notes.booking_no || `ILAS-${Date.now()}`;

  return {
    booking_no: bookingNo,
    full_name: notes.full_name || "Unknown Visitor",
    email: notes.email || `no-email-${orderId}@ihff.local`,
    phone: notes.phone || `000000${Date.now().toString().slice(-6)}`,
    city: notes.city || "NA",
    title: notes.title || "",
    designation: notes.designation || "",
    country: notes.country || "",
    country_code: notes.country_code || "+91",
    company_name: notes.company_name || "NA",
    visiting_dates: notes.visiting_dates || "2026-06-12",
    //visitor_profile: notes.visitor_profile || "General",
    //interest_areas: Array.isArray(parseJSONOrFallback(notes.interest_areas, [])) ? parseJSONOrFallback(notes.interest_areas, []) : [],
    subtotal_amount: toNumberOr(notes.subtotal_amount, toNumberOr(amount, 0) / 100),
    gst_amount: toNumberOr(notes.gst_amount, 0),
    total_amount: toNumberOr(notes.total_amount, toNumberOr(amount, 0) / 100),
    order_id: orderId,
    payment_status: "PENDING",
  };
};



const validateCouponApi = async (req,res) => {
  
  try {

    const { coupon_code, amount } = req.body;

    const result = await validateCoupon(
      coupon_code,
      amount
    );



    if(!result.valid){
      return res.status(400).json(result);
    }

    return res.json({
      status:true,
      discount: result.discount,
      final_amount: result.finalAmount
    });

  } catch(error){

    return res.status(500).json({
      status:false,
      message:error.message
    });

  }
};

//for block pass after date pass
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

const createOrder = async (req, res) => {
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
      subtotal_amount,
      gst_amount,
      total_amount,
      coupon_code,
      category,
      subcategory,
      usd_price,
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

    let payableAmount = Number(subtotal_amount);

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
    const existingUser = await Visitor.findOne({
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

    const existingPendingUser = await Visitor.findOne({
        payment_status: "PENDING",
        $or: [{ email }, { phone }],
      });


  


    // ================= CREATE ORDER =================
    const bookingNo = "ILAS-" + Date.now();

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
        subtotal_amount: String(subtotal_amount || 0),

        discount_amount: String(discountAmount || 0),

        final_payable_amount: String(payableAmount || 0),

        gst_amount: String(gstAmount || 0),

        total_amount: String(totalAmount || 0),
        coupon_code: couponDoc?.code || "",
      },
    });

   

    // ================= CREATE BOOKING (PENDING) =================
    let booking;

    if (existingPendingUser) {
      booking = await Visitor.findByIdAndUpdate(
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

          subtotal_amount,
          discount_amount: discountAmount,
          final_payable_amount: payableAmount,
          gst_amount: gstAmount,
          total_amount: totalAmount,

          order_id: order.id,
          payment_status: "PENDING",
          category,
          subcategory,
          usd_price,
          category_price: payableAmount,
        },
        { new: true }
      );
    } else 
  {
     booking = await Visitor.create({
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

      subtotal_amount: subtotal_amount,
      discount_amount: discountAmount,
      final_payable_amount: payableAmount,
      gst_amount: gstAmount,
      total_amount: totalAmount, 
      order_id: order.id,
      payment_status: "PENDING",
      category,
      subcategory,
      usd_price,
      category_price: payableAmount,
    });
  }
 

    // ================= QR GENERATION =================
    const qrData = JSON.stringify({
      booking_id: bookingNo,
      user_id: booking._id,
      name: full_name,
      email,
      phone,
      role: "GENERAL VISITOR",
    });

    const qrBuffer = await QRCode.toBuffer(qrData, {
      type: "png",
      width: 600,
    });

    const qrUpload = await uploadBufferToS3({
      buffer: qrBuffer,
      originalname: `${booking._id}.png`,
      mimetype: "image/png",
      context: "GENERAL_VISITOR_QR",
      isPublic: true,
    });

    const qrUrl = qrUpload.url;

    await Visitor.findByIdAndUpdate(booking._id, {
      visitor_qr_url: qrUrl,
    });

    // generate pdf
    const pdf_data = {
      id: booking._id,
      visitorId: bookingNo,
      name: full_name,
      position: "-",
      brand: company_name,
      role: "GENERAL VISITOR",
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
      context: "GENERAL_VISITOR_PASS",
      isPublic: true,
    });

    const relativePathPdf = pdfUpload.url;

    //  Update DB
    const updatedDatapdf = await Visitor.findOneAndUpdate({ _id: pdf_data.id }, { visitor_pdf_url: relativePathPdf });
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

const previewPdf = async (req, res) => {
  try {
    const pdf_data = {
      name: "Manoj kumar",
      position: "Others",
      brand: "Fitness Enthusiast",
      visitorId: "IHFF-1775631632372",
      visiting_dates: req.query.visiting_dates || "2026-06-12,2026-06-13,2026-06-14",
    };

    const bgPath = path.resolve(process.cwd(), "assets/templates/business-visitor.jpeg");
    const qrBuffer = await QRCode.toBuffer(
      JSON.stringify({
        visitorId: pdf_data.visitorId,
        name: pdf_data.name,
      }),
      { type: "png", width: 600 },
    );

    const doc = new PDFDocument({
      size: [600, 800],
      margin: 0,
    });

    //  Preview in browser
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=preview.pdf");

    doc.pipe(res);

    renderVisitorBadgePdf({
      doc,
      bgPath,
      qrPath: qrBuffer,
      pdfData: pdf_data,
      visitingDates: pdf_data.visiting_dates,
      invitedBy: "John Doe",
    });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send("Preview failed");
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { order_id, payment_id, razorpay_signature } = req.body;

    const body = order_id + "|" + payment_id;

    const expectedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(body).digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        status: false,
        message: "Invalid signature",
      });
    }

    // Fetch real payment status
    const payment = await razorpay.payments.fetch(payment_id);

    const statusMap = {
      created: "PENDING",
      authorized: "AUTHORIZED",
      captured: "SUCCESS",
      failed: "FAILED",
      cancelled: "CANCELLED",
      refunded: "REFUNDED",
      pending: "PENDING",
    };

    const finalStatus = statusMap[payment.status] || "UNKNOWN";

    const booking = await Visitor.findOneAndUpdate(
      { order_id },
      {
        payment_id,
        payment_status: finalStatus,
      },
      { new: true },
    );

    if (!booking) {
      return res.status(404).json({
        status: false,
        message: "Booking not found",
      });
    }

    // Send msg ONLY if success
    if (finalStatus === "SUCCESS") {
      const data = await Visitor.findOne({ order_id: order_id }).select(
        "booking_no visitor_pdf_url phone full_name email country_code visiting_dates",
      );

      

      if (!data) {
        return res.status(404).json({
          status: false,
          message: "Visitor not found",
        });

      
          }

      // Clean phone & country code safely
      const cleanCountryCode = (data.country_code || "").replace(/\D/g, "");
      const cleanPhone = (data.phone || "").replace(/\D/g, "");

      const toNumber = `${cleanCountryCode}${cleanPhone}`;

      // Build file URL safely
      const fileUrl = data.visitor_pdf_url;

      //  WhatsApp API
      callApi({
        to: toNumber,
        params: [data.full_name, buildBadgeValidityText(data.visiting_dates), generateBadgeUrl(booking._id)],
      });

      let formatted = "";

      if (data?.visiting_dates) {
        formatted = buildBadgeValidityText(data.visiting_dates);
      } else {
        console.log("visitor_dates missing:", data);
      }

      // Email API
      sendMailCallApi({
        email: data.email,
        name: data.full_name,
        pdf_link: data.visitor_pdf_url,
        // orderid: data.booking_no,
        // datebooking: formatted,
        // qr_link: generateBadgeUrl(booking._id),
      });
    }

    return res.json({
      status: true,
      payment_status: finalStatus,
      data: booking,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

const webhookPayment = async (req, res) => {
  let webhookLog = null;

  try {
    const secret = process.env.WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    const rawBodyBuffer = Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(JSON.stringify(req.body || {}));
    const rawBody = rawBodyBuffer.toString("utf8");

    // Store log at the very beginning for complete traceability.
    webhookLog = await RazorpayWebhookLog.create({
      status: "RECEIVED",
      signature: signature || null,
      payload: rawBody,
    });

    // ================= PARSE BODY =================
    const event = JSON.parse(rawBody);
    const payment = event?.payload?.payment?.entity;

    await RazorpayWebhookLog.findByIdAndUpdate(webhookLog._id, {
      event: event?.event || "UNKNOWN",
      orderId: payment?.order_id || null,
      paymentId: payment?.id || null,
      paymentStatus: payment?.status || null,
      payload: event,
    });

    // ================= SIGNATURE VERIFY =================
    const expectedSignature = crypto.createHmac("sha256", secret).update(rawBodyBuffer).digest("hex");

    const isLengthMatch = typeof signature === "string" && Buffer.byteLength(expectedSignature) === Buffer.byteLength(signature);

    const isValid = isLengthMatch && crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));

    if (!isValid) {
      await RazorpayWebhookLog.findByIdAndUpdate(webhookLog._id, {
        status: "INVALID_SIGNATURE",
        signatureValid: false,
        errorMessage: "Invalid webhook signature",
      });
      console.error("Invalid webhook signature");
      return res.status(400).send("Invalid signature");
    }

    await RazorpayWebhookLog.findByIdAndUpdate(webhookLog._id, {
      signatureValid: true,
    });

    if (!payment) {
      await RazorpayWebhookLog.findByIdAndUpdate(webhookLog._id, {
        status: "IGNORED",
        errorMessage: "Payment entity missing",
      });
      return res.status(200).send("OK");
    }

    console.log("Event:", event.event);
    console.log("Payment ID:", payment.id);

    // ================= OPTIONAL EVENT FILTER =================
    const allowedEvents = ["payment.captured", "payment.failed", "payment.authorized", "payment.refunded"];

    if (!allowedEvents.includes(event.event)) {
      await RazorpayWebhookLog.findByIdAndUpdate(webhookLog._id, {
        status: "IGNORED",
        errorMessage: `Ignored event ${event.event}`,
      });
      return res.status(200).send("Ignored");
    }

    // ================= STATUS MAPPING =================
    const statusMap = {
      created: "PENDING",
      authorized: "AUTHORIZED",
      captured: "SUCCESS",
      failed: "FAILED",
      cancelled: "CANCELLED",
      refunded: "REFUNDED",
      pending: "PENDING",
    };

    const finalStatus = statusMap[payment.status] || "UNKNOWN";

    // ================= ATOMIC UPDATE (IDEMPOTENT) =================
    const updated = await Visitor.findOneAndUpdate(
      {
        order_id: payment.order_id,
        payment_status: { $ne: "SUCCESS" }, // prevent duplicate success processing
      },
      {
        payment_id: payment.id,
        payment_status: finalStatus,
        webhookUpdatedAt: new Date(),
      },
      { new: true },
    );

    if (!updated) {
      await RazorpayWebhookLog.findByIdAndUpdate(webhookLog._id, {
        status: "IGNORED",
        errorMessage: "Already processed or order not found",
      });
      console.warn("Already processed or order not found");
      return res.status(200).send("OK");
    }

    // ================= SUCCESS FLOW =================
    if (finalStatus === "SUCCESS") {
      console.log("Payment SUCCESS for:", payment.order_id);
      if (updated.coupon_id) {

        const couponUpdated =
          await Coupon.findOneAndUpdate(
          {
            _id: updated.coupon_id,
            $expr:{
              $lt:["$used_count","$max_usage"]
            }
          },
          {
            $inc:{
              used_count:1
            }
          },
          {
            new:true
          }
          );

          if(!couponUpdated){
            console.error(
              `Coupon exhausted for order ${payment.order_id}`
            );
          }

      }

      try {
        const data = await Visitor.findOne({
          order_id: payment.order_id,
        }).select("booking_no visitor_pdf_url phone full_name email country_code visiting_dates country state city total_amount");

        if (data) {
          const cleanCountryCode = (data.country_code || "").replace(/\D/g, "");
          const cleanPhone = (data.phone || "").replace(/\D/g, "");

          const toNumber = `${cleanCountryCode}${cleanPhone}`;

          const fileUrl = data.visitor_pdf_url;

          sendDataToDashboard({
            uid: data._id.toString(),
            firstName: data.full_name.split(" ")[0],
            lastName: data.full_name.split(" ").slice(1).join(" ") || "",
            jobTitle: "",
            organization: "",
            email: data.email,
            mobile: data.phone,
            countryCode: data.country_code,
            country: data.country || "",
            state: data.state || "",
            city: data.city || "",
            additionalData: {
              amount_paid: data.total_amount.toString(),
              ticket_name: data.visiting_dates.split(",").length > 2 ? "All Three Days" : buildBadgeValidityText(data.visiting_dates, true).trim(),
              type: "GENERAL VISITOR",
            },
            label: "PAID",
            badgeUrl: fileUrl,
          });

          data.dataSentToDashboard = true;
          await data.save();

          // WhatsApp notification
          callApi({
            to: toNumber,
            params: [data.full_name, buildBadgeValidityText(data.visiting_dates), generateBadgeUrl(data._id)],
          });

          let formatted = "";

          if (data?.visiting_dates) {
            formatted = buildBadgeValidityText(data.visiting_dates);
          } else {
            console.log("visitor_dates missing:", data);
          }

          // Email API
          sendMailCallApi({
            email: data.email,
            name: data.full_name,
            pdf_link: data.visitor_pdf_url,
            // orderid: data.booking_no,
            // datebooking: formatted,
            // qr_link: generateBadgeUrl(data._id),
          });
        }
      } catch (err) {
        console.error("Post-success error:", err.message);
      }
    }

    // ================= FAILED FLOW =================
    if (finalStatus === "FAILED") {
      console.log("Payment FAILED for:", payment.order_id);
    }

    await RazorpayWebhookLog.findByIdAndUpdate(webhookLog._id, {
      status: "PROCESSED",
      paymentStatus: finalStatus,
      errorMessage: null,
    });

    // ================= FINAL RESPONSE =================
    return res.status(200).send("OK");
  } catch (error) {
    if (webhookLog?._id) {
      try {
        await RazorpayWebhookLog.findByIdAndUpdate(webhookLog._id, {
          status: "FAILED",
          errorMessage: error.message,
        });
      } catch (logErr) {
        console.error("Webhook log update failed:", logErr.message);
      }
    }

    console.error("Webhook Error:", error.message);

    // IMPORTANT: Always return 200 to avoid Razorpay infinite retries
    return res.status(200).send("OK");
  }
};

const getVisitorByPhone = async (req, res) => {
  try {
    const { phone, country_code } = req.body;

    if (!phone || !country_code) {
      return res.status(400).json({
        status: false,
        message: "Phone and country_code are required",
      });
    }

    let data = null;
    let type = "";

    // VIP
    if (!data) {
      data = await Vip.findOne({ phone, country_code });
      if (data) type = "VIP";
    }

    // RSVP
    if (!data) {
      data = await Rsvp.findOne({ phone, country_code });
      if (data) type = "RSVP";
    }

    //  EXHIBITOR INVITEE
    if (!data) {
      data = await ExhibitorInvitee.findOne({ phone, country_code });
      if (data) type = "EXHIBITOR INVITEE";
    }

    //  BUSINESS VISITOR
    if (!data) {
      data = await BusinessVisitor.findOne({ phone, country_code, booking_status: "approved" });
      if (data) type = "BUSINESS VISITOR";
    }


    // ASSOCIATION VISITOR
    if (!data) {
      data = await AssociationVisitor.findOne({ phone, country_code,});

      if (data) type = "ASSOCIATION VISITOR";
    }
    

    

    //  GENERAL VISITOR (with payment check)
    if (!data) {
      data = await Visitor.findOne({
        phone,
        country_code,
        payment_status: { $in: ["SUCCESS"] },
      });
      if (data) type = "GENERAL VISITOR";
    }

    //  Not found
    if (!data) {
      return res.status(404).json({
        status: false,
        message: "Data not found!",
      });
    }

    let responseData = data.toObject();

    //  Handle all QR fields
    const qrFields = ["visitor_qr_url", "business_visitor_qr_url", "exhibitor_invitee_qr_url", "vip_qr_url", "rsvp_qr_url", "association_visitor_qr_url",];

    qrFields.forEach((field) => {
      responseData[field] = responseData[field] || null;
    });

    return res.status(200).json({
      status: true,
      message: "Data fetched successfully",
      type,
      data: responseData,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

const dummySendMail = async (req, res) => {
  try {
    const {
      email = "nikhil.kamble@radarsoft.tech",
      name = "Dummy Visitor",
      pdf_link = "https://example.com/dummy-badge.pdf",
      // orderid = `DUMMY-${Date.now()}`,
      // datebooking = "27-03-2026, 28-03-2026",
      // qr_link = "https://example.com/dummy-badge.pdf",
    } = req.body || {};

    const response = await sendMailCallApi({
      email,
      name,
      pdf_link,
      // orderid,
      // datebooking: buildBadgeValidityText(datebooking, true),
      // qr_link,
    });

    return res.status(200).json({
      status: true,
      message: "Dummy mail API triggered",
      payload: {
        email,
        name,
        pdf_link,
        // orderid,
        // datebooking: buildBadgeValidityText(datebooking, true),
        // qr_link,
      },
      response,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.response?.data || error.message,
    });
  }
};

const getBadge = async (req, res) => {
  try {
    const { userId } = req.params;

    // 1. Search all collections in PARALLEL.
    // Using .select() makes this incredibly fast because it only fetches the URL, not the entire document.
    const [vip, exhibitor, business, visitor, rsvp, association] = await Promise.all([
      Vip.findById(userId).select("vip_pdf_url").lean(),
      ExhibitorInvitee.findById(userId).select("exhibitor_invitee_pdf_url").lean(),
      BusinessVisitor.findById(userId).select("business_visitor_pdf_url").lean(),
      Visitor.findById(userId).select("visitor_pdf_url").lean(),
      Rsvp.findById(userId).select("rsvp_pdf_url").lean(),
      AssociationVisitor.findById(userId)
      .select("association_visitor_pdf_url")
      .lean(),
    ]);

    // 2. Find which collection actually returned a user
    const foundUser = vip || exhibitor || business || visitor || rsvp || association;

    if (!foundUser) {
      return res.status(404).send("Badge not found. Invalid ID.");
    }

    // 3. Extract the URL (handling your different field names dynamically)
    const targetUrl =
      foundUser.vip_pdf_url ||
      foundUser.exhibitor_invitee_pdf_url ||
      foundUser.business_visitor_pdf_url ||
      foundUser.visitor_pdf_url ||
      foundUser.rsvp_pdf_url ||
      foundUser.association_visitor_pdf_url
      ;

    if (!targetUrl) {
      return res.status(404).send("Badge image has not been generated yet.");
    }

    // 4. Instantly bounce the user to the S3 bucket
    return res.redirect(targetUrl);
  } catch (error) {
    console.error("Badge Redirect Error:", error.message);
    return res.status(500).send("Server Error");
  }
};

const SCAN_TIMEZONE = "Asia/Kolkata";
const getDateStringInTimezone = (date = new Date(), timezone = SCAN_TIMEZONE) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

// --- 🚀 Helper: Aggregation Pipeline for Ultra-Fast Pagination & Joins ---
const getPaginatedRoleData = async (Model, baseMatch, targetRole, todayMidnightUTC, checkinFilter, skip, limitNum) => {
  const checkinCollectionName = CheckinHistoryModel.collection.name;

  const pipeline = [
    { $match: baseMatch },
    // 1. Join CheckinHistory table directly in MongoDB
    {
      $lookup: {
        from: checkinCollectionName,
        localField: "_id",
        foreignField: "visitor_id",
        pipeline: [{ $match: { visitor_date: todayMidnightUTC } }, { $project: { createdAt: 1 } }],
        as: "checkin_info",
      },
    },
    // 2. Hydrate fields based on join results
    {
      $addFields: {
        detectedRole: targetRole,
        has_checked_in_today: { $gt: [{ $size: "$checkin_info" }, 0] },
        checked_in_at: { $arrayElemAt: ["$checkin_info.createdAt", 0] },
      },
    },
    // 3. Clean up the joined array so we don't send heavy data to frontend
    { $project: { checkin_info: 0 } },
  ];

  // 4. Apply Frontend Filter (If "Checked-in Users" is selected)
  if (checkinFilter === "checked_in") {
    pipeline.push({ $match: { has_checked_in_today: true } });
  }

  // 5. Paginate and Count in one single DB operation
  pipeline.push({
    $facet: {
      metadata: [{ $count: "total" }],
      data: [{ $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limitNum }],
    },
  });

  const [result] = await Model.aggregate(pipeline);
  const totalRecords = result.metadata[0]?.total || 0;
  const data = result.data || [];

  return { totalRecords, data };
};

// --- Main Controller ---
const findVisitor = async (req, res, next) => {
  try {
    const rawInput = String(req.body?.query || req.query.query || req.body?.search || "").trim();
    const targetRole = req.body?.role;
    const checkinFilter = req.body?.checkinFilter || "all";

    // Pagination Setup
    const page = parseInt(req.body?.page, 10) || 1;
    const limitNum = parseInt(req.body?.limit, 10) || 10;
    const skip = (page - 1) * limitNum;

    const todayStr = getDateStringInTimezone();
    const todayMidnightUTC = new Date(`${todayStr}T00:00:00.000Z`);

    let searchCriteria = [];

    // Parse Search Logic
    if (rawInput) {
      try {
        const parsedData = JSON.parse(rawInput);
        const exactChecks = [];
        if (parsedData.booking_id) exactChecks.push({ booking_no: parsedData.booking_id });
        if (parsedData.phone) exactChecks.push({ phone: parsedData.phone });
        if (parsedData.email) exactChecks.push({ email: parsedData.email });

        if (exactChecks.length > 0) {
          searchCriteria = exactChecks;
        } else {
          throw new Error("Missing JSON keys");
        }
      } catch (e) {
        const safeQuery = escapeRegex(rawInput);
        searchCriteria = [
          { booking_no: { $regex: safeQuery, $options: "i" } },
          { phone: { $regex: safeQuery, $options: "i" } },
          { email: { $regex: safeQuery, $options: "i" } },
          { full_name: { $regex: safeQuery, $options: "i" } },
        ];
      }
    }

    const dbQuery = searchCriteria.length > 0 ? { $or: searchCriteria } : {};

    // ==========================================
    // 🗄️ SINGLE TABLE PAGINATION (Optimized for SmartTable Tabs)
    // ==========================================
    if (targetRole) {
      let ModelToQuery;
      let specificMatch = { ...dbQuery };

      // Apply collection-specific approval constraints
      if (targetRole === "RSVP") ModelToQuery = Rsvp;
      else if (targetRole === "VIP") ModelToQuery = Vip;
      else if (targetRole === "BUSINESS VISITOR") {
        ModelToQuery = BusinessVisitor;
        specificMatch.booking_status = "approved";
      } else if (targetRole === "GENERAL VISITOR") {
        ModelToQuery = Visitor;
        specificMatch.payment_status = "SUCCESS";
      } else if (targetRole === "EXHIBITOR INVITEE") ModelToQuery = ExhibitorInvitee;

      if (!ModelToQuery) {
        return res.status(400).json({ status: false, message: "Invalid role provided." });
      }

      // Execute the hyper-optimized pipeline
      const { totalRecords, data } = await getPaginatedRoleData(
        ModelToQuery,
        specificMatch,
        targetRole,
        todayMidnightUTC,
        checkinFilter,
        skip,
        limitNum,
      );

      return res.status(200).json({
        status: true,
        message: `Found ${totalRecords} matching record(s).`,
        data: data,
        totalRecords: totalRecords, // Required for SmartTable pagination UI!
      });
    }

    // ==========================================
    // 🌐 GLOBAL FALLBACK SEARCH (If no tab is selected)
    // ==========================================
    else {
      // In a global search, we enforce a cap (limitNum) to prevent memory OOM crashes
      const [rsvps, vips, businesses, generals, exhibitors] = await Promise.all([
        Rsvp.find(dbQuery).limit(limitNum).lean(),
        Vip.find(dbQuery).limit(limitNum).lean(),
        BusinessVisitor.find({ ...dbQuery, booking_status: "approved" })
          .limit(limitNum)
          .lean(),
        Visitor.find({ ...dbQuery, payment_status: "SUCCESS" })
          .limit(limitNum)
          .lean(),
        ExhibitorInvitee.find(dbQuery).limit(limitNum).lean(),
      ]);

      let allMatches = [
        ...rsvps.map((user) => ({ ...user, detectedRole: "RSVP" })),
        ...vips.map((user) => ({ ...user, detectedRole: "VIP" })),
        ...businesses.map((user) => ({ ...user, detectedRole: "BUSINESS VISITOR" })),
        ...generals.map((user) => ({ ...user, detectedRole: "GENERAL VISITOR" })),
        ...exhibitors.map((user) => ({ ...user, detectedRole: "EXHIBITOR INVITEE" })),
      ];

      // Manual check-in hydration for global text search
      const userIds = allMatches.map((u) => String(u._id));
      const checkinsToday = await CheckinHistoryModel.find({
        visitor_id: { $in: userIds },
        visitor_date: todayMidnightUTC,
      }).lean();

      const checkinMap = {};
      checkinsToday.forEach((checkin) => {
        checkinMap[String(checkin.visitor_id)] = checkin.createdAt;
      });

      console.log("checkinMap", checkinMap);

      allMatches = allMatches.map((user) => ({
        ...user,
        has_checked_in_today: !!checkinMap[String(user._id)],
        checked_in_at: checkinMap[String(user._id)] || null,
      }));

      if (checkinFilter === "checked_in") {
        allMatches = allMatches.filter((user) => user.has_checked_in_today);
      }

      // We slice to ensure the total returned doesn't exceed the limit
      const paginatedMatches = allMatches.slice(0, limitNum);

      return res.status(200).json({
        status: true,
        message: `Found ${paginatedMatches.length} matching record(s).`,
        data: paginatedMatches,
        totalRecords: paginatedMatches.length,
      });
    }
  } catch (error) {
    console.error("Visitor Search Error:", error);
    return res.status(500).json({ status: false, message: "An error occurred while searching the database." });
  }
};

module.exports = {
  verifyPayment,
  getVisitorByPhone,
  createOrder,
  webhookPayment,
  previewPdf,
  dummySendMail,
  getBadge,
  validateCouponApi,
  findVisitor,
};
