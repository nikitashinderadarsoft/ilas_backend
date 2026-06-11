const {
  createNewUser,
  getUser,
  importUsers,
  updateUserProfile,
  loginUser,
  logoutUser,
  getUserById,
  dashboardStats,
  getProfile,
  getAllExhibitorCoupons,
  getExhibitorCoupons,
} = require("../../controllers/admin/user");
const router = require("express").Router();
const { body } = require("express-validator");
const { validateRequest } = require("../../middlewares/errorHandler");
const { authenticate } = require("../../middlewares/auth");
const { upload } = require("../../helpers/awsUpload");

router.get("/dashboard-stats", authenticate, dashboardStats);
router.get("/profile", authenticate, getProfile);

router.post(
  "/create-exhibitor",
  authenticate,
  [
    body("full_name").notEmpty().withMessage("Full Name is required"),
    body("email").notEmpty().withMessage("Email is required").isEmail().withMessage("Invalid email"),
    body("phone").notEmpty().withMessage("Phone number is required"),
    body("country_code").notEmpty().withMessage("Country code is required"),
    body("country").optional().isString().withMessage("Country must be text"),
    body("company_name").optional().isString().withMessage("Company name must be text"),
    body("company_email").optional().isEmail().withMessage("Invalid company email"),
    body("company_phone").optional().isString().withMessage("Company phone must be text"),
    body("company_phone_code").optional().isString().withMessage("Company phone code must be text"),
    body("invitee_limit").optional().isInt({ min: 0 }).withMessage("Invitee limit must be a non-negative integer"),
    body("stall_size").optional().isInt({ min: 0 }).withMessage("Stall size must be a non-negative integer"),
  ],
  validateRequest,
  createNewUser,
);

router.post("/user-list", authenticate, getUser);
router.get("/user/:id", authenticate, getUserById);
router.post(
  "/user-login",
  [body("email").notEmpty().withMessage("Email is required"), body("password").notEmpty().withMessage("Password is required")],
  validateRequest,
  loginUser,
);

router.post("/user-bulk-import", authenticate, upload.single("user_file"), importUsers);

router.post(
  "/update-profile",
  [
    body("user_id").notEmpty().withMessage("User ID is required."),
    body("full_name").optional().isString().withMessage("Full Name must be text"),
    body("country").optional().isString().withMessage("Country must be text"),
    body("company_name").optional().isString().withMessage("Company Name must be text"),
    body("company_email").optional().isEmail().withMessage("Invalid Company Email"),
    body("company_phone").optional().isString().withMessage("Company Phone must be text"),
    body("invitee_limit").optional().isInt({ min: 0 }).withMessage("Invitee Limit must be a non-negative integer"),
    body("stall_size").optional().isInt({ min: 0 }).withMessage("Stall Size must be a non-negative integer"),
  ],
  validateRequest,
  updateUserProfile,
);

router.post("/logout", logoutUser);

router.post(
  "/exhibitor-coupons",
  authenticate,
  getAllExhibitorCoupons
);

router.get(
  "/exhibitor-coupons/:exhibitor_id",
  authenticate,
  getExhibitorCoupons
);

module.exports = router;
