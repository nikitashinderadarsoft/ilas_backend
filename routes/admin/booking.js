const {
  getGeneralVisitorData,
  getBusinessVisitorData,
  updateBusinessVisitorStatus,
  getExhibitorInviteeData,
  getVipData,
  checkinVisitor,
  refreshGeneralVisitorPayment,
  resendGeneralVisitorPass,
  resendBusinessVisitorPass,
  getAllExhibitorInvitees,
} = require("../../controllers/admin/booking");
const router = require("express").Router();
const { body } = require("express-validator");
const { validateRequest } = require("../../middlewares/errorHandler");
const { authenticate } = require("../../middlewares/auth");

router.post("/general-visitor-list", getGeneralVisitorData);

router.post("/business-visitor-list", getBusinessVisitorData);

router.post("/exhibitor-invitee-list", getExhibitorInviteeData);

router.post("/all-exhibitor-invitee-list", getAllExhibitorInvitees);

router.post("/vip-list", getVipData);

router.post(
  "/checkin-user",
  [
    body("role").notEmpty().withMessage("Role is required"),
    body("user_id").notEmpty().withMessage("User id is required"),
  ],
  validateRequest,
  checkinVisitor,
);

router.post(
  "/update-business-visitor-status",
  [
    body("id").notEmpty().withMessage("Id is required"),
    body("booking_status").notEmpty().withMessage("Status is required"),
  ],
  validateRequest,
  updateBusinessVisitorStatus,
);

router.post(
  "/general-visitor-refresh-payment",
  [body("id").notEmpty().withMessage("Id is required")],
  validateRequest,
  refreshGeneralVisitorPayment,
);

router.post(
  "/general-visitor-resend-pass",
  [body("id").notEmpty().withMessage("Id is required")],
  validateRequest,
  resendGeneralVisitorPass,
);

router.post(
  "/business-visitor-resend-pass",
  [body("id").notEmpty().withMessage("Id is required")],
  validateRequest,
  resendBusinessVisitorPass,
);

module.exports = router;
