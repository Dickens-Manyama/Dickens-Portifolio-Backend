const { PrismaClient } = require("@prisma/client");

// Prevent exhausting DB connections during local reloads.
const globalForPrisma = global;

const prisma = globalForPrisma.__prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.__prisma = prisma;

module.exports = { prisma };

