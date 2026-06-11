const {
  verifyPayment,
  webhookPayment,
  getVisitorByPhone,
  createOrder,
  previewPdf,
  dummySendMail,
  validateCouponApi,
  findVisitor
} = require("../../controllers/visitor/visitor");



const router = require("express").Router();
const { body } = require("express-validator");
const { validateRequest } = require("../../middlewares/errorHandler");
// const { authenticate } = require("../../middlewares/auth");
const express = require("express");



router.post(
  "/visitor-booking",
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("designation").notEmpty().withMessage("Designation is required"),
    body("country").notEmpty().withMessage("Country is required"),
    body("full_name").notEmpty().withMessage("Full name is required"),
    body("email").notEmpty().withMessage("Email is required"),
    body("phone").notEmpty().withMessage("Phone number is required"),
    body("country_code").notEmpty().withMessage("Country code is required"),
    body("city").notEmpty().withMessage("City is required"),
    body("company_name").notEmpty().withMessage("Company name is required"),
   // body("visitor_profile")
    //  .notEmpty()
    //  .withMessage("Visitor profile is required"),
    // body("interest_areas").notEmpty().withMessage("Interest areas is required"),
     body("visiting_dates").notEmpty().withMessage("Visiting dates is required"),
    body("subtotal_amount")
      .notEmpty()
      .withMessage("Sub Total amount is required"),
    body("gst_amount").notEmpty().withMessage("Gst amount is required"),
    body("total_amount").notEmpty().withMessage("Total amount is required"),
  ],
  validateRequest,
  createOrder,
);

router.post(
  "/get-qrcode",
  [
    body("phone").notEmpty().withMessage("Phone number is required"),
    body("country_code").notEmpty().withMessage("Country code is required"),
  ],
  validateRequest,
  getVisitorByPhone,
);

router.post(
  "/verify-payment",
  [
    body("order_id").notEmpty().withMessage("Order id is required"),
    body("payment_id").notEmpty().withMessage("Payment id is required"),
    body("razorpay_signature")
      .notEmpty()
      .withMessage("Razorpay Signature is required"),
  ],
  validateRequest,
  verifyPayment,
);

router.get("/preview-pdf", previewPdf);

router.post(
  "/webhook-rzp",
  express.raw({ type: "application/json" }),
  webhookPayment,
);

router.post("/dummy-send-mail", dummySendMail);



// router.post(
//  "/coupon/validate",
//  validateCouponApi
// );

router.post(
  "/coupon/validate",
  (req, res, next) => {
    console.log("COUPON ROUTE HIT");
    console.log("BODY =", req.body);
    next();
  },
  validateCouponApi
);

router.post("/find-visitor", findVisitor);

module.exports = router;
