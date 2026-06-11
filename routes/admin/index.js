const router = require("express").Router();

router.use(require("./user"));
router.use(require("./booking"));
router.use("/vip", require("./vip"));
router.use("/rsvp", require("./rsvp"));
router.use("/relation-managers", require("./relationManager"));
router.use("/exhibitor-staff", require("./exhibitorStaff"));
router.use("/associations", require("./association"))


module.exports = router;
