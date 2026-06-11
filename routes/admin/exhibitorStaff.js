const router = require("express").Router();
const { body, param } = require("express-validator");
const { validateRequest } = require("../../middlewares/errorHandler");
const { authenticate } = require("../../middlewares/auth");
const {
  createExhibitorStaff,
  getExhibitorStaff,
  updateExhibitorStaff,
  deleteExhibitorStaff,
  getExhibitorStaffById
} = require("../../controllers/admin/exhibitorStaff");

// Public routes


// Protected routes
router.use(authenticate);

router.get("/", getExhibitorStaff);
router.get("/single/:staff_id", getExhibitorStaffById);
router.get("/:exhibitor_id", getExhibitorStaff);


router.post(
  "/",
  [
    body("full_name").notEmpty().withMessage("Full name is required"),
    body("display_name").notEmpty().withMessage("Display name is required"),
    body("email").notEmpty().isEmail().withMessage("Valid email is required"),
    body("phone").notEmpty().withMessage("Phone is required"),
    body("country_code").notEmpty().withMessage("Country code is required"),
    body("country").notEmpty().withMessage("Country is required"),
    body("exhibitor_id")                                        
      .if((value, { req }) => req.user?.role === "ADMIN")
      .notEmpty()
      .withMessage("Exhibitor is required"),

   
  ],
  validateRequest,
  createExhibitorStaff
);

router.put(
  "/:staff_id",
  [
    param("staff_id").notEmpty().withMessage("Staff ID is required"),
    body("email").optional().isEmail().withMessage("Valid email is required"),
  ],
  validateRequest,
  updateExhibitorStaff
);

router.delete(
  "/:staff_id",
  [param("staff_id").notEmpty().withMessage("Staff ID is required")],
  validateRequest,
  deleteExhibitorStaff
);

module.exports = router;