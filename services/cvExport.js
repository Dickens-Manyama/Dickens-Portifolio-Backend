const HTMLtoDOCX = require("html-to-docx");
const PDFDocument = require("pdfkit");

function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapPlainTextAsHtml(text) {
  const safe = String(text || "").trim();
  if (!safe) return "<p></p>";
  if (/<[a-z][\s\S]*>/i.test(safe)) return safe;
  return safe
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function mimeForFormat(format) {
  const map = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    txt: "text/plain",
    html: "text/html",
  };
  return map[format] || "application/octet-stream";
}

function extensionForFormat(format) {
  const map = { pdf: "pdf", docx: "docx", doc: "doc", txt: "txt", html: "html" };
  return map[format] || "bin";
}

function buildFilename(baseName, format) {
  const clean = String(baseName || "cv").replace(/\.[^.]+$/, "");
  return `${clean}.${extensionForFormat(format)}`;
}

async function buildPdfBuffer(html) {
  const text = stripHtml(html);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(12);
    const lines = text.split(/\r?\n/);
    lines.forEach((line) => {
      doc.text(line || " ", { width: 500, lineGap: 4 });
    });
    doc.end();
  });
}

async function buildDocxBuffer(html) {
  const documentHtml = wrapPlainTextAsHtml(html);
  const buffer = await HTMLtoDOCX(documentHtml, null, {
    table: { row: { cantSplit: true } },
    footer: false,
    pageNumber: false,
  });
  return Buffer.from(buffer);
}

async function exportCvBuffer(html, format) {
  const normalized = wrapPlainTextAsHtml(html);

  switch (format) {
    case "pdf":
      return buildPdfBuffer(normalized);
    case "docx":
    case "doc":
      return buildDocxBuffer(normalized);
    case "txt":
      return Buffer.from(stripHtml(normalized), "utf8");
    case "html":
      return Buffer.from(
        `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${normalized}</body></html>`,
        "utf8"
      );
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

module.exports = {
  stripHtml,
  wrapPlainTextAsHtml,
  mimeForFormat,
  extensionForFormat,
  buildFilename,
  exportCvBuffer,
};
