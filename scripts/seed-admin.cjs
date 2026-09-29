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
 * Passwords are hashed without trimming so the stored hash matches the env value.
 *
 * Usage:
 *   node scripts/seed-admin.cjs
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const {
  isForbiddenSeedIdentity,
  SEED_ADMIN_DEMO_IDENTITY_ERROR,
  validateSeedPassword,
  validateSeedTeacherPassword,
  seedPasswordForHash,
} = require("./seed-admin-guard.cjs");

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

function refuseDemoIdentity(label, value) {
  if (!isForbiddenSeedIdentity(value)) return;
  console.error(`[seed-admin] ${label}: ${SEED_ADMIN_DEMO_IDENTITY_ERROR}`);
  process.exit(1);
}

async function main() {
  const email = requireEnv("MARKINSIGHT_SEED_ADMIN_EMAIL").toLowerCase();
  // Read passwords raw (including empty) — never trim before hashing.
  const adminPasswordRaw = process.env.MARKINSIGHT_SEED_ADMIN_PASSWORD;
  const adminPasswordError = validateSeedPassword(
    "MARKINSIGHT_SEED_ADMIN_PASSWORD",
    adminPasswordRaw,
  );
  if (adminPasswordError) {
    console.error(`[seed-admin] ${adminPasswordError}`);
    process.exit(1);
  }
  const password = seedPasswordForHash(/** @type {string} */ (adminPasswordRaw));

  const name = optionalEnv("MARKINSIGHT_SEED_ADMIN_NAME") || "Admin";
  const teacherEmailRaw = optionalEnv("MARKINSIGHT_SEED_TEACHER_EMAIL");
  const teacherEmail = teacherEmailRaw ? teacherEmailRaw.toLowerCase() : null;
  const teacherPasswordRaw = process.env.MARKINSIGHT_SEED_TEACHER_PASSWORD;

  // Refuse demo identities and validate optional teacher password before DB.
  refuseDemoIdentity("MARKINSIGHT_SEED_ADMIN_EMAIL", email);
  if (teacherEmail) {
    refuseDemoIdentity("MARKINSIGHT_SEED_TEACHER_EMAIL", teacherEmail);
  }
  const teacherPasswordError = validateSeedTeacherPassword(
    teacherEmail,
    teacherPasswordRaw,
  );
  if (teacherPasswordError) {
    console.error(`[seed-admin] ${teacherPasswordError}`);
    process.exit(1);
  }

  const teacherPassword = teacherEmail
    ? seedPasswordForHash(/** @type {string} */ (teacherPasswordRaw))
    : null;

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

    if (teacherEmail && teacherPassword) {
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
        where: { email: teacherEmail },
        create: {
          email: teacherEmail,
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
