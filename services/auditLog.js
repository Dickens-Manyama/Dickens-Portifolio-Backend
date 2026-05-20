const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * Log an admin action to the audit log
 * @param {string} adminEmail - Email of the admin performing the action
 * @param {string} action - Type of action (e.g., "CREATE", "UPDATE", "DELETE", "LOGIN")
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {string} endpoint - API endpoint that was called
 * @param {object} options - Additional options
 * @param {string} options.details - JSON string of additional details about the action
 * @param {number} options.statusCode - HTTP response status code
 * @param {string} options.errorMessage - Error message if the action failed
 * @param {string} options.ipAddress - Client IP address
 * @returns {Promise<void>}
 */
async function logAdminAction(adminEmail, action, method, endpoint, options = {}) {
  try {
    await prisma.auditLog.create({
      data: {
        adminEmail: String(adminEmail).trim().toLowerCase(),
        action,
        method,
        endpoint,
        details: options.details ? JSON.stringify(options.details) : null,
        statusCode: options.statusCode || null,
        errorMessage: options.errorMessage || null,
        ipAddress: options.ipAddress || null,
      },
    });
  } catch (err) {
    // Log to console but don't throw - don't interrupt the admin's operation if audit logging fails
    console.error("Failed to create audit log:", err?.message || err);
  }
}

/**
 * Get audit logs with optional filtering
 * @param {object} options - Filter and pagination options
 * @param {string} options.adminEmail - Filter by admin email
 * @param {string} options.action - Filter by action type
 * @param {Date} options.startDate - Filter logs from this date
 * @param {Date} options.endDate - Filter logs until this date
 * @param {number} options.skip - Pagination skip
 * @param {number} options.take - Pagination take (limit)
 * @returns {Promise<Array>}
 */
async function getAuditLogs(options = {}) {
  try {
    const where = {};

    if (options.adminEmail) {
      where.adminEmail = {
        contains: String(options.adminEmail).trim().toLowerCase(),
        mode: "insensitive",
      };
    }

    if (options.action) {
      where.action = {
        contains: String(options.action),
        mode: "insensitive",
      };
    }

    if (options.startDate || options.endDate) {
      where.timestamp = {};
      if (options.startDate) {
        where.timestamp.gte = new Date(options.startDate);
      }
      if (options.endDate) {
        where.timestamp.lte = new Date(options.endDate);
      }
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: options.skip || 0,
      take: options.take || 100,
    });

    return logs;
  } catch (err) {
    console.error("Failed to fetch audit logs:", err?.message || err);
    throw err;
  }
}

/**
 * Get audit log statistics
 * @param {object} options - Filter options
 * @param {Date} options.startDate - From date
 * @param {Date} options.endDate - To date
 * @returns {Promise<object>}
 */
async function getAuditLogStats(options = {}) {
  try {
    const where = {};

    if (options.startDate || options.endDate) {
      where.timestamp = {};
      if (options.startDate) {
        where.timestamp.gte = new Date(options.startDate);
      }
      if (options.endDate) {
        where.timestamp.lte = new Date(options.endDate);
      }
    }

    const totalLogs = await prisma.auditLog.count({ where });

    const actionStats = await prisma.auditLog.groupBy({
      by: ["action"],
      where,
      _count: true,
    });

    const adminStats = await prisma.auditLog.groupBy({
      by: ["adminEmail"],
      where,
      _count: true,
    });

    return {
      totalLogs,
      actionBreakdown: actionStats.map((stat) => ({
        action: stat.action,
        count: stat._count,
      })),
      adminBreakdown: adminStats.map((stat) => ({
        adminEmail: stat.adminEmail,
        count: stat._count,
      })),
    };
  } catch (err) {
    console.error("Failed to fetch audit log stats:", err?.message || err);
    throw err;
  }
}

/**
 * Get total count of audit logs
 * @param {object} options - Filter options
 * @returns {Promise<number>}
 */
async function getAuditLogCount(options = {}) {
  try {
    const where = {};

    if (options.adminEmail) {
      where.adminEmail = {
        contains: String(options.adminEmail).trim().toLowerCase(),
        mode: "insensitive",
      };
    }

    if (options.action) {
      where.action = {
        contains: String(options.action),
        mode: "insensitive",
      };
    }

    if (options.startDate || options.endDate) {
      where.timestamp = {};
      if (options.startDate) {
        where.timestamp.gte = new Date(options.startDate);
      }
      if (options.endDate) {
        where.timestamp.lte = new Date(options.endDate);
      }
    }

    return await prisma.auditLog.count({ where });
  } catch (err) {
    console.error("Failed to count audit logs:", err?.message || err);
    throw err;
  }
}

module.exports = {
  logAdminAction,
  getAuditLogs,
  getAuditLogStats,
  getAuditLogCount,
};
