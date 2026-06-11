const router = require("express").Router();
const { body } = require("express-validator");

const { validateRequest } = require("../../middlewares/errorHandler");

const {
  createAssociationVisitor,
} = require("../../controllers/visitor/associationVisitor");

router.post(
  "/",
  [
    body("title").notEmpty(),
    body("full_name").notEmpty(),
    body("company_name").notEmpty(),
    body("designation").notEmpty(),
    body("email").isEmail(),
    body("phone").notEmpty(),
    body("country").notEmpty(),
    body("city").notEmpty(),
    body("association_id").isMongoId(),
  ],
  validateRequest,
  createAssociationVisitor
);

module.exports = router;