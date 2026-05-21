const { prisma } = require("../lib/prisma");
const { ok, fail } = require("../services/responses");
const { exportCvBuffer, mimeForFormat } = require("../services/cvExport");
const CV_DOWNLOAD_PATH = "/api/profile/cv";

function decodeCvBase64(data) {
  const cleaned = String(data || "").replace(/\s+/g, "");
  if (!cleaned) return Buffer.alloc(0);
  return Buffer.from(cleaned, "base64");
}

function isDocxBuffer(buffer) {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function isPdfBuffer(buffer) {
  return buffer.length >= 4 && buffer.slice(0, 4).toString("ascii") === "%PDF";
}

function safeContentDisposition(filename) {
  const safe = String(filename || "cv.docx").replace(/[^\w.\- ]/g, "_");
  const encoded = encodeURIComponent(safe);
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

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
    cvUrl: profile.cvData ? "/api/cv" : "",
    cvOriginalName: profile.cvData ? profile.cvOriginalName || "" : "",
    cvCacheKey: profile.cvFileName || "",
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

function formatFromFilename(filename, mime) {
  const lower = String(filename || "").toLowerCase();
  if (lower.endsWith(".pdf") || mime === "application/pdf") return "pdf";
  if (lower.endsWith(".html") || (mime || "").includes("html")) return "html";
  if (lower.endsWith(".txt") || (mime || "").startsWith("text/")) return "txt";
  return "docx";
}

async function getProfileCv(req, res) {
  try {
    const profile = await prisma.profile.findFirst({ orderBy: { id: "asc" } });
    if (!profile || (!profile.cvData && !profile.cvSourceHtml)) {
      return fail(res, 404, "CV not found.");
    }

    let filename = profile.cvOriginalName || profile.cvFileName || "cv.docx";
    let mime = profile.cvMime || "application/octet-stream";
    let buffer = Buffer.alloc(0);
    const format = formatFromFilename(filename, mime);

    if (profile.cvSourceHtml) {
      try {
        buffer = await exportCvBuffer(profile.cvSourceHtml, format === "pdf" ? "pdf" : format === "html" ? "html" : format === "txt" ? "txt" : "docx");
        mime = mimeForFormat(format === "doc" ? "docx" : format);
        if (format === "docx" || format === "doc") {
          filename = filename.replace(/\.[^.]+$/, "") + ".docx";
        }
      } catch (exportErr) {
        console.error("[cv] export from source failed:", exportErr?.message);
      }
    }

    if (!buffer.length && profile.cvData) {
      buffer = decodeCvBase64(profile.cvData);
    }

    if (!buffer.length) return fail(res, 404, "CV file is empty.");

    if (mime.includes("wordprocessingml") || filename.toLowerCase().endsWith(".docx")) {
      if (!isDocxBuffer(buffer)) {
        return fail(res, 500, "CV file is corrupted. Please re-save from the admin editor as DOCX.");
      }
      mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    if (mime === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
      if (!isPdfBuffer(buffer)) {
        return fail(res, 500, "CV PDF file is corrupted. Please re-save from the admin editor.");
      }
    }

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Content-Disposition", safeContentDisposition(filename));
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).end(buffer);
  } catch (err) {
    return fail(res, 500, "Failed to load CV.", err?.message);
  }
}

module.exports = { getProfile, getProfileCv };

