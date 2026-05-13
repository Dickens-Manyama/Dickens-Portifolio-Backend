function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function isValidEmail(email) {
  if (!isNonEmptyString(email)) return false;
  // Simple, safe validator (good enough for contact forms).
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validateContactPayload(body) {
  const errors = {};

  if (!isNonEmptyString(body?.name)) errors.name = "Name is required.";
  if (!isValidEmail(body?.email)) errors.email = "A valid email is required.";
  if (!isNonEmptyString(body?.message)) errors.message = "Message is required.";

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      name: String(body?.name ?? "").trim(),
      email: String(body?.email ?? "").trim(),
      message: String(body?.message ?? "").trim(),
    },
  };
}

module.exports = { validateContactPayload };

