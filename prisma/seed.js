require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  // PROFILE (single row)
  const profileData = {
    name: "Dickens Deus Manyama",
    title: "Software Developer | Data Scientist | IT Systems & Networking",
    summary:
      "Hands-on Software Developer and Data Scientist focused on reliable, data-driven systems. Builds production-ready apps, integrates APIs, and turns raw data into useful insights across the stack.",
    email: "dickensmanyama8@gmail.com",
    phone: "0679 165 468 / 0692 501 112",
    github: "https://github.com/Dickens-Manyama",
    linkedin: "https://www.linkedin.com/in/dickens-manyama-560450327",
    careerObjective: "Build dependable, scalable systems that solve real problems.",
    strengths: [
      "Practical problem solving for real-world needs",
      "End-to-end system building (backend, APIs, data pipelines)",
      "Comfortable across software and data science work",
      "Fast learner who adapts to new tools",
      "Clear, clean, and maintainable code",
      "Collaborative communication in teams",
      "Focus on reliability, performance, and scale",
    ],
  };

  const existing = await prisma.profile.findFirst();
  if (!existing) {
    await prisma.profile.create({ data: profileData });
  } else {
    await prisma.profile.update({
      where: { id: existing.id },
      data: profileData,
    });
  }

  // SKILLS (grouped)
  const skills = [
    { category: "Programming", name: "PHP" },
    { category: "Programming", name: "JavaScript" },
    { category: "Programming", name: "Python" },
    { category: "Programming", name: "SQL" },
    { category: "Frameworks", name: "Laravel" },
    { category: "Frameworks", name: "React" },
    { category: "Frameworks", name: "Yii2" },
    { category: "Databases", name: "PostgreSQL" },
    { category: "Databases", name: "MySQL" },
    { category: "Data Science", name: "Machine Learning" },
    { category: "Data Science", name: "Data Analysis" },
    { category: "IT Skills", name: "Networking" },
    { category: "IT Skills", name: "System Support" }
  ];

  for (const s of skills) {
    await prisma.skill.upsert({
      where: { category_name: { category: s.category, name: s.name } },
      update: {},
      create: s,
    });
  }

  // PROJECTS
  const projects = [
    {
      title: "UBX-Eats",
      description:
        "Internal food ordering system with user roles, order management, and reporting.",
      techStack: ["Laravel", "PHP", "MySQL"],
      githubLink: "https://github.com/Dickens-Manyama/ubx-eats",
      liveDemo: null,
    },
    {
      title: "Digital Card Management System",
      description:
        "Secure digital card generation and management system with an admin dashboard.",
      techStack: ["Laravel", "PHP", "Security", "Admin Dashboard"],
      githubLink: "https://github.com/Dickens-Manyama/digital-cards",
      liveDemo: null,
    },
    {
      title: "Bus Ticket Booking System",
      description:
        "Online ticket booking, seat management, and automated confirmations.",
      techStack: ["Yii2", "PHP", "Booking", "Database"],
      githubLink: "https://github.com/Dickens-Manyama/bus-booking",
      liveDemo: null,
    },
    {
      title: "Machine Learning Projects",
      description:
        "Academic and practical data analysis projects and predictive models.",
      techStack: ["Python", "Machine Learning", "Data Analysis", "Visualization"],
      githubLink: "https://github.com/Dickens-Manyama/machine-learning",
      liveDemo: null,
    },
  ];

  // Keep seed idempotent: upsert by title
  for (const p of projects) {
    const existingProject = await prisma.project.findFirst({ where: { title: p.title } });
    if (!existingProject) {
      await prisma.project.create({ data: p });
    } else {
      await prisma.project.update({ where: { id: existingProject.id }, data: p });
    }
  }

  // EDUCATION
  const educationItems = [
    {
      institution: "EASTC",
      program: "Eastern Africa Statistical Training Centre",
      description: "Data science training combined with hands-on software development.",
      statusTag: null,
      sortOrder: 1,
    },
    {
      institution: "Bachelor of Science in Data Science",
      program: "Core data science coursework + practical projects",
      description: "Focus on applied analytics, engineering, and automation.",
      statusTag: null,
      sortOrder: 2,
    },
    {
      institution: "Final Year Status",
      program: "Machine learning + ML-ready engineering mindset",
      description: "In progress / final-year stage",
      statusTag: "In progress / final-year stage",
      sortOrder: 3,
    },
  ];

  for (const item of educationItems) {
    const existingEducation = await prisma.education.findFirst({
      where: { institution: item.institution, program: item.program },
    });
    if (!existingEducation) {
      await prisma.education.create({ data: item });
    } else {
      await prisma.education.update({ where: { id: existingEducation.id }, data: item });
    }
  }

  // Ensure an admins table exists and seed admin credentials (email + hashed password)
  // This uses raw SQL so we don't need to add a Prisma model or run migrations.
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@gmail.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@123";

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  const passwordHash = await bcrypt.hash(String(adminPassword), 10);

  await prisma.$executeRaw`
    INSERT INTO admins (email, password_hash)
    VALUES (${adminEmail}, ${passwordHash})
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
  `;

  console.log(`[seed] admin seeded: ${adminEmail}`);
}

main()
  .then(async () => {
    console.log("[seed] done");
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("[seed] failed", e);
    await prisma.$disconnect();
    process.exit(1);
  });

