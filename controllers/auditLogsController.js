const { getAuditLogs, getAuditLogCount, getAuditLogStats } = require("../services/auditLog");
const { ok, fail } = require("../services/responses");

/**
 * Get all audit logs with optional filtering and pagination
 */
async function getAuditLogsController(req, res) {
  try {
    const { adminEmail, action, startDate, endDate, skip = 0, take = 100 } = req.query;

    // Validate pagination parameters
    const skipNum = Math.max(0, parseInt(skip, 10) || 0);
    const takeNum = Math.min(500, Math.max(1, parseInt(take, 10) || 100)); // Max 500 per request

    // Build filter options
    const options = {
      skip: skipNum,
      take: takeNum,
    };

    if (adminEmail) options.adminEmail = adminEmail;
    if (action) options.action = action;
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    // Get total count for pagination
    const countOptions = {};
    if (adminEmail) countOptions.adminEmail = adminEmail;
    if (action) countOptions.action = action;
    if (startDate) countOptions.startDate = startDate;
    if (endDate) countOptions.endDate = endDate;

    const [logs, total] = await Promise.all([getAuditLogs(options), getAuditLogCount(countOptions)]);

    return ok(res, {
      logs,
      pagination: {
        skip: skipNum,
        take: takeNum,
        total,
        hasMore: skipNum + takeNum < total,
      },
    });
  } catch (err) {
    return fail(res, 500, "Failed to fetch audit logs.", err?.message);
  }
}

/**
 * Get audit log statistics
 */
async function getAuditLogStatsController(req, res) {
  try {
    const { startDate, endDate } = req.query;

    const options = {};
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    const stats = await getAuditLogStats(options);

    return ok(res, stats);
  } catch (err) {
    return fail(res, 500, "Failed to fetch audit log statistics.", err?.message);
  }
}

/**
 * Get a single audit log entry by ID
 */
async function getAuditLogDetailController(req, res) {
  try {
    const { id } = req.params;
    const logId = parseInt(id, 10);

    if (isNaN(logId)) {
      return fail(res, 400, "Invalid log ID.");
    }

    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();

    const log = await prisma.auditLog.findUnique({
      where: { id: logId },
    });

    if (!log) {
      return fail(res, 404, "Audit log not found.");
    }

    // Parse details if it's a JSON string
    if (log.details) {
      try {
        log.details = JSON.parse(log.details);
      } catch {
        // Keep as string if not valid JSON
      }
    }

    return ok(res, log);
  } catch (err) {
    return fail(res, 500, "Failed to fetch audit log detail.", err?.message);
  }
}

/**
 * Export audit logs as CSV
 */
async function exportAuditLogsController(req, res) {
  try {
    const { adminEmail, action, startDate, endDate } = req.query;

    const options = {};
    if (adminEmail) options.adminEmail = adminEmail;
    if (action) options.action = action;
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    options.skip = 0;
    options.take = 10000; // Max 10k logs for export

    const logs = await getAuditLogs(options);

    if (logs.length === 0) {
      return fail(res, 400, "No logs to export.");
    }

    // Convert to CSV
    const csvHeaders = [
      "ID",
      "Admin Email",
      "Action",
      "Method",
      "Endpoint",
      "Device",
      "Browser",
      "Engine",
      "Status Code",
      "Timestamp",
      "IP Address",
      "Details",
      "Error Message",
    ];

    const csvRows = logs.map((log) => {
      let clientInfo = {};
      try {
        const parsed = log.details ? JSON.parse(log.details) : null;
        clientInfo = parsed?.clientInfo || {};
      } catch {
        clientInfo = {};
      }

      return [
        log.id,
        log.adminEmail,
        log.action,
        log.method,
        log.endpoint,
        clientInfo.deviceType || "",
        clientInfo.browser || "",
        clientInfo.engine || "",
        log.statusCode || "",
        log.timestamp ? new Date(log.timestamp).toISOString() : "",
        log.ipAddress || "",
        log.details ? log.details.replace(/"/g, '""') : "",
        log.errorMessage ? log.errorMessage.replace(/"/g, '""') : "",
      ];
    });

    const csvContent = [
      csvHeaders.map((h) => `"${h}"`).join(","),
      ...csvRows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=audit-logs.csv");
    return res.send(csvContent);
  } catch (err) {
    return fail(res, 500, "Failed to export audit logs.", err?.message);
  }
}

module.exports = {
  getAuditLogsController,
  getAuditLogStatsController,
  getAuditLogDetailController,
  exportAuditLogsController,
};
