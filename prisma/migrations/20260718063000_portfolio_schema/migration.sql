CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "profiles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "github" TEXT NOT NULL,
    "linkedin" TEXT NOT NULL,
    "profileImageUrl" TEXT,
    "careerObjective" TEXT,
    "strengths" TEXT[],
    "cv_original_name" TEXT,
    "cv_filename" TEXT,
    "cv_mime" TEXT,
    "cv_data" TEXT,
    "cv_source_html" TEXT,
    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "skills" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projects" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "techStack" TEXT[],
    "githubLink" TEXT,
    "liveDemo" TEXT,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contact_messages" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "education" (
    "id" SERIAL NOT NULL,
    "institution" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "statusTag" TEXT,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "education_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "details" TEXT,
    "statusCode" INTEGER,
    "errorMessage" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "skills_category_name_key" ON "skills"("category", "name");
CREATE INDEX "audit_logs_adminEmail_idx" ON "audit_logs"("adminEmail");
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");
