/**
 * Συγχωνεύει διπλότυπες κατηγορίες (ίδιο όνομα ανά org).
 * Κρατάει αυτή με περισσότερα οχήματα (αλλιώς την νεότερη).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function norm(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

async function main() {
  const all = await prisma.vehicleCategory.findMany({
    include: { _count: { select: { vehicles: true, priceRules: true } } },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map<string, typeof all>();
  for (const c of all) {
    const key = `${c.organizationId}::${norm(c.name)}`;
    const list = groups.get(key) || [];
    list.push(c);
    groups.set(key, list);
  }

  let removed = 0;
  for (const [, list] of groups) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => {
      const va = a._count.vehicles - b._count.vehicles;
      if (va !== 0) return va;
      const pa = a._count.priceRules - b._count.priceRules;
      if (pa !== 0) return pa;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    const keep = sorted[sorted.length - 1];
    const drop = sorted.slice(0, -1);
    console.log(
      `Keep «${keep.name}» (${keep.id}) · drop ${drop.length} duplicates`
    );
    for (const d of drop) {
      await prisma.vehicle.updateMany({
        where: { categoryId: d.id },
        data: { categoryId: keep.id },
      });
      await prisma.priceRule.updateMany({
        where: { categoryId: d.id },
        data: { categoryId: keep.id },
      });
      await prisma.vehicleCategory.delete({ where: { id: d.id } });
      removed++;
    }
  }
  console.log(`Done. Removed ${removed} duplicate categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
