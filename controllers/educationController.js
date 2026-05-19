const { prisma } = require("../lib/prisma");
const { ok, fail } = require("../services/responses");

function mapEducation(row) {
  return {
    id: row.id,
    institution: row.institution,
    program: row.program,
    description: row.description,
    statusTag: row.statusTag,
    sortOrder: row.sortOrder,
  };
}

async function getEducation(req, res) {
  try {
    const rows = await prisma.education.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return ok(res, rows.map(mapEducation));
  } catch (err) {
    return fail(res, 500, "Failed to load education.", err?.message);
  }
}

module.exports = { getEducation };
