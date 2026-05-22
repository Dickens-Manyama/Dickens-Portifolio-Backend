const router = require("express").Router();
const { loginAdmin, logoutAdmin } = require("../controllers/adminAuthController");
const { requireAdminAuth, requireSuperAdmin } = require("../services/adminAuth");
const { loginRateLimit } = require("../services/security");
const { auditLogMiddleware } = require("../services/auditLogMiddleware");
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
const {
  getAdminsController,
  createAdminController,
  deleteAdminController,
  updateAdminController,
} = require("../controllers/adminManagementController");
const {
  getAuditLogsController,
  getAuditLogStatsController,
  getAuditLogDetailController,
  exportAuditLogsController,
} = require("../controllers/auditLogsController");

router.post("/auth/login", loginRateLimit, loginAdmin);

router.use(requireAdminAuth);
router.use(auditLogMiddleware);

router.post("/auth/logout", logoutAdmin);

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

router.get("/admins", requireSuperAdmin, getAdminsController);
router.post("/admins", requireSuperAdmin, createAdminController);
router.delete("/admins/:id", requireSuperAdmin, deleteAdminController);
router.put("/admins/:id", requireSuperAdmin, updateAdminController);

router.get("/cv", getCvMetadata);
router.post("/cv", uploadCv);
router.delete("/cv", deleteCv);
router.get("/cv/content", getCvContent);

// Audit Log Routes (Read-Only - No Delete)
router.get("/logs", getAuditLogsController);
router.get("/logs/stats", getAuditLogStatsController);
router.get("/logs/:id", getAuditLogDetailController);
router.get("/logs/export/csv", exportAuditLogsController);

module.exports = router;
