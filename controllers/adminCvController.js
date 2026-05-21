const { prisma } = require("../lib/prisma");
const { ok, fail } = require("../services/responses");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const {
  wrapPlainTextAsHtml,
  mimeForFormat,
  buildFilename,
  exportCvBuffer,
  stripHtml,
} = require("../services/cvExport");

/** Public download is proxied by the Vercel frontend at /api/cv */
const CV_DOWNLOAD_PATH = "/api/cv";
const SUPPORTED_FORMATS = ["pdf", "docx", "doc", "txt", "html"];

async function ensureCvColumns() {
  await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS cv_original_name TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS cv_filename TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS cv_mime TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS cv_data TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS cv_source_html TEXT;`);
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

    const { filename, contentBase64, mimeType, contentText, contentHtml, outputFormat } = req.body || {};
    if (!filename || (!contentBase64 && contentText == null && contentHtml == null)) {
      return fail(res, 400, "Missing filename or content.");
    }

    const profile = await prisma.profile.findFirst({ orderBy: { id: "asc" } });
    if (!profile) return fail(res, 404, "Profile not found.");

    const format = SUPPORTED_FORMATS.includes(outputFormat) ? outputFormat : "pdf";
    const clean = safeFilename(buildFilename(filename, format));
    const storedFilename = `${Date.now()}-${clean}`;

    let buffer;
    let mimeValue = mimeType || mimeForFormat(format);
    let originalName = buildFilename(filename, format);

    let sourceHtml = null;

    if (contentHtml != null || contentText != null) {
      sourceHtml = contentHtml != null ? String(contentHtml) : wrapPlainTextAsHtml(contentText);
      buffer = await exportCvBuffer(sourceHtml, format);
      mimeValue = mimeForFormat(format);
    } else {
      const base64 = String(contentBase64).includes(",") ? String(contentBase64).split(",").pop() : String(contentBase64);
      const mimeFromDataUrl = String(contentBase64).startsWith("data:")
        ? String(contentBase64).slice(5, String(contentBase64).indexOf(";base64,"))
        : "";
      buffer = Buffer.from(base64, "base64");
      mimeValue = mimeType || mimeFromDataUrl || mimeValue;
      originalName = filename;
    }

    if (format === "docx" || format === "doc") {
      if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
        return fail(res, 500, "Failed to generate a valid Word document. Try simplifying formatting and save again.");
      }
    }

    const base64 = buffer.toString("base64");

    const updateData = {
      cvOriginalName: originalName,
      cvFileName: storedFilename,
      cvMime: mimeValue,
      cvData: base64,
    };

    try {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { ...updateData, cvSourceHtml: sourceHtml },
      });
    } catch (updateErr) {
      await prisma.profile.update({ where: { id: profile.id }, data: updateData });
      if (sourceHtml != null) {
        await prisma.$executeRaw`
          UPDATE profiles SET cv_source_html = ${sourceHtml} WHERE id = ${profile.id}
        `;
      } else {
        await prisma.$executeRaw`
          UPDATE profiles SET cv_source_html = NULL WHERE id = ${profile.id}
        `;
      }
    }

    return ok(res, {
      filename: storedFilename,
      originalName,
      mime: mimeValue,
      url: CV_DOWNLOAD_PATH,
      format,
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
        cvSourceHtml: null,
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

    if (profile.cvSourceHtml) {
      return ok(res, {
        filename: fileName,
        content: stripHtml(profile.cvSourceHtml),
        contentHtml: profile.cvSourceHtml,
      });
    }

    const ext = fileName.toLowerCase().split(".").pop();
    const textExt = [".txt", ".md", ".html", ".json"];
    const buffer = Buffer.from(profile.cvData, "base64");

    if (!textExt.includes(`.${ext}`) && !(profile.cvMime || "").startsWith("text/")) {
      if (ext === "docx" || profile.cvMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const [textResult, htmlResult] = await Promise.all([
          mammoth.extractRawText({ buffer }),
          mammoth.convertToHtml({ buffer }),
        ]);
        const contentHtml = htmlResult.value || wrapPlainTextAsHtml(textResult.value || "");
        return ok(res, {
          filename: fileName,
          content: textResult.value || stripHtml(contentHtml),
          contentHtml,
        });
      }

      if (ext === "pdf" || profile.cvMime === "application/pdf") {
        const extracted = await pdfParse(buffer);
        const plain = extracted.text || "";
        return ok(res, {
          filename: fileName,
          content: plain,
          contentHtml: wrapPlainTextAsHtml(plain),
        });
      }

      return fail(res, 415, "CV is not editable as text.");
    }

    const raw = buffer.toString("utf8");
    const isHtml = ext === "html" || (profile.cvMime || "").includes("html");
    const contentHtml = isHtml ? raw : wrapPlainTextAsHtml(raw);
    return ok(res, {
      filename: fileName,
      content: isHtml ? stripHtml(raw) : raw,
      contentHtml,
    });
  } catch (err) {
    return fail(res, 500, "Failed to read CV content.", err?.message);
  }
}

module.exports = { getCvMetadata, uploadCv, deleteCv, getCvContent };
