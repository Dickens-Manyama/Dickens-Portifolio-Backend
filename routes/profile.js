const router = require("express").Router();
const { getProfile, getProfileCv } = require("../controllers/profileController");

router.get("/", getProfile);
router.get("/cv", getProfileCv);

module.exports = router;

