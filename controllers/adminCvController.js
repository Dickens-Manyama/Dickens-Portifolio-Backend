const { prisma } = require("../lib/prisma");
const { ok, fail } = require("../services/responses");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const PDFDocument = require("pdfkit");

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

function buildPdfBuffer(text) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(12);
    const lines = String(text || "").split(/\r?\n/);
    lines.forEach((line) => {
      doc.text(line, { width: 500, lineGap: 3 });
    });
    doc.end();
  });
}

function ensurePdfName(fileName) {
  const base = String(fileName || "cv").replace(/\.[^.]+$/, "");
  return `${base}.pdf`;
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

    const { filename, contentBase64, mimeType, contentText, outputFormat } = req.body || {};
    if (!filename || (!contentBase64 && !contentText)) return fail(res, 400, "Missing filename or content.");

    const profile = await prisma.profile.findFirst({ orderBy: { id: "asc" } });
    if (!profile) return fail(res, 404, "Profile not found.");

    const wantsPdf = outputFormat === "pdf";
    const clean = safeFilename(filename);
    const storedFilename = wantsPdf ? `${Date.now()}-${ensurePdfName(clean)}` : `${Date.now()}-${clean}`;

    let buffer;
    let mimeValue = mimeType || "application/octet-stream";

    if (contentText !== undefined && contentText !== null) {
      if (wantsPdf) {
        buffer = await buildPdfBuffer(contentText);
        mimeValue = "application/pdf";
      } else {
        buffer = Buffer.from(String(contentText), "utf8");
        mimeValue = "text/plain";
      }
    } else {
      const base64 = String(contentBase64).includes(",") ? String(contentBase64).split(",").pop() : String(contentBase64);
      const mimeFromDataUrl = String(contentBase64).startsWith("data:")
        ? String(contentBase64).slice(5, String(contentBase64).indexOf(";base64,"))
        : "";
      buffer = Buffer.from(base64, "base64");
      mimeValue = mimeType || mimeFromDataUrl || mimeValue;
      if (wantsPdf) {
        buffer = await buildPdfBuffer(buffer.toString("utf8"));
        mimeValue = "application/pdf";
      }
    }

    const base64 = buffer.toString("base64");

    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        cvOriginalName: filename,
        cvFileName: storedFilename,
        cvMime: mimeValue,
        cvData: base64,
      },
    });

    return ok(res, {
      filename: storedFilename,
      originalName: filename,
      mime: mimeValue,
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

    const fileName = profile.cvFileName || profile.cvOriginalName || "";
    const ext = fileName.toLowerCase().split(".").pop();
    const textExt = [".txt", ".md", ".html", ".json"];
    const buffer = Buffer.from(profile.cvData, "base64");

    if (!textExt.includes(`.${ext}`) && !(profile.cvMime || "").startsWith("text/")) {
      if (ext === "docx" || profile.cvMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const extracted = await mammoth.extractRawText({ buffer });
        return ok(res, { filename: fileName, content: extracted.value || "" });
      }

      if (ext === "pdf" || profile.cvMime === "application/pdf") {
        const extracted = await pdfParse(buffer);
        return ok(res, { filename: fileName, content: extracted.text || "" });
      }

      return fail(res, 415, "CV is not editable as text.");
    }

    const content = buffer.toString("utf8");
    return ok(res, { filename: fileName, content });
  } catch (err) {
    return fail(res, 500, "Failed to read CV content.", err?.message);
  }
}

module.exports = { getCvMetadata, uploadCv, deleteCv, getCvContent };
