/**
 * Διασφαλίζει ότι το papazachariakis@gmail.com είναι PLATFORM_ADMIN.
 * Αν δεν υπάρχει χρήστης, δημιουργεί λογαριασμό με προσωρινό κωδικό.
 *
 * Usage: npx tsx scripts/ensure-platform-admin.ts
 * Optional: PLATFORM_ADMIN_PASSWORD=... 
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const EMAIL = (
  process.env.PLATFORM_ADMIN_EMAIL || "papazachariakis@gmail.com"
).toLowerCase();

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: "PLATFORM_ADMIN" },
    });
    console.log(`OK: ${EMAIL} → PLATFORM_ADMIN (υπήρχε ήδη)`);
    return;
  }

  const password =
    process.env.PLATFORM_ADMIN_PASSWORD ||
    `RF-${Math.random().toString(36).slice(2, 10)}!`;
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      email: EMAIL,
      name: "Platform Admin",
      passwordHash,
      role: "PLATFORM_ADMIN",
    },
  });

  console.log(`CREATED: ${EMAIL} → PLATFORM_ADMIN`);
  console.log(`Password: ${password}`);
  console.log("Άλλαξέ τον κωδικό μετά το πρώτο login.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
