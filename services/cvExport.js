const HTMLtoDOCX = require("html-to-docx");
const PDFDocument = require("pdfkit");

const FONT_SIZE_MAP = {
  1: "8pt",
  2: "10pt",
  3: "11pt",
  4: "12pt",
  5: "14pt",
  6: "18pt",
  7: "24pt",
};

const DOCX_OPTIONS = {
  orientation: "portrait",
  font: "Calibri",
  fontSize: 22,
  margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
  table: { row: { cantSplit: true } },
  footer: false,
  pageNumber: false,
};

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

function mergeInlineStyle(existing, additions) {
  const map = new Map();
  String(existing || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((rule) => {
      const idx = rule.indexOf(":");
      if (idx > 0) map.set(rule.slice(0, idx).trim().toLowerCase(), rule.slice(idx + 1).trim());
    });
  Object.entries(additions).forEach(([key, value]) => {
    if (value) map.set(key.toLowerCase(), value);
  });
  return [...map.entries()].map(([k, v]) => `${k}:${v}`).join(";");
}

function tagWithStyle(tag, attrs, styleAdditions) {
  const styleMatch = attrs.match(/style\s*=\s*["']([^"']*)["']/i);
  const existing = styleMatch ? styleMatch[1] : "";
  const style = mergeInlineStyle(existing, styleAdditions);
  const cleaned = attrs.replace(/\s*style\s*=\s*["'][^"']*["']/i, "");
  return `<${tag}${cleaned} style="${style}">`;
}

function sanitizeForDocxXml(html) {
  return String(html || "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;");
}

function normalizeEditorHtmlForExport(html) {
  let body = sanitizeForDocxXml(String(html || "").trim());
  if (!body) body = "<p></p>";

  body = body.replace(/<font\b([^>]*)>([\s\S]*?)<\/font>/gi, (_, attrs, inner) => {
    const additions = {};
    const color = attrs.match(/color\s*=\s*["']?([^"'\s;>]+)/i);
    const face = attrs.match(/face\s*=\s*["']([^"']+)["']/i);
    const size = attrs.match(/size\s*=\s*["']?(\d)/i);
    if (face) additions["font-family"] = face[1];
    if (color) additions.color = color[1];
    if (size) additions["font-size"] = FONT_SIZE_MAP[size[1]] || "11pt";
    const style = mergeInlineStyle("", additions);
    return `<span style="${style}">${inner}</span>`;
  });

  body = body.replace(/<b\b/gi, "<strong").replace(/<\/b>/gi, "</strong>");
  body = body.replace(/<i\b/gi, "<em").replace(/<\/i>/gi, "</em>");

  body = body.replace(/<hr\b([^>]*)\/?>/gi, (_, attrs) => {
    const styleMatch = attrs.match(/style\s*=\s*["']([^"']*)["']/i);
    let borderColor = "#2e5c8a";
    if (styleMatch) {
      const block = styleMatch[1];
      const colorRule =
        block.match(/border-top-color\s*:\s*([^;]+)/i) ||
        block.match(/border-top\s*:\s*[^;]*\s+(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)/i) ||
        block.match(/background-color\s*:\s*([^;]+)/i);
      if (colorRule) borderColor = colorRule[1].trim();
    }
    return `<hr style="border:none;border-top:2pt solid ${borderColor};margin:12pt 0;" />`;
  });

  body = body.replace(/<ul\b([^>]*)>/gi, (_, attrs) =>
    tagWithStyle("ul", attrs, {
      "list-style-type": "disc",
      margin: "0 0 8pt 24pt",
      "padding-left": "24pt",
    })
  );
  body = body.replace(/<ol\b([^>]*)>/gi, (_, attrs) =>
    tagWithStyle("ol", attrs, {
      "list-style-type": "decimal",
      margin: "0 0 8pt 24pt",
      "padding-left": "24pt",
    })
  );
  body = body.replace(/<li\b([^>]*)>/gi, (_, attrs) =>
    tagWithStyle("li", attrs, { margin: "2pt 0", display: "list-item" })
  );
  body = body.replace(/<h1\b([^>]*)>/gi, (_, attrs) =>
    tagWithStyle("h1", attrs, {
      "font-size": "22pt",
      "font-weight": "bold",
      margin: "12pt 0 6pt",
      "font-family": "Calibri, Arial, sans-serif",
    })
  );
  body = body.replace(/<h2\b([^>]*)>/gi, (_, attrs) =>
    tagWithStyle("h2", attrs, {
      "font-size": "16pt",
      "font-weight": "bold",
      margin: "10pt 0 6pt",
      "font-family": "Calibri, Arial, sans-serif",
    })
  );
  body = body.replace(/<h3\b([^>]*)>/gi, (_, attrs) =>
    tagWithStyle("h3", attrs, {
      "font-size": "13pt",
      "font-weight": "bold",
      margin: "8pt 0 4pt",
      "font-family": "Calibri, Arial, sans-serif",
    })
  );
  body = body.replace(/<p\b(?![^>]*style=)([^>]*)>/gi, (_, attrs) =>
    tagWithStyle("p", attrs, {
      margin: "0 0 8pt",
      "font-size": "11pt",
      "font-family": "Calibri, Arial, sans-serif",
      color: "#1a1a1a",
    })
  );
  body = body.replace(/<blockquote\b([^>]*)>/gi, (_, attrs) =>
    tagWithStyle("blockquote", attrs, {
      "border-left": "4pt solid #cbd5e1",
      "padding-left": "12pt",
      "font-style": "italic",
      margin: "8pt 0",
    })
  );

  return `<div>${body}</div>`;
}

function toBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  return Buffer.from(value);
}

function assertValidDocx(buffer) {
  const buf = toBuffer(buffer);
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error("Generated DOCX file is invalid.");
  }
  return buf;
}

function buildWordHtmlDocument(html) {
  const body = normalizeEditorHtmlForExport(html);
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.35; color: #1a1a1a; }
  p { margin: 0 0 8pt; }
  h1 { font-size: 22pt; font-weight: bold; margin: 12pt 0 6pt; }
  h2 { font-size: 16pt; font-weight: bold; margin: 10pt 0 6pt; }
  h3 { font-size: 13pt; font-weight: bold; margin: 8pt 0 4pt; }
  ul { list-style-type: disc; margin: 0 0 8pt 24pt; }
  ol { list-style-type: decimal; margin: 0 0 8pt 24pt; }
  li { margin: 2pt 0; }
  strong { font-weight: bold; }
  em { font-style: italic; }
  u { text-decoration: underline; }
  hr { border: none; margin: 12pt 0; }
</style>
</head>
<body>${body}</body>
</html>`;
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
  const documentHtml = normalizeEditorHtmlForExport(html);

  try {
    const result = await HTMLtoDOCX(documentHtml, null, DOCX_OPTIONS);
    return assertValidDocx(result);
  } catch (primaryErr) {
    const plain = stripHtml(html);
    const fallbackHtml = `<div><p>${plain.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br />")}</p></div>`;
    const result = await HTMLtoDOCX(fallbackHtml, null, DOCX_OPTIONS);
    const buf = assertValidDocx(result);
    if (!plain.trim()) throw primaryErr;
    return buf;
  }
}

async function exportCvBuffer(html, format) {
  const normalized = wrapPlainTextAsHtml(html);

  switch (format) {
    case "pdf":
      return buildPdfBuffer(normalized);
    case "docx":
      return buildDocxBuffer(normalized);
    case "doc":
      return buildDocxBuffer(normalized);
    case "txt":
      return Buffer.from(stripHtml(normalized), "utf8");
    case "html":
      return Buffer.from(buildWordHtmlDocument(normalized), "utf8");
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

module.exports = {
  stripHtml,
  wrapPlainTextAsHtml,
  normalizeEditorHtmlForExport,
  mimeForFormat,
  extensionForFormat,
  buildFilename,
  exportCvBuffer,
};
