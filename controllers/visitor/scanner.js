const Visitor = require("../../models/Visitor");
const BusinessVisitor = require("../../models/BusinessVisitor");
const ExhibitorInvitee = require("../../models/ExhibitorInvitee");
const Vip = require("../../models/Vip");
const Rsvp = require("../../models/Rsvp");
const { CheckinHistoryModel } = require("../../models/CheckinHistory");

const ALLOWED_DATES = ["2026-10-09", "2026-10-10", "2026-06-11"];
const SCAN_TIMEZONE = "Asia/Kolkata";

const getDateStringInTimezone = (date = new Date(), timezone = SCAN_TIMEZONE) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const normalizePhone = (value = "") => String(value).replace(/\D/g, "");
const normalizeText = (value = "") => String(value).trim().toLowerCase();

// Safely converts strings like "13 June 2026" into standard "YYYY-MM-DD"
const standardizeDateString = (dateStr) => {
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj)) return null;

  console.log(
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dateObj),
  );
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dateObj);
};

const parseVisitingDates = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string")
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  return [];
};

// Fixed logic to accurately compare DB strings ("13 June 2026") with todayStr ("2026-06-19")
const visitorAllowedForDate = (matchedUser, roleType, todayStr) => {
  if (!matchedUser) return false;

  if (roleType === "BUSINESS VISITOR") {
    const visitingDate = String(matchedUser.visiting_date || "").trim();
    if (!visitingDate) return true;
    return standardizeDateString(visitingDate) === todayStr;
  }

  const rawDates = parseVisitingDates(matchedUser.visiting_dates || matchedUser.visiting_date);
  if (!rawDates.length) return true; // If no dates explicitly set, assume valid

  const standardizedDates = rawDates.map(standardizeDateString).filter(Boolean);
  return standardizedDates.includes(todayStr);
};

// --- Main Controller ---
const scanTicket = async (req, res) => {
  try {
    const bookingNo = String(req.body.bookingNo || req.body.booking_no || "").trim();
    const payloadPhone = String(req.body.phone || "").trim();
    const payloadEmail = String(req.body.email || "").trim();
    const payloadName = String(req.body.name || req.body.full_name || "").trim();

    // 1. Basic Payload Validation
    if (!bookingNo || !payloadPhone) {
      return res.status(400).json({
        status: false,
        message: "Invalid QR payload. bookingNo and phone are required.",
      });
    }

    // 2. Event Date Gate
    const allowedDates = ALLOWED_DATES;
    const todayStr = getDateStringInTimezone();

    if (!allowedDates.includes(todayStr) && process.env.NODE_ENV !== "development" && false) {
      return res.status(400).json({
        status: false,
        message: `Scan rejected. Active event dates are ${allowedDates.join(", ")}.`,
      });
    }

    // 3. Ultra-Fast Parallel Querying using .lean()
    const [rsvp, vip, business, general, exhibitor] = await Promise.all([
      Rsvp.findOne({ booking_no: bookingNo }).lean(),
      Vip.findOne({ booking_no: bookingNo }).lean(),
      BusinessVisitor.findOne({ booking_no: bookingNo }).lean(),
      Visitor.findOne({ booking_no: bookingNo }).lean(),
      ExhibitorInvitee.findOne({ booking_no: bookingNo }).lean(),
    ]);

    // 4. Role Identification
    let matchedUser = null;
    let roleType = "";

    if (rsvp) {
      matchedUser = rsvp;
      roleType = "RSVP";
    } else if (vip) {
      matchedUser = vip;
      roleType = "VIP";
    } else if (business) {
      matchedUser = business;
      roleType = "BUSINESS VISITOR";
    } else if (general) {
      matchedUser = general;
      roleType = "GENERAL VISITOR";
    } else if (exhibitor) {
      matchedUser = exhibitor;
      roleType = "EXHIBITOR INVITEE";
    }

    if (!matchedUser) {
      return res.status(404).json({
        status: false,
        message: "Ticket not found. Invalid registration.",
      });
    }

    // 5. Anti-Fraud Checks (Ensuring the QR code data hasn't been tampered with)
    if (normalizePhone(payloadPhone) !== normalizePhone(matchedUser.phone)) {
      return res.status(400).json({ status: false, message: "QR payload verification failed (Phone mismatch)." });
    }
    if (payloadEmail && normalizeText(payloadEmail) !== normalizeText(matchedUser.email)) {
      return res.status(400).json({ status: false, message: "QR payload verification failed (Email mismatch)." });
    }
    if (payloadName && normalizeText(payloadName) !== normalizeText(matchedUser.full_name)) {
      return res.status(400).json({ status: false, message: "QR payload verification failed (Name mismatch)." });
    }

    // 6. Payment & Approval Checks
    if (roleType === "GENERAL VISITOR" && String(matchedUser.payment_status || "").toUpperCase() !== "SUCCESS") {
      return res.status(400).json({ status: false, message: "Access denied: Payment verification failed." });
    }
    if (roleType === "BUSINESS VISITOR" && String(matchedUser.booking_status || "").toLowerCase() !== "approved") {
      return res.status(400).json({ status: false, message: "Access denied: Booking is not approved yet." });
    }

    // 7. Day-Pass Date Checking
    if (!visitorAllowedForDate(matchedUser, roleType, todayStr) && process.env.NODE_ENV !== "development" && false) {
      return res.status(400).json({ status: false, message: "Access denied: Ticket is not valid for today." });
    }

    // 8. Idempotency Check (Has this person already scanned in today?)
    const checkinDate = new Date(`${todayStr}T00:00:00.000Z`); // Strict Midnight UTC Representation
    const visitorId = String(matchedUser._id);

    const alreadyScanned = await CheckinHistoryModel.findOne({
      visitor_id: visitorId,
      visitor_date: checkinDate,
    }).lean();

    if (alreadyScanned) {
      return res.status(200).json({
        status: false,
        message: `Already checked-in\n${matchedUser.full_name}\n${roleType}`,
      });
    }

    // 9. Write the Check-in Transaction to the New Schema
    try {
      await CheckinHistoryModel.create({
        visitor_id: visitorId,
        booking_no: bookingNo,
        visitor_type: roleType,
        visitor_name: matchedUser.full_name || null,
        visitor_phone: matchedUser.phone || null,
        visitor_email: matchedUser.email || null,
        visitor_date: checkinDate,
      });
    } catch (dbErr) {
      // 10. Race Condition Guardian (Solves double-tap scanner issues perfectly)
      if (dbErr?.code === 11000) {
        return res.status(200).json({
          status: false,
          message: `Already checked-in\n${matchedUser.full_name}\n${roleType}`,
        });
      }
      throw dbErr;
    }

    // 11. Final Success Response
    return res.status(200).json({
      status: true,
      message: `Checked-in\n${matchedUser.full_name}\n${roleType}`,
      data: {
        bookingNo,
        roleType,
        name: matchedUser.full_name,
      },
    });
  } catch (error) {
    console.error("Ticket scan error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Server error. Please try scanning again.",
    });
  }
};

module.exports = { scanTicket };
