const router = require("express").Router();
const { getContacts, postContact } = require("../controllers/contactController");

router.get("/", getContacts);
router.post("/", postContact);

module.exports = router;

