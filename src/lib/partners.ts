import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export function newPartnerToken() {
  return randomBytes(8).toString("hex");
}

export async function loadActivePartnerAgreement(
  organizationId: string,
  agreementId: string
) {
  const now = new Date();
  return prisma.partnerAgreement.findFirst({
    where: {
      id: agreementId,
      organizationId,
      active: true,
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
        { OR: [{ validTo: null }, { validTo: { gte: now } }] },
      ],
    },
    include: { rates: true },
  });
}

export async function loadPartnerByPublicToken(token: string) {
  const now = new Date();
  return prisma.partnerAgreement.findFirst({
    where: {
      publicToken: token,
      active: true,
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
        { OR: [{ validTo: null }, { validTo: { gte: now } }] },
      ],
    },
    include: {
      rates: true,
      organization: true,
    },
  });
}
