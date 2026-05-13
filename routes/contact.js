const router = require("express").Router();
const { postContact } = require("../controllers/contactController");

router.post("/", postContact);

module.exports = router;

