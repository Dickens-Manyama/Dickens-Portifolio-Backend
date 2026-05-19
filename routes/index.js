const router = require("express").Router();

router.use("/profile", require("./profile"));
router.use("/skills", require("./skills"));
router.use("/projects", require("./projects"));
router.use("/education", require("./education"));
router.use("/contact", require("./contact"));
router.use("/admin", require("./admin"));

module.exports = router;

