const fs = require("fs").promises;
const path = require("path");
const { ok, fail } = require("../services/responses");

const CV_DIR = path.join(__dirname, "..", "public", "uploads", "cv");
const METADATA_FILE = path.join(CV_DIR, "current.json");

async function ensureCvDir() {
  try {
    await fs.mkdir(CV_DIR, { recursive: true });
  } catch (e) {
    // ignore
  }
}

function safeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 240);
}

async function getCvMetadata(req, res) {
  try {
    await ensureCvDir();
    let meta = null;
    try {
      const raw = await fs.readFile(METADATA_FILE, "utf8");
      meta = JSON.parse(raw);
    } catch (e) {
      meta = null;
    }
    return ok(res, meta);
  } catch (err) {
    return fail(res, 500, "Failed to load CV metadata.", err?.message);
  }
}

async function uploadCv(req, res) {
  try {
    const { filename, contentBase64 } = req.body || {};
    if (!filename || !contentBase64) return fail(res, 400, "Missing filename or content.");

    await ensureCvDir();
    const clean = safeFilename(filename);
    const uniqueName = `${Date.now()}-${clean}`;
    const filePath = path.join(CV_DIR, uniqueName);

    const buffer = Buffer.from(String(contentBase64).split(",").pop(), "base64");
    await fs.writeFile(filePath, buffer);

    const meta = {
      filename: uniqueName,
      originalName: filename,
      url: `/public/uploads/cv/${uniqueName}`,
      uploadedAt: new Date().toISOString(),
    };

    await fs.writeFile(METADATA_FILE, JSON.stringify(meta, null, 2), "utf8");

    return ok(res, meta);
  } catch (err) {
    return fail(res, 500, "Failed to upload CV.", err?.message);
  }
}

async function deleteCv(req, res) {
  try {
    await ensureCvDir();
    let meta = null;
    try {
      const raw = await fs.readFile(METADATA_FILE, "utf8");
      meta = JSON.parse(raw);
    } catch (e) {
      meta = null;
    }

    if (meta && meta.filename) {
      const filePath = path.join(CV_DIR, meta.filename);
      try {
        await fs.unlink(filePath);
      } catch (e) {
        // ignore if missing
      }
    }

    try {
      await fs.unlink(METADATA_FILE);
    } catch (e) {
      // ignore
    }

    return ok(res, { ok: true });
  } catch (err) {
    return fail(res, 500, "Failed to delete CV.", err?.message);
  }
}

async function getCvContent(req, res) {
  try {
    await ensureCvDir();
    let meta = null;
    try {
      const raw = await fs.readFile(METADATA_FILE, "utf8");
      meta = JSON.parse(raw);
    } catch (e) {
      return fail(res, 404, "No CV uploaded.");
    }

    const filePath = path.join(CV_DIR, meta.filename);
    const ext = path.extname(meta.filename).toLowerCase();
    const textExt = [".txt", ".md", ".html", ".json"];

    if (!textExt.includes(ext)) {
      return fail(res, 415, "CV is not editable as text.");
    }

    const content = await fs.readFile(filePath, "utf8");
    return ok(res, { filename: meta.filename, content });
  } catch (err) {
    return fail(res, 500, "Failed to read CV content.", err?.message);
  }
}

module.exports = { getCvMetadata, uploadCv, deleteCv, getCvContent };
