const { prisma } = require("../lib/prisma");
const { ok, fail } = require("../services/responses");

function splitList(value, pattern) {
  if (!value) return [];
  const parts = value.split(pattern).map((item) => item.trim()).filter(Boolean);
  return parts.length ? parts : [value.trim()];
}

const DEFAULT_STRENGTHS = [
  "Practical problem solving for real-world needs",
  "End-to-end system building (backend, APIs, data pipelines)",
  "Comfortable across software and data science work",
  "Fast learner who adapts to new tools",
  "Clear, clean, and maintainable code",
  "Collaborative communication in teams",
  "Focus on reliability, performance, and scale",
];

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
    profileImageUrl: profile.profileImageUrl ?? "",
    careerObjective: profile.careerObjective ?? "",
    strengths:
      Array.isArray(profile.strengths) && profile.strengths.length
        ? profile.strengths
        : DEFAULT_STRENGTHS,
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

