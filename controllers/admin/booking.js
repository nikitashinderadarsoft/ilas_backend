const Visitor = require("../../models/Visitor");
const BusinessVisitor = require("../../models/BusinessVisitor");
const ExhibitorInvitee = require("../../models/ExhibitorInvitee");
const Vip = require("../../models/Vip");
const User = require("../../models/User");
const CheckinHistory = require("../../models/CheckinHistory");
const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const { callApi } = require("../../helpers/sendMsgHelper");
const { sendMailCallApi } = require("../../helpers/sendMailHelper");
const { buildBadgeValidityText } = require("../../helpers/badgeDate");
const { applyQueryOptions } = require("../../helpers/query");
const { generateBadgeUrl } = require("../../helpers/utils");

const dotenv = require("dotenv").config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const mapRazorpayPaymentStatus = (status) => {
  const statusMap = {
    created: "PENDING",
    authorized: "AUTHORIZED",
    captured: "SUCCESS",
    failed: "FAILED",
    cancelled: "CANCELLED",
    refunded: "REFUNDED",
    pending: "PENDING",
  };

  return statusMap[status] || "UNKNOWN";
};

const getRazorpayErrorMessage = (error, fallback = "Failed to refresh payment status") => {
  return error?.error?.description || error?.response?.data?.error?.description || error?.response?.data?.message || error?.message || fallback;
};

const getGeneralVisitorData = async (req, res, next) => {
  try {
    const { exhibitor_id, status } = req.body;

    const baseMatch = {};

    if (status) {
      baseMatch.payment_status = status;
    }

    if (exhibitor_id) {
      baseMatch.exhibitor_id = mongoose.Types.ObjectId(exhibitor_id);
    }

    const response = await applyQueryOptions({
      model: Visitor,
      req,
      searchFields: ["full_name", "email", "phone"],
      baseMatch,
    });

    return res.status(200).json({
      ...response,
      message: "General visitors fetch successfully.",
    });
  } catch (err) {
    console.error("Get Visitor Error:", err);
    return res.status(500).json({
      status: false,
      message: err.message || "Server Error",
    });
  }
};

const getBusinessVisitorData = async (req, res, next) => {
  try {
    const { status } = req.body;

    const baseMatch = {};

    if (status) {
      baseMatch.booking_status = status;
    }

    const response = await applyQueryOptions({
      model: BusinessVisitor,
      req,
      searchFields: ["full_name", "email", "phone"],
      baseMatch,
    });

    return res.status(200).json({
      ...response,
      message: "Business visitor fetch successfully.",
    });
  } catch (err) {
    console.error("Get Business visitor Error:", err);
    return res.status(500).json({
      status: false,
      message: err.message || "Server Error",
    });
  }
};


// all invitee data 
const getAllExhibitorInvitees = async (req, res) => {
  try {
    const response = await applyQueryOptions({
      model: ExhibitorInvitee,
      req,
      searchFields: [
        "full_name",
        "email",
        "phone",
        "coupon_code",
      ],
      populate: {
        path: "exhibitor_id",
        model: "User",
        select: "full_name email company_name",
      },
    });

    return res.status(200).json({
      status: true,
      ...response,
      message: "All invitees fetched successfully",
    });
  } catch (err) {
    console.error("Get All Invitees Error:", err);

    return res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};


//exhibitor invitee data for perticular id wise
const getExhibitorInviteeData = async (req, res, next) => {
  try {
    const { exhibitor_id, status } = req.body;

    const baseMatch = {};

    if (status) {
      baseMatch.payment_status = status;
    }

    if (exhibitor_id) {
      baseMatch.exhibitor_id = mongoose.Types.ObjectId.createFromHexString(exhibitor_id);
    }

    const response = await applyQueryOptions({
      model: ExhibitorInvitee,
      req,
      searchFields: ["full_name", "email", "phone"],
      baseMatch,
      populate: {
        path: "exhibitor_id",
        model: "User",
        select: "full_name email phone company_name",
      },
    });

    return res.status(200).json({
      status: true,
      ...response,
      message: "Exhibitor invitee fetch successfully.",
    });
  } catch (err) {
    console.error("Get Exhibitor Invitee Error:", err);
    return res.status(500).json({
      status: false,
      message: err.message || "Server Error",
    });
  }
};

const getVipData = async (req, res, next) => {
  try {
    const vipReq = {
      ...req,
      body: req.query,
    };

    const response = await applyQueryOptions({
      model: Vip,
      req: vipReq,
      searchFields: ["full_name", "email", "phone"],
    });

    if (!response.data || response.data.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Data not found!",
      });
    }

    return res.status(200).json({
      status: true,
      message: "VIP data fetch successfully.",
      totalRecords: response.totalRecords,
      ...(response.currentPage && {
        currentPage: response.currentPage,
        totalPages: response.totalPages,
      }),
      data: response.data,
    });
  } catch (err) {
    console.error("Get VIP Error:", err);
    return res.status(500).json({
      status: false,
      message: err.message || "Server Error",
    });
  }
};

const checkinVisitor = async (req, res) => {
  try {
    const { user_id, role } = req.body;

    if (!user_id || !role) {
      return res.json({
        status: false,
        message: "user_id and role required",
      });
    }

    const today = new Date().toISOString().split("T")[0];

    let data = null;
    let visitor_type = "";

    //  Role-based model selection
    if (role === "GENERAL VISITOR") {
      data = await Visitor.findById(user_id);
      visitor_type = "GENERAL VISITOR";
    } else if (role === "BUSINESS VISITOR") {
      data = await BusinessVisitor.findById(user_id);
      visitor_type = "BUSINESS VISITOR";
    } else if (role === "VIP") {
      data = await Vip.findById(user_id);
      visitor_type = "VIP";
    } else if (role === "EXHIBITOR INVITEE") {
      data = await ExhibitorInvitee.findById(user_id);
      visitor_type = "EXHIBITOR INVITEE";
    } else {
      return res.json({
        status: false,
        message: "Invalid role",
      });
    }

    if (!data) {
      return res.json({
        status: false,
        message: "Data not found",
      });
    }

    // DATE VALIDATION

    // GENERAL VISITOR → multiple dates
    if (visitor_type === "GENERAL VISITOR") {
      let visitingDates = data.visiting_dates || [];

      if (typeof visitingDates === "string") {
        visitingDates = visitingDates.split(",").map((d) => d.trim());
      }

      if (!Array.isArray(visitingDates) || !visitingDates.includes(today)) {
        return res.json({
          status: false,
          message: "Visitor not allowed today",
        });
      }
    }
    // OTHER ROLES → single date
    else {
      const visitingDate = data.visiting_date || data.visiting_dates;

      if (!visitingDate || visitingDate !== today) {
        return res.json({
          status: false,
          message: "Visitor not allowed today",
        });
      }
    }

    //  DUPLICATE CHECK (FIXED)
    // const record = await CheckinHistory.findOne({
    //   visitor_id: user_id,
    //   visitor_date: today
    // });

    // if (record) {
    //   return res.json({
    //     status: false,
    //     message: "Already checked-in today",
    //   });
    // }

    //  INSERT CHECK-IN
    const checkinData = CheckinHistory.create({
      visitor_id: user_id,
      visitor_type,
      visitor_name: data.full_name || data.name,
      visitor_phone: data.phone,
      visitor_email: data.email,
      visitor_date: today,
    });

    return res.json({
      status: true,
      message: "Check-in successful",
      data: checkinData,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      message: "Server error",
    });
  }
};

const updateBusinessVisitorStatus = async (req, res) => {
  try {
    const { id, booking_status } = req.body;

    // -------- VALIDATION --------
    if (!id || !booking_status) {
      return res.status(400).json({
        status: false,
        message: "id and status are required",
      });
    }

    if (!["approved", "rejected"].includes(booking_status)) {
      return res.status(400).json({
        status: false,
        message: "Invalid status value",
      });
    }

    // -------- UPDATE --------
    const updated = await BusinessVisitor.findByIdAndUpdate(id, { booking_status }, { new: true });

    if (!updated) {
      return res.status(404).json({
        status: false,
        message: "Business visitor not found",
      });
    }

    if (booking_status === "approved") {
      const data = await BusinessVisitor.findOne({ _id: id }).select(
        "booking_no business_visitor_pdf_url phone full_name email country_code, visiting_date",
      );

      if (!data) {
        return res.status(404).json({
          status: false,
          message: "Business visitor not found",
        });
      }

      // Clean phone & country code safely
      const cleanCountryCode = (data.country_code || "").replace(/\D/g, "");
      const cleanPhone = (data.phone || "").replace(/\D/g, "");

      const toNumber = `${cleanCountryCode}${cleanPhone}`;

      // Build file URL safely
      const fileUrl = data.business_visitor_pdf_url;

      //  WhatsApp API
      callApi({
        to: toNumber,
        params: [data.full_name, buildBadgeValidityText(data.visiting_date), generateBadgeUrl(data._id)],
      });

      let formatted = "";

      if (data?.visiting_date) {
        formatted = buildBadgeValidityText(data.visiting_date);
      } else {
        console.log("visiting_date is missing:", data);
      }

      // Email API
      sendMailCallApi({
        email: data.email,
        name: data.full_name,
        pdf_link: data.business_visitor_pdf_url,
        // orderid: data.booking_no,
        // datebooking: formatted,
        // qr_link: generateBadgeUrl(data._id),
      });
    }

    return res.status(200).json({
      status: true,
      message: "Status updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Status Update Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

const refreshGeneralVisitorPayment = async (req, res) => {
  try {
    const { id } = req.body;

    const visitor = await Visitor.findById(id);
    if (!visitor) {
      return res.status(404).json({
        status: false,
        message: "General visitor not found",
      });
    }

    if (!visitor.order_id) {
      return res.status(400).json({
        status: false,
        message: "Order id missing for this visitor",
      });
    }

    let paymentId = visitor.payment_id || null;
    let razorpayStatus = null;
    let finalStatus = visitor.payment_status || "PENDING";
    let paymentIdInvalid = false;

    if (paymentId) {
      try {
        const payment = await razorpay.payments.fetch(paymentId);
        razorpayStatus = payment?.status || null;
        finalStatus = mapRazorpayPaymentStatus(razorpayStatus);
        paymentId = payment?.id || paymentId;
      } catch (error) {
        const isInvalidPaymentId =
          error?.statusCode === 400 && error?.error?.code === "BAD_REQUEST_ERROR" && error?.error?.description === "The id provided does not exist";

        if (!isInvalidPaymentId) {
          throw error;
        }

        paymentIdInvalid = true;
        paymentId = null;
      }
    }

    if (!paymentId) {
      try {
        const orderPayments = await razorpay.orders.fetchPayments(visitor.order_id);
        const paymentList = Array.isArray(orderPayments?.items) ? orderPayments.items : [];

        if (paymentList.length > 0) {
          paymentList.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
          const latestPayment = paymentList[0];

          paymentId = latestPayment?.id || null;
          razorpayStatus = latestPayment?.status || null;
          finalStatus = mapRazorpayPaymentStatus(razorpayStatus);
        } else {
          const order = await razorpay.orders.fetch(visitor.order_id);
          console.log("order", order);
          if (order?.status === "paid") {
            finalStatus = "SUCCESS";
          }
        }
      } catch (error) {
        return res.status(502).json({
          status: false,
          message: getRazorpayErrorMessage(error, "Unable to verify payment details from Razorpay"),
        });
      }
    }

    const updatedVisitor = await Visitor.findByIdAndUpdate(
      id,
      {
        payment_id: paymentId,
        payment_status: finalStatus,
      },
      { new: true },
    );

    return res.status(200).json({
      status: true,
      message: "Payment status refreshed",
      razorpay_status: razorpayStatus,
      warning: paymentIdInvalid ? "Stored payment_id was invalid; refreshed status using order payments" : null,
      data: updatedVisitor,
    });
  } catch (error) {
    const message = getRazorpayErrorMessage(error);
    console.log("error", message);
    return res.status(500).json({
      status: false,
      message,
    });
  }
};

const resendGeneralVisitorPass = async (req, res) => {
  try {
    const { id } = req.body;

    const data = await Visitor.findById(id).select("booking_no visitor_pdf_url phone full_name email country_code visiting_dates payment_status");

    if (!data) {
      return res.status(404).json({
        status: false,
        message: "General visitor not found",
      });
    }

    if (data.payment_status !== "SUCCESS") {
      return res.status(400).json({
        status: false,
        message: "Pass can be resent only for successful payments",
      });
    }

    if (!data.visitor_pdf_url) {
      return res.status(400).json({
        status: false,
        message: "Pass PDF not generated yet for this visitor",
      });
    }

    const cleanCountryCode = (data.country_code || "").replace(/\D/g, "");
    const cleanPhone = (data.phone || "").replace(/\D/g, "");
    const toNumber = `${cleanCountryCode}${cleanPhone}`;

    const fileUrl = data.visitor_pdf_url;

    const formatted = data?.visiting_dates ? buildBadgeValidityText(data.visiting_dates) : "";

    await Promise.all([
      callApi({
        to: toNumber,
        params: [data.full_name, buildBadgeValidityText(data.visiting_dates), generateBadgeUrl(data._id)],
      }),
      sendMailCallApi({
        email: data.email,
        name: data.full_name,
        pdf_link: data.visitor_pdf_url,
        // orderid: data.booking_no,
        // datebooking: formatted,
        // qr_link: generateBadgeUrl(data._id),
      }),
    ]);

    return res.status(200).json({
      status: true,
      message: "Pass resent successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error?.response?.data?.message || error?.message || "Failed to resend pass",
    });
  }
};

const resendBusinessVisitorPass = async (req, res) => {
  try {
    const { id } = req.body;

    const data = await BusinessVisitor.findById(id).select(
      "booking_no business_visitor_pdf_url phone full_name email country_code visiting_date booking_status",
    );

    if (!data) {
      return res.status(404).json({
        status: false,
        message: "Business visitor not found",
      });
    }

    if (data.booking_status !== "approved") {
      return res.status(400).json({
        status: false,
        message: "Pass can be resent only for approved business visitors",
      });
    }

    if (!data.business_visitor_pdf_url) {
      return res.status(400).json({
        status: false,
        message: "Pass PDF not generated yet for this visitor",
      });
    }

    const cleanCountryCode = (data.country_code || "").replace(/\D/g, "");
    const cleanPhone = (data.phone || "").replace(/\D/g, "");
    const toNumber = `${cleanCountryCode}${cleanPhone}`;

    const fileUrl = data.business_visitor_pdf_url;

    const formatted = data?.visiting_date ? buildBadgeValidityText(data.visiting_date, true) : "";

    await Promise.all([
      callApi({
        to: toNumber,
        params: [data.full_name, buildBadgeValidityText(data.visiting_date), generateBadgeUrl(data._id)],
      }),
      sendMailCallApi({
        email: data.email,
        name: data.full_name,
        pdf_link: data.business_visitor_pdf_url,
        // orderid: data.booking_no,
        // datebooking: formatted,
        // qr_link: generateBadgeUrl(data._id),
      }),
    ]);

    return res.status(200).json({
      status: true,
      message: "Pass resent successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error?.response?.data?.message || error?.message || "Failed to resend pass",
    });
  }
};

module.exports = {
  getGeneralVisitorData,
  getBusinessVisitorData,
  updateBusinessVisitorStatus,
  getExhibitorInviteeData,
  getAllExhibitorInvitees,
  getVipData,
  checkinVisitor,
  refreshGeneralVisitorPayment,
  resendGeneralVisitorPass,
  resendBusinessVisitorPass,
};
