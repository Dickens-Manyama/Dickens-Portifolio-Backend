const router = require("express").Router();
const { getProjects } = require("../controllers/projectsController");

router.get("/", getProjects);

module.exports = router;

