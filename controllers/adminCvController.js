const { prisma } = require("../lib/prisma");
const { ok, fail } = require("../services/responses");

const CV_DOWNLOAD_PATH = "/api/profile/cv";

async function ensureCvColumns() {
  await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS cv_original_name TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS cv_filename TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS cv_mime TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS cv_data TEXT;`);
}

function safeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 240);
}

async function getCvMetadata(req, res) {
  try {
    await ensureCvColumns();
    const profile = await prisma.profile.findFirst({ orderBy: { id: "asc" } });
    if (!profile || !profile.cvData) return ok(res, null);

    return ok(res, {
      filename: profile.cvFileName || profile.cvOriginalName || "cv",
      originalName: profile.cvOriginalName || profile.cvFileName || "cv",
      mime: profile.cvMime || "application/octet-stream",
      url: CV_DOWNLOAD_PATH,
    });
  } catch (err) {
    return fail(res, 500, "Failed to load CV metadata.", err?.message);
  }
}

async function uploadCv(req, res) {
  try {
    await ensureCvColumns();

    const { filename, contentBase64, mimeType } = req.body || {};
    if (!filename || !contentBase64) return fail(res, 400, "Missing filename or content.");

    const profile = await prisma.profile.findFirst({ orderBy: { id: "asc" } });
    if (!profile) return fail(res, 404, "Profile not found.");

    const base64 = String(contentBase64).includes(",") ? String(contentBase64).split(",").pop() : String(contentBase64);
    const mimeFromDataUrl = String(contentBase64).startsWith("data:")
      ? String(contentBase64).slice(5, String(contentBase64).indexOf(";base64,"))
      : "";
    const clean = safeFilename(filename);
    const storedFilename = `${Date.now()}-${clean}`;

    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        cvOriginalName: filename,
        cvFileName: storedFilename,
        cvMime: mimeType || mimeFromDataUrl || "application/octet-stream",
        cvData: base64,
      },
    });

    return ok(res, {
      filename: storedFilename,
      originalName: filename,
      mime: mimeType || mimeFromDataUrl || "application/octet-stream",
      url: CV_DOWNLOAD_PATH,
    });
  } catch (err) {
    return fail(res, 500, "Failed to upload CV.", err?.message);
  }
}

async function deleteCv(req, res) {
  try {
    await ensureCvColumns();
    const profile = await prisma.profile.findFirst({ orderBy: { id: "asc" } });
    if (!profile) return fail(res, 404, "Profile not found.");

    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        cvOriginalName: null,
        cvFileName: null,
        cvMime: null,
        cvData: null,
      },
    });

    return ok(res, { ok: true });
  } catch (err) {
    return fail(res, 500, "Failed to delete CV.", err?.message);
  }
}

async function getCvContent(req, res) {
  try {
    await ensureCvColumns();
    const profile = await prisma.profile.findFirst({ orderBy: { id: "asc" } });
    if (!profile || !profile.cvData) return fail(res, 404, "No CV uploaded.");

    const ext = (profile.cvFileName || profile.cvOriginalName || "").toLowerCase().split(".").pop();
    const textExt = [".txt", ".md", ".html", ".json"];

    if (!textExt.includes(`.${ext}`) && !(profile.cvMime || "").startsWith("text/")) {
      return fail(res, 415, "CV is not editable as text.");
    }

    const content = Buffer.from(profile.cvData, "base64").toString("utf8");
    return ok(res, { filename: profile.cvFileName || profile.cvOriginalName || "cv", content });
  } catch (err) {
    return fail(res, 500, "Failed to read CV content.", err?.message);
  }
}

module.exports = { getCvMetadata, uploadCv, deleteCv, getCvContent };
