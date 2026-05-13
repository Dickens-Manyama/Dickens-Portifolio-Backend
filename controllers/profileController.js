const { prisma } = require("../lib/prisma");
const { ok, fail } = require("../services/responses");

function splitList(value, pattern) {
  if (!value) return [];
  const parts = value.split(pattern).map((item) => item.trim()).filter(Boolean);
  return parts.length ? parts : [value.trim()];
}

function mapProfile(profile) {
  return {
    id: profile.id,
    name: profile.name,
    titles: splitList(profile.title, /[|,]/),
    professionalSummary: profile.summary,
    email: profile.email,
    phoneNumbers: splitList(profile.phone, /[\/|,]/),
    githubUrl: profile.github,
    linkedinUrl: profile.linkedin,
    careerObjective: "",
    strengths: [],
  };
}

async function getProfile(req, res) {
  try {
    const profile = await prisma.profile.findFirst({ orderBy: { id: "asc" } });
    if (!profile) return fail(res, 404, "Profile not found.");
    return ok(res, mapProfile(profile));
  } catch (err) {
    return fail(res, 500, "Failed to load profile.", err?.message);
  }
}

module.exports = { getProfile };

