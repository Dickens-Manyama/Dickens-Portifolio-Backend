const router = require("express").Router();
const { getSkills } = require("../controllers/skillsController");

router.get("/", getSkills);

module.exports = router;

