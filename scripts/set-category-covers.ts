import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const R2 = "https://pub-a1e4897bb4484652a75702564867931e.r2.dev/reliable/fleet";

const map: Record<string, string> = {
  "CAT. A": `${R2}/hyundai-i10.jpg`,
  "CAT. B": `${R2}/citroen-c3.jpg`,
  "CAT. C": `${R2}/opel-corsa.jpg`,
  "CAT. D": `${R2}/toyota-corolla.png`,
  "CAT. D Economy": `${R2}/toyota-corolla.png`,
  "CAT. D+": `${R2}/toyota-corolla.png`,
  "CAT. D1 AUTOMATIC": `${R2}/toyota-aygo.jpg`,
  "CAT. D2": `${R2}/opel-corsa.jpg`,
  "CAT. D2 AUTOMATIC": `${R2}/toyota-corolla.png`,
  "CAT. E": `${R2}/dacia-stepway-7seats.png`,
  "CAT. F/ M.BUSS": `${R2}/peugeot-traveller.jpg`,
};

async function main() {
  const org = await prisma.organization.findUnique({
    where: { publicToken: "74965e12e3bc" },
  });
  if (!org) throw new Error("org missing");
  for (const [name, imageUrl] of Object.entries(map)) {
    const r = await prisma.vehicleCategory.updateMany({
      where: { organizationId: org.id, name },
      data: { imageUrl },
    });
    console.log(name, r.count, imageUrl.split("/").pop());
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
