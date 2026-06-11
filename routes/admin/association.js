const router = require("express").Router();
const { body, param } = require("express-validator");
const { validateRequest } = require("../../middlewares/errorHandler");
const { authenticate } = require("../../middlewares/auth");
const {
  addAssociation,
  getAllAssociations,
  getAssociationById,
  updateAssociation,
  deleteAssociation,
  getAssociationVisitors
} = require("../../controllers/admin/association");

// Public GET routes 
router.get("/", getAllAssociations);
router.get("/visitors/:id", getAssociationVisitors);
router.get("/:id", getAssociationById);


// Protected routes
router.use(authenticate);

router.post(
  "/",
  [body("name").notEmpty().trim().withMessage("Name is required")],
  validateRequest,
  addAssociation,
);

router.put(
  "/:id",
  [
    param("id").isMongoId().withMessage("Invalid ID"),
    body("name").notEmpty().trim().withMessage("Name is required"),
  ],
  validateRequest,
  updateAssociation,
);

router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid ID")],
  validateRequest,
  deleteAssociation,
);



module.exports = router;