const {
  createBusinessVisitor,
} = require("../../controllers/visitor/businessvisitor");
const router = require("express").Router();
const { body } = require("express-validator");
const { validateRequest } = require("../../middlewares/errorHandler");

router.post(
  "/booking",
  [
    body("full_name").notEmpty().withMessage("Full Name is required"),

    body("email")
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Invalid email"),

    body("phone").notEmpty().withMessage("Mobile Number is required"),

    body("country_code").notEmpty().withMessage("Country code is required"),

    body("city").notEmpty().withMessage("City is required"),

    body("visitor_profile")
      .notEmpty()
      .withMessage("Visitor Profile is required"),

    body("company_name").notEmpty().withMessage("Company Name is required"),

    body("designation").notEmpty().withMessage("Designation is required"),

    body("business_type").notEmpty().withMessage("Business Type is required"),

    body("years_in_business")
      .notEmpty()
      .withMessage("Years in Business is required"),

    body("visiting_date").notEmpty().withMessage("Visiting date is required"),

    body("categories").notEmpty().withMessage("Categories is required"),

    body("budget_range").notEmpty().withMessage("Budget range is required"),
  ],
  validateRequest,
  createBusinessVisitor,
);

module.exports = router;
