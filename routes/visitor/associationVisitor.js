const router = require("express").Router();
const { body } = require("express-validator");

const { validateRequest } = require("../../middlewares/errorHandler");

const {
  createAssociationVisitor,
} = require("../../controllers/visitor/associationVisitor");

router.post(
  "/association-booking",
  createAssociationVisitor
);

module.exports = router;