function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

function parseUserAgent(userAgent) {
  const agent = String(userAgent || "");

  let deviceType = "Desktop";
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(agent)) {
    deviceType = "Mobile";
  } else if (/ipad|tablet|playbook|silk/i.test(agent)) {
    deviceType = "Tablet";
  }

  let browser = "Unknown";
  if (/edg\//i.test(agent)) browser = "Edge";
  else if (/chrome\//i.test(agent) && !/edg/i.test(agent)) browser = "Chrome";
  else if (/firefox\//i.test(agent)) browser = "Firefox";
  else if (/safari\//i.test(agent) && !/chrome/i.test(agent)) browser = "Safari";
  else if (/opr\//i.test(agent)) browser = "Opera";

  let engine = "Unknown";
  if (/applewebkit/i.test(agent)) engine = "WebKit";
  if (/gecko\//i.test(agent) && !/applewebkit/i.test(agent)) engine = "Gecko";
  if (/chrome\//i.test(agent) || /edg\//i.test(agent)) engine = "Blink";

  return {
    deviceType,
    browser,
    engine,
    userAgent: agent.slice(0, 500),
  };
}

function extractClientInfo(req, bodyClientInfo = {}) {
  const fromBody = bodyClientInfo && typeof bodyClientInfo === "object" ? bodyClientInfo : {};
  const userAgent = fromBody.userAgent || req.headers["user-agent"] || "";
  const parsed = parseUserAgent(userAgent);

  return {
    deviceType: fromBody.deviceType || parsed.deviceType,
    browser: fromBody.browser || parsed.browser,
    engine: fromBody.engine || parsed.engine,
    platform: fromBody.platform || null,
    screenWidth: fromBody.screenWidth || null,
    userAgent: parsed.userAgent,
  };
}

function withClientDetails(details, clientInfo) {
  const base = details && typeof details === "object" ? { ...details } : {};
  base.clientInfo = clientInfo;
  return base;
}

module.exports = {
  getClientIp,
  parseUserAgent,
  extractClientInfo,
  withClientDetails,
};
