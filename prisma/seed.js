require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // PROFILE (single row)
  const profileData = {
    name: "Dickens Deus Manyama",
    title: "Software Developer | Data Scientist | IT Systems & Networking",
    summary:
      "Cloud and software developer with experience in Laravel, React, APIs, and data science.",
    email: "dickensmanyama8@gmail.com",
    phone: "0679 165 468 / 0692 501 112",
    github: "https://github.com/Dickens-Manyama",
    linkedin: "https://www.linkedin.com/in/dickens-manyama-560450327",
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

