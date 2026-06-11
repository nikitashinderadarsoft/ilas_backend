const router = require("express").Router();
const { body, param } = require("express-validator");
const { validateRequest } = require("../../middlewares/errorHandler");
const { authenticate } = require("../../middlewares/auth");
const { createRsvpBooking, getRsvpList, getRsvpById, updateRsvp, deleteRsvp, resendRsvpTicket } = require("../../controllers/admin/rsvp");

router.use(authenticate);

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
  createRsvpBooking,
);

router.post("/list", getRsvpList);

router.get("/:id", [param("id").notEmpty().withMessage("Id is required")], validateRequest, getRsvpById);

router.put("/:id", [param("id").notEmpty().withMessage("Id is required")], validateRequest, updateRsvp);

router.delete("/:id", [param("id").notEmpty().withMessage("Id is required")], validateRequest, deleteRsvp);

router.post("/:id/resend", [param("id").notEmpty().withMessage("Id is required")], validateRequest, resendRsvpTicket);

module.exports = router;
