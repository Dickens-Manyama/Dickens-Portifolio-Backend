const router = require("express").Router();
const { getProfile } = require("../controllers/profileController");

router.get("/", getProfile);

module.exports = router;

