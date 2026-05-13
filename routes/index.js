const router = require("express").Router();

router.use("/profile", require("./profile"));
router.use("/skills", require("./skills"));
router.use("/projects", require("./projects"));
router.use("/contact", require("./contact"));

module.exports = router;

