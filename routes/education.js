const router = require("express").Router();
const { getEducation } = require("../controllers/educationController");

router.get("/", getEducation);

module.exports = router;
