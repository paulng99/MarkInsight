/**
 * Idempotent seed for the first real ADMIN (and optional TEACHER) account.
 *
 * Required env:
 *   DATABASE_URL
 *   MARKINSIGHT_SEED_ADMIN_EMAIL
 *   MARKINSIGHT_SEED_ADMIN_PASSWORD  (min 12 chars)
 *
 * Optional:
 *   MARKINSIGHT_SEED_ADMIN_NAME
 *   MARKINSIGHT_SEED_TEACHER_EMAIL
 *   MARKINSIGHT_SEED_TEACHER_PASSWORD  (min 12 chars; requires school id)
 *   MARKINSIGHT_SEED_TEACHER_NAME
 *   MARKINSIGHT_SEED_SCHOOL_ID  (default: demo_school — create school row if missing)
 *
 * Never logs passwords. Safe to re-run (updates hash / role / name).
 *
 * Usage:
 *   node scripts/seed-admin.cjs
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const MIN_LEN = 12;

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    console.error(`[seed-admin] Missing required env: ${name}`);
    process.exit(1);
  }
  return String(v).trim();
}

function optionalEnv(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

async function main() {
  const email = requireEnv("MARKINSIGHT_SEED_ADMIN_EMAIL").toLowerCase();
  const password = requireEnv("MARKINSIGHT_SEED_ADMIN_PASSWORD");
  if (password.length < MIN_LEN) {
    console.error(
      `[seed-admin] MARKINSIGHT_SEED_ADMIN_PASSWORD must be at least ${MIN_LEN} characters.`,
    );
    process.exit(1);
  }
  const name = optionalEnv("MARKINSIGHT_SEED_ADMIN_NAME") || "Admin";

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name,
        role: "ADMIN",
        schoolId: null,
        passwordHash,
      },
      update: {
        name,
        role: "ADMIN",
        schoolId: null,
        passwordHash,
      },
      select: { id: true, email: true, role: true },
    });
    console.log(`[seed-admin] ADMIN upserted: ${admin.email} (${admin.id})`);

    const teacherEmail = optionalEnv("MARKINSIGHT_SEED_TEACHER_EMAIL");
    if (teacherEmail) {
      const teacherPassword = requireEnv("MARKINSIGHT_SEED_TEACHER_PASSWORD");
      if (teacherPassword.length < MIN_LEN) {
        console.error(
          `[seed-admin] MARKINSIGHT_SEED_TEACHER_PASSWORD must be at least ${MIN_LEN} characters.`,
        );
        process.exit(1);
      }
      const schoolId = optionalEnv("MARKINSIGHT_SEED_SCHOOL_ID") || "demo_school";
      const teacherName = optionalEnv("MARKINSIGHT_SEED_TEACHER_NAME") || "Teacher";

      // Only the reserved demo_school id uses the "Demo School" label.
      const schoolName =
        schoolId === "demo_school"
          ? "Demo School"
          : optionalEnv("MARKINSIGHT_SEED_SCHOOL_NAME") || "School";
      await prisma.school.upsert({
        where: { id: schoolId },
        create: { id: schoolId, name: schoolName },
        update: {},
      });

      const teacherHash = await bcrypt.hash(teacherPassword, 10);
      const teacher = await prisma.user.upsert({
        where: { email: teacherEmail.toLowerCase() },
        create: {
          email: teacherEmail.toLowerCase(),
          name: teacherName,
          role: "TEACHER",
          schoolId,
          passwordHash: teacherHash,
        },
        update: {
          name: teacherName,
          role: "TEACHER",
          schoolId,
          passwordHash: teacherHash,
        },
        select: { id: true, email: true, role: true },
      });
      console.log(
        `[seed-admin] TEACHER upserted: ${teacher.email} (${teacher.id}) school=${schoolId}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[seed-admin] Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
