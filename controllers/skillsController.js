const { prisma } = require("../lib/prisma");
const { ok, fail } = require("../services/responses");

function getSkillIconKey(category, name) {
  const normalizedCategory = String(category || "").toLowerCase();
  const normalizedName = String(name || "").toLowerCase();

  if (normalizedName === "php") return "php";
  if (normalizedName === "javascript") return "javascript";
  if (normalizedName === "python") return "python";
  if (normalizedName === "sql") return "sql";
  if (normalizedName === "laravel") return "laravel";
  if (normalizedName === "yii2") return "yii2";
  if (normalizedName === "react") return "react";
  if (normalizedName === "mysql") return "mysql";
  if (normalizedName === "postgresql") return "postgresql";
  if (normalizedName === "machine learning") return "machineLearning";
  if (normalizedName === "data analysis") return "dataAnalysis";
  if (normalizedName === "data visualization") return "dataVisualization";
  if (normalizedName === "networking") return "networking";
  if (normalizedName === "system maintenance") return "systemSupport";
  if (normalizedName === "system support") return "systemSupport";
  if (normalizedName === "technical support") return "technicalSupport";
  if (normalizedName === "rest APIs".toLowerCase()) return "restApi";
  if (normalizedName === "webhooks") return "webhook";
  if (normalizedName === "google apps script") return "googleAppsScript";

  if (normalizedCategory.includes("data science")) return "machineLearning";
  if (normalizedCategory.includes("framework")) return "code";
  if (normalizedCategory.includes("database")) return "database";
  if (normalizedCategory.includes("automation")) return "restApi";
  if (normalizedCategory.includes("network")) return "networking";

  return "code";
}

function groupSkills(rows) {
  const map = new Map();
  for (const s of rows) {
    if (!map.has(s.category)) map.set(s.category, []);
    map.get(s.category).push({
      name: s.name,
      level: 80,
      iconKey: getSkillIconKey(s.category, s.name),
    });
  }
  return [...map.entries()].map(([category, skills]) => ({
    category,
    skills,
  }));
}

async function getSkills(req, res) {
  try {
    const rows = await prisma.skill.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return ok(res, groupSkills(rows));
  } catch (err) {
    return fail(res, 500, "Failed to load skills.", err?.message);
  }
}

module.exports = { getSkills };

