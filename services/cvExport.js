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

/** Avoid custom margins — html-to-docx margins break MS Word on real CV HTML. */
const DOCX_OPTIONS = {
  font: "Calibri",
  fontSize: 22,
  footer: false,
  pageNumber: false,
};

const FONT_SIZE_KEYWORDS = {
  "xx-small": "8pt",
  "x-small": "9pt",
  small: "10pt",
  medium: "11pt",
  large: "13pt",
  "x-large": "16pt",
  "xx-large": "22pt",
};

const UNSUPPORTED_STYLE_PROPS = new Set([
  "display",
  "unicode-bidi",
  "direction",
  "webkit-text-stroke",
  "webkit-text-fill-color",
]);

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

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function rgbToHex(color) {
  const match = String(color).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!match) return color;
  const hex = [match[1], match[2], match[3]]
    .map((n) => Number(n).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

function normalizeStyleAttribute(styleStr) {
  const decoded = decodeHtmlEntities(styleStr);
  const rules = decoded
    .split(";")
    .map((r) => r.trim())
    .filter(Boolean);
  const kept = [];

  for (const rule of rules) {
    const idx = rule.indexOf(":");
    if (idx <= 0) continue;
    const prop = rule.slice(0, idx).trim().toLowerCase();
    let value = rule.slice(idx + 1).trim();
    if (UNSUPPORTED_STYLE_PROPS.has(prop) || prop.startsWith("-webkit")) continue;

    if (prop === "font-size") {
      value = FONT_SIZE_KEYWORDS[value.toLowerCase()] || value;
      if (/^\d+px$/i.test(value)) {
        const px = parseInt(value, 10);
        value = `${Math.max(8, Math.round(px * 0.75))}pt`;
      }
    }
    if (prop === "color" || prop === "background-color") {
      value = rgbToHex(value);
    }
    if (prop === "font-family") {
      value = value.replace(/^["']|["']$/g, "").split(",")[0].trim();
    }
    kept.push(`${prop}:${value}`);
  }

  return kept.join(";");
}

function normalizeInlineStyleAttributes(html) {
  return String(html || "").replace(/style\s*=\s*["']([^"']*)["']/gi, (full, style) => {
    const normalized = normalizeStyleAttribute(style);
    return normalized ? `style="${normalized}"` : "";
  });
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

function extractHrBorderColor(attrs) {
  const styleMatch = String(attrs || "").match(/style\s*=\s*["']([^"']*)["']/i);
  if (!styleMatch) return "#2e5c8a";
  const block = decodeHtmlEntities(styleMatch[1]);
  const colorRule =
    block.match(/border-top-color\s*:\s*([^;]+)/i) ||
    block.match(/border-top\s*:\s*[^;]*?(#[0-9a-fA-F]{3,8}|rgb\([^)]+\))/i) ||
    block.match(/background-color\s*:\s*([^;]+)/i);
  if (colorRule) return rgbToHex(colorRule[1].trim());
  return "#2e5c8a";
}

/** html-to-docx drops <hr>; use a bordered paragraph Word renders as a line. */
function hrToWordLine(attrs) {
  const color = extractHrBorderColor(attrs);
  return `<p style="margin:10pt 0;padding:0;border:none;border-top:3pt solid ${color};font-size:2pt;line-height:2pt;">&nbsp;</p>`;
}

function cleanContentEditableHtml(html) {
  let body = sanitizeForDocxXml(String(html || "").trim());
  if (!body) return "<p></p>";

  body = body
    .replace(/\scontenteditable\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\sclass\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\sid\s*=\s*["']null["']/gi, "")
    .replace(/\sdata-[\w-]+\s*=\s*["'][^"']*["']/gi, "");

  body = normalizeInlineStyleAttributes(body);

  body = body.replace(/<span\b([^>]*)>\s*<\/span>/gi, "");
  body = body.replace(/<p\b[^>]*>\s*<\/p>/gi, "<p></p>");

  return body;
}

function normalizeEditorHtmlForExport(html) {
  let body = cleanContentEditableHtml(html);
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

  body = body.replace(/<hr\b([^>]*)\/?>/gi, (_, attrs) => hrToWordLine(attrs));

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
    const result = await HTMLtoDOCX(documentHtml, null, {
      ...DOCX_OPTIONS,
      decodeUnicode: true,
    });
    return assertValidDocx(result);
  } catch (primaryErr) {
    const plain = stripHtml(html);
    const fallbackHtml = `<div><p>${plain
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br />")}</p></div>`;
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
