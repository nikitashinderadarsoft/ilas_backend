const sampleUserData = [
  {
    full_name: "Admin",
    email: "admin@gmail.com",
    phone: "1234567890",
    country_code: "+1",
    company_name: "Admin Company",
    company_email: "admin@company.com",
    company_phone: "1234567890",
    role: "admin",
    password: "Admin@123",
  },
];

const FILE_CONTEXTS = {
  DEFAULT: "default",
  BADGE: "badge",
  QRCODE: "qr-code",
  GENERAL_VISITOR_QR: "general-visitor-qrcode",
  GENERAL_VISITOR_PASS: "general-visitor-pass",
  BUSINESS_VISITOR_QR: "business-visitor-qrcode",
  BUSINESS_VISITOR_PASS: "business-visitor-pass",
  EXHIBITOR_INVITEE_QR: "exhibitor-invitee-qrcode",
  EXHIBITOR_INVITEE_PASS: "exhibitor-invitee-pass",
  VIP_QR: "vip-qrcode",
  VIP_PASS: "vip-pass",
  EXHIBITOR_QR: "exhibitor-qrcode",
  BOOKING_QR: "booking-qrcode",
  RSVP_QR: "rsvp-qrcode",
  RSVP_PASS: "rsvp-pass",
  EXHIBITOR_STAFF_QR: "exhibitor-staff-qrcode",
  ASSOCIATION_VISITOR_QR: "association-visitor-qrcode",
  ASSOCIATION_VISITOR_PASS: "association-visitor-pass",
};

module.exports = {
  FILE_CONTEXTS,
  sampleUserData,
};
