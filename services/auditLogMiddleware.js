const { logAdminAction } = require("./auditLog");
const { extractClientInfo, getClientIp, withClientDetails } = require("./clientInfo");

/**
 * Middleware to automatically log all admin API requests
 * Should be added after the requireAdminAuth middleware so req.admin is available
 */
function auditLogMiddleware(req, res, next) {
  // Store original response methods
  const originalSend = res.send;
  const originalJson = res.json;

  // Track response status and data
  let responseStatusCode = 200;
  let responseData = null;
  let hasError = false;

  // Override res.send
  res.send = function (data) {
    responseStatusCode = res.statusCode;
    if (data && typeof data === "string") {
      try {
        responseData = JSON.parse(data);
      } catch {
        responseData = { raw: data };
      }
    } else {
      responseData = data;
    }
    return originalSend.call(this, data);
  };

  // Override res.json
  res.json = function (data) {
    responseStatusCode = res.statusCode;
    responseData = data;
    return originalJson.call(this, data);
  };

  // Intercept errors via response finishing
  res.on("finish", async () => {
    try {
      if (!req.admin || !req.admin.email) {
        return; // Not an authenticated admin request
      }

      const method = req.method;
      const endpoint = req.path;

      if (endpoint.includes("/auth/logout")) {
        return;
      }

      if (method === "GET" && (endpoint.includes("/logs") || endpoint === "/session")) {
        return;
      }

      // Determine action based on HTTP method and endpoint
      let action = "UNKNOWN";

      if (method === "POST") {
        if (endpoint.includes("/projects")) action = "CREATE_PROJECT";
        else if (endpoint.includes("/skills")) action = "CREATE_SKILL";
        else if (endpoint.includes("/education")) action = "CREATE_EDUCATION";
        else if (endpoint.includes("/profile")) action = "UPDATE_PROFILE";
        else if (endpoint.includes("/cv")) action = "UPLOAD_CV";
        else action = "CREATE";
      } else if (method === "PUT") {
        if (endpoint.includes("/projects")) action = "UPDATE_PROJECT";
        else if (endpoint.includes("/skills")) action = "UPDATE_SKILL";
        else if (endpoint.includes("/education")) action = "UPDATE_EDUCATION";
        else if (endpoint.includes("/profile")) action = "UPDATE_PROFILE";
        else action = "UPDATE";
      } else if (method === "DELETE") {
        if (endpoint.includes("/projects")) action = "DELETE_PROJECT";
        else if (endpoint.includes("/skills")) action = "DELETE_SKILL";
        else if (endpoint.includes("/education")) action = "DELETE_EDUCATION";
        else if (endpoint.includes("/contacts")) action = "DELETE_CONTACT";
        else if (endpoint.includes("/cv")) action = "DELETE_CV";
        else action = "DELETE";
      } else if (method === "GET") {
        if (endpoint.includes("/logs")) action = "VIEW_LOGS";
        else action = "VIEW";
      }

      // Extract request body for details (exclude sensitive data)
      let details = null;
      if (req.body) {
        const bodyKeys = Object.keys(req.body);
        const sanitizedBody = {};
        for (const key of bodyKeys) {
          if (!["password", "token", "secret"].includes(key.toLowerCase())) {
            sanitizedBody[key] = req.body[key];
          }
        }
        details = sanitizedBody;
      }

      // Add URL params to details
      if (Object.keys(req.params).length > 0) {
        if (!details) details = {};
        details.params = req.params;
      }

      const clientInfo = extractClientInfo(req, req.body?.clientInfo);
      details = withClientDetails(details, clientInfo);

      // Determine if there's an error
      const errorMessage =
        responseStatusCode >= 400
          ? responseData?.message || responseData?.error || `HTTP ${responseStatusCode}`
          : null;

      // Log the action
      await logAdminAction(req.admin.email, action, method, endpoint, {
        details,
        statusCode: responseStatusCode,
        errorMessage,
        ipAddress: getClientIp(req),
      });
    } catch (err) {
      // Silently fail - don't disrupt the response
      console.error("Audit log middleware error:", err?.message || err);
    }
  });

  next();
}

module.exports = {
  auditLogMiddleware,
};
