import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const org = await prisma.organization.findUnique({
  where: { publicToken: "74965e12e3bc" },
});
const vs = await prisma.vehicle.findMany({
  where: { organizationId: org.id },
  select: { plateNumber: true, make: true, model: true, photos: true },
});
const cs = await prisma.vehicleCategory.findMany({
  where: { organizationId: org.id },
  select: { name: true, imageUrl: true },
});
const need = ["panda", "aygo", "ignis", "500", "audi", "up", "q2"];
for (const v of vs) {
  const u = (v.photos || [])[0] || "";
  const label = `${v.make} ${v.model}`.toLowerCase();
  if (need.some((k) => u.toLowerCase().includes(k) || label.includes(k))) {
    console.log("V", v.plateNumber, v.make, v.model, u);
  }
}
for (const c of cs) {
  const u = c.imageUrl || "";
  if (need.some((k) => u.toLowerCase().includes(k) || c.name.toLowerCase().includes(k))) {
    console.log("C", c.name, u);
  }
}
await prisma.$disconnect();
