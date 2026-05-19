const { prisma } = require("../lib/prisma");
const { ok, fail } = require("../services/responses");
const CV_DOWNLOAD_PATH = "/api/profile/cv";

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
    cvUrl: profile.cvData ? CV_DOWNLOAD_PATH : "",
    cvOriginalName: profile.cvData ? profile.cvOriginalName || "" : "",
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

async function getProfileCv(req, res) {
  try {
    const profile = await prisma.profile.findFirst({ orderBy: { id: "asc" } });
    if (!profile || !profile.cvData) return fail(res, 404, "CV not found.");

    const buffer = Buffer.from(profile.cvData, "base64");
    const mime = profile.cvMime || "application/octet-stream";
    const filename = profile.cvOriginalName || profile.cvFileName || "cv";

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/\"/g, "")}"`);
    return res.status(200).send(buffer);
  } catch (err) {
    return fail(res, 500, "Failed to load CV.", err?.message);
  }
}

module.exports = { getProfile, getProfileCv };

