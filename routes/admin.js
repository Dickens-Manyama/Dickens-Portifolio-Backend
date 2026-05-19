const router = require("express").Router();
const { loginAdmin } = require("../controllers/adminAuthController");
const { requireAdminAuth } = require("../services/adminAuth");
const { getAdminProfile, upsertAdminProfile } = require("../controllers/adminProfileController");
const {
  getAdminProjects,
  createAdminProject,
  updateAdminProject,
  deleteAdminProject,
} = require("../controllers/adminProjectsController");
const {
  getAdminSkills,
  createAdminSkill,
  updateAdminSkill,
  deleteAdminSkill,
} = require("../controllers/adminSkillsController");
const {
  getAdminEducation,
  createAdminEducation,
  updateAdminEducation,
  deleteAdminEducation,
} = require("../controllers/adminEducationController");
const { getAdminContacts, deleteAdminContact, getAdminSession } = require("../controllers/adminContactsController");
const { getCvMetadata, uploadCv, deleteCv, getCvContent } = require("../controllers/adminCvController");

router.post("/auth/login", loginAdmin);

router.use(requireAdminAuth);

router.get("/profile", getAdminProfile);
router.put("/profile", upsertAdminProfile);

router.get("/projects", getAdminProjects);
router.post("/projects", createAdminProject);
router.put("/projects/:id", updateAdminProject);
router.delete("/projects/:id", deleteAdminProject);

router.get("/skills", getAdminSkills);
router.post("/skills", createAdminSkill);
router.put("/skills/:id", updateAdminSkill);
router.delete("/skills/:id", deleteAdminSkill);

router.get("/education", getAdminEducation);
router.post("/education", createAdminEducation);
router.put("/education/:id", updateAdminEducation);
router.delete("/education/:id", deleteAdminEducation);

router.get("/contacts", getAdminContacts);
router.delete("/contacts/:id", deleteAdminContact);
router.get("/session", getAdminSession);
router.get("/cv", getCvMetadata);
router.post("/cv", uploadCv);
router.delete("/cv", deleteCv);
router.get("/cv/content", getCvContent);

module.exports = router;
