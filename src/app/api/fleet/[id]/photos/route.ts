import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  isR2Configured,
  r2DeleteByPublicUrl,
  r2Prefix,
  r2PutObject,
} from "@/lib/r2";

const MAX_PHOTOS = 8;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function extFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

async function ownedVehicle(id: string, orgId: string) {
  return prisma.vehicle.findFirst({
    where: { id, organizationId: orgId },
  });
}

/** Ανέβασμα φωτογραφιών οχήματος στο Cloudflare R2. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "Το R2 δεν είναι ρυθμισμένο (R2_* env)" },
      { status: 503 }
    );
  }

  const { id } = await ctx.params;
  const vehicle = await ownedVehicle(id, session.organizationId);
  if (!vehicle) {
    return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
  }

  const form = await req.formData();
  const files = form
    .getAll("files")
    .filter((f): f is File => typeof File !== "undefined" && f instanceof File);
  if (!files.length) {
    return NextResponse.json({ error: "Δεν δόθηκαν αρχεία" }, { status: 400 });
  }

  const remaining = MAX_PHOTOS - (vehicle.photos?.length || 0);
  if (remaining <= 0) {
    return NextResponse.json(
      { error: `Μέγιστο ${MAX_PHOTOS} φωτογραφίες ανά όχημα` },
      { status: 400 }
    );
  }

  const toUpload = files.slice(0, remaining);
  const uploaded: string[] = [];

  for (const file of toUpload) {
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: "Επιτρέπονται μόνο JPEG / PNG / WebP" },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Κάθε φωτογραφία έως 5MB" },
        { status: 400 }
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const key = `${r2Prefix()}/${session.organizationId}/vehicles/${id}/${randomUUID()}.${extFor(file.type)}`;
    const url = await r2PutObject({
      key,
      body: buf,
      contentType: file.type === "image/jpg" ? "image/jpeg" : file.type,
    });
    uploaded.push(url);
  }

  const photos = [...(vehicle.photos || []), ...uploaded];
  const updated = await prisma.vehicle.update({
    where: { id },
    data: { photos },
    include: { category: true, branch: true },
  });

  return NextResponse.json({ ok: true, photos: updated.photos, vehicle: updated });
}

/** Διαγραφή φωτογραφίας (URL) από όχημα + R2. */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const vehicle = await ownedVehicle(id, session.organizationId);
  if (!vehicle) {
    return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { url?: string };
  const url = (body.url || "").trim();
  if (!url) {
    return NextResponse.json({ error: "Λείπει url" }, { status: 400 });
  }

  const photos = (vehicle.photos || []).filter((p) => p !== url);
  if (photos.length === (vehicle.photos || []).length) {
    return NextResponse.json({ error: "Η φωτογραφία δεν βρέθηκε" }, { status: 404 });
  }

  if (isR2Configured()) {
    await r2DeleteByPublicUrl(url);
  }

  const updated = await prisma.vehicle.update({
    where: { id },
    data: { photos },
    include: { category: true, branch: true },
  });

  return NextResponse.json({ ok: true, photos: updated.photos, vehicle: updated });
}
