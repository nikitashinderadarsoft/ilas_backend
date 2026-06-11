const router = require("express").Router();
const { body, param } = require("express-validator");
const { validateRequest } = require("../../middlewares/errorHandler");
const { authenticate } = require("../../middlewares/auth");
const { addRM, getAllRMs, getRMById, updateRM, deleteRM } = require("../../controllers/admin/relationManager");

router.get("/", getAllRMs);
router.get("/:id", getRMById);

router.use(authenticate);
router.post("/", [body("name").notEmpty().withMessage("Name is required")], validateRequest, addRM);
router.put(
  "/:id",
  [
    param("id").isMongoId().withMessage("Invalid Relation Manager ID"),
    body("name").notEmpty().withMessage("Name is required"),
  ],
  validateRequest,
  updateRM
);
router.delete("/:id", [param("id").isMongoId().withMessage("Invalid Relation Manager ID")], validateRequest, deleteRM);
module.exports = router;
