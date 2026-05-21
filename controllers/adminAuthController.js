const { verifyAdminCredentials, signAdminToken, touchAdminActivity } = require("../services/adminAuth");
const { logAdminAction } = require("../services/auditLog");
const { extractClientInfo, getClientIp, withClientDetails } = require("../services/clientInfo");
const { fail } = require("../services/responses");

async function loginAdmin(req, res) {
  const { email, password, clientInfo: bodyClientInfo } = req.body || {};
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const clientInfo = extractClientInfo(req, bodyClientInfo);
  const ipAddress = getClientIp(req);

  if (!email || !password) return fail(res, 400, "Email and password are required.");

  try {
    const result = await verifyAdminCredentials(email, password);
    if (!result.ok) {
      await logAdminAction(normalizedEmail || "unknown", "LOGIN_FAILED", "POST", "/api/admin/auth/login", {
        details: withClientDetails({ success: false }, clientInfo),
        statusCode: 401,
        errorMessage: result.reason || "Invalid credentials.",
        ipAddress,
      });
      return fail(res, 401, result.reason || "Invalid credentials.");
    }

    await touchAdminActivity(email);

    const token = signAdminToken({ email: normalizedEmail });

    await logAdminAction(normalizedEmail, "LOGIN", "POST", "/api/admin/auth/login", {
      details: withClientDetails({ success: true }, clientInfo),
      statusCode: 200,
      ipAddress,
    });

    return res.status(200).json({ token });
  } catch (err) {
    await logAdminAction(normalizedEmail || "unknown", "LOGIN_FAILED", "POST", "/api/admin/auth/login", {
      details: withClientDetails({ success: false }, clientInfo),
      statusCode: 500,
      errorMessage: err?.message || "Failed to login.",
      ipAddress,
    });
    return fail(res, 500, "Failed to login.", err?.message);
  }
}

async function logoutAdmin(req, res) {
  const clientInfo = extractClientInfo(req, req.body?.clientInfo);

  try {
    await logAdminAction(req.admin.email, "LOGOUT", "POST", "/api/admin/auth/logout", {
      details: withClientDetails({ success: true }, clientInfo),
      statusCode: 200,
      ipAddress: getClientIp(req),
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return fail(res, 500, "Failed to logout.", err?.message);
  }
}

module.exports = { loginAdmin, logoutAdmin };
