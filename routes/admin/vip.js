const router = require("express").Router();
const { body, param } = require("express-validator");
const { validateRequest } = require("../../middlewares/errorHandler");
const { authenticate } = require("../../middlewares/auth");
const { createVipBooking, getVipList, getVipById, updateVip, deleteVip, resendVipTicket } = require("../../controllers/admin/vip");

router.post(
  "/booking",
  [
    body("full_name").notEmpty().withMessage("Full name is required"),
    body("email").notEmpty().withMessage("Email is required"),
    body("phone").notEmpty().withMessage("Phone number is required"),
    body("country_code").notEmpty().withMessage("Country code is required"),
    body("company_name").notEmpty().withMessage("Company name is required"),
    body("invitedByRM").notEmpty().isMongoId().withMessage("invitedByRM is required and must be a valid id"),
  ],
  validateRequest,
  createVipBooking,
);

router.use(authenticate);

router.post("/list", getVipList);

router.get("/:id", [param("id").notEmpty().withMessage("Id is required")], validateRequest, getVipById);

router.put("/:id", [param("id").notEmpty().withMessage("Id is required")], validateRequest, updateVip);

router.delete("/:id", [param("id").notEmpty().withMessage("Id is required")], validateRequest, deleteVip);

router.post("/:id/resend", [param("id").notEmpty().withMessage("Id is required")], validateRequest, resendVipTicket);

module.exports = router;
