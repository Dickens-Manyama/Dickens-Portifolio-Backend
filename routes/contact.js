const router = require("express").Router();
const { postContact } = require("../controllers/contactController");
const { contactRateLimit } = require("../services/security");

router.post("/", contactRateLimit, postContact);

module.exports = router;

