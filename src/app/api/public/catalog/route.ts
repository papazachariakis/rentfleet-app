import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { orgCanAcceptPayments } from "@/lib/stripe";
import { sortByCategoryName } from "@/lib/utils";
import { publicOptions, withPublicCors } from "@/lib/public-cors";

export async function OPTIONS(req: Request) {
  return publicOptions(req);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!token) {
    return withPublicCors(
      req,
      NextResponse.json({ error: "Λείπει token" }, { status: 400 })
    );
  }

  const org = await prisma.organization.findUnique({
    where: { publicToken: token },
    include: {
      categories: { where: { active: true } },
      branches: { where: { active: true }, orderBy: { name: "asc" } },
      extras: { where: { active: true }, orderBy: { name: "asc" } },
    },
  });

  if (!org) {
    return withPublicCors(
      req,
      NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 })
    );
  }

  const categories = sortByCategoryName(org.categories).map((c) => ({
    id: c.id,
    name: c.name,
    vehicleType: c.vehicleType,
    baseDailyRate: c.baseDailyRate,
    depositAmount: c.depositAmount,
    seats: c.seats,
    transmission: c.transmission,
    imageUrl: c.imageUrl || null,
  }));

  return withPublicCors(
    req,
    NextResponse.json({
      org: {
        name: org.name,
        brandPrimary: org.brandPrimary,
        brandAccent: org.brandAccent,
        brandLogoUrl: org.brandLogoUrl,
        brandTagline: org.brandTagline,
        brandHeroText: org.brandHeroText,
        hidePoweredBy: org.hidePoweredBy,
        paymentsEnabled: orgCanAcceptPayments(org),
      },
      categories,
      branches: org.branches.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        city: b.city,
      })),
      extras: org.extras.map((e) => ({
        id: e.id,
        name: e.name,
        dailyRate: e.dailyRate,
        flatRate: e.flatRate,
      })),
    })
  );
}
