import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findUnique({
    where: { publicToken: "74965e12e3bc" },
    select: { id: true, name: true },
  });
  if (!org) {
    console.log("ORG_NOT_FOUND");
    return;
  }
  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId: org.id, active: true },
    select: {
      id: true,
      plateNumber: true,
      make: true,
      model: true,
      photos: true,
      category: { select: { id: true, name: true } },
    },
    orderBy: [{ make: "asc" }, { model: "asc" }],
  });
  console.log(JSON.stringify({ org, count: vehicles.length, vehicles }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
