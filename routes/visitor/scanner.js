const router = require("express").Router();
const { scanTicket } = require("../../controllers/visitor/scanner");

router.post("/scan", scanTicket);

module.exports = router;
