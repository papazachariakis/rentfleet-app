import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findUnique({
    where: { publicToken: "74965e12e3bc" },
  });
  if (!org) throw new Error("org missing");
  const missing = await prisma.vehicle.findMany({
    where: { organizationId: org.id, active: true, photos: { isEmpty: true } },
    select: { make: true, model: true, year: true, plateNumber: true },
    orderBy: [{ make: "asc" }, { model: "asc" }],
  });
  console.log(JSON.stringify(missing, null, 2));
  console.log("count", missing.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
