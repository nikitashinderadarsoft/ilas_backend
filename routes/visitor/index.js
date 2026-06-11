const { authenticate } = require("../../middlewares/auth");

const router = require("express").Router();

router.use(require("./visitor"));
router.use("/business-visitor", require("./businessvisitor"));
router.use("/exhibitor", require("./exhibitorinvitee"));
router.use("/association-visitors", require("./associationVisitor"))

module.exports = router;
