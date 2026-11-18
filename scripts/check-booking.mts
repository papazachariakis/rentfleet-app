import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const id = process.argv[2] || "cmwmlys4v000fl5086hukvb1k";
const b = await p.booking.findUnique({
  where: { id },
  include: { organization: true, customer: true, vehicle: true },
});
console.log(
  JSON.stringify(
    {
      code: b?.code,
      pickupAt: b?.pickupAt,
      returnAt: b?.returnAt,
      days: b?.days,
      publicToken: b?.organization.publicToken,
      org: b?.organization.name,
      afm: b?.organization.afm,
      plate: b?.vehicle?.plateNumber,
    },
    null,
    2
  )
);
await p.$disconnect();
