const {
  createExhibitorInviteeBooking,
  validateExhibitorInviteeQR,
  validateCoupon,
} = require("../../controllers/visitor/exhibitorinvitee");
const router = require("express").Router();
const { body, param } = require("express-validator");
const { validateRequest } = require("../../middlewares/errorHandler");

router.post(
  "/booking",
  [
    body("full_name").notEmpty().withMessage("Full name is required"),
    body("exhibitor_id").notEmpty().withMessage("Exhibitor id is required"),
    body("email").notEmpty().withMessage("Email is required"),
    body("phone").notEmpty().withMessage("Phone number is required"),
    body("country_code").notEmpty().withMessage("Country code is required"),
    body("company_name").notEmpty().withMessage("Company name is required"),
   // body("relationship").notEmpty().withMessage("Relationship is required"),
    body("visitor_profile")
      .notEmpty()
      .withMessage("Visitor profile is required"),
  ],
  validateRequest,
  createExhibitorInviteeBooking,
);

router.get(
  "/validate/:exhibitor_id",
  [
    param("exhibitor_id")
      .notEmpty()
      .withMessage("Exhibitor id is required")
      .isMongoId()
      .withMessage("Invalid exhibitor id"),
  ],
  validateRequest,
  validateExhibitorInviteeQR,
);

router.post(
  "/validate-coupon",
  validateCoupon
);

module.exports = router;
