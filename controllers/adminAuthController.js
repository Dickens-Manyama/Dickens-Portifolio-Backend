const { verifyAdminCredentials, signAdminToken } = require("../services/adminAuth");
const { fail } = require("../services/responses");

async function loginAdmin(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return fail(res, 400, "Email and password are required.");

  try {
    const result = await verifyAdminCredentials(email, password);
    if (!result.ok) return fail(res, 401, result.reason || "Invalid credentials.");

    const token = signAdminToken({ email: String(email).trim().toLowerCase() });
    return res.status(200).json({ token });
  } catch (err) {
    return fail(res, 500, "Failed to login.", err?.message);
  }
}

module.exports = { loginAdmin };
