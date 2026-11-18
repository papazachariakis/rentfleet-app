import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [vehicles, branches] = await Promise.all([
    prisma.vehicle.findMany({
      where: { organizationId: session.organizationId, active: true },
      select: {
        id: true,
        plateNumber: true,
        make: true,
        model: true,
        vehicleType: true,
        status: true,
        lat: true,
        lng: true,
        locationLabel: true,
        locationUpdatedAt: true,
        branchId: true,
        branch: { select: { id: true, name: true, lat: true, lng: true } },
        telematicsDevice: {
          select: {
            id: true,
            lastSeenAt: true,
            lastSpeedKmh: true,
            lastFuelPercent: true,
            lastIgnition: true,
            lastDtcsJson: true,
            lastNetwork: true,
            connectivity: true,
          },
        },
      },
      orderBy: { plateNumber: "asc" },
    }),
    prisma.branch.findMany({
      where: { organizationId: session.organizationId, active: true },
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        lat: true,
        lng: true,
      },
    }),
  ]);

  const markers = vehicles.map((v) => {
    const tel = v.telematicsDevice;
    const lat = v.lat ?? v.branch?.lat ?? null;
    const lng = v.lng ?? v.branch?.lng ?? null;
    const source =
      tel && v.lat != null && v.lng != null
        ? "telematics"
        : v.lat != null && v.lng != null
          ? "vehicle"
          : v.branch?.lat != null
            ? "branch"
            : null;
    const online =
      Boolean(tel?.lastSeenAt) &&
      Date.now() - new Date(tel!.lastSeenAt!).getTime() <= 5 * 60 * 1000;
    let dtcs: string[] = [];
    try {
      dtcs = JSON.parse(tel?.lastDtcsJson || "[]");
    } catch {
      dtcs = [];
    }
    return {
      id: v.id,
      plateNumber: v.plateNumber,
      make: v.make,
      model: v.model,
      vehicleType: v.vehicleType,
      status: v.status,
      lat: v.lat,
      lng: v.lng,
      locationLabel: v.locationLabel,
      locationUpdatedAt: v.locationUpdatedAt,
      branchId: v.branchId,
      branch: v.branch,
      mapLat: lat,
      mapLng: lng,
      locationSource: source as "telematics" | "vehicle" | "branch" | null,
      telematics: tel
        ? {
            online,
            speedKmh: tel.lastSpeedKmh,
            fuelPercent: tel.lastFuelPercent,
            ignition: tel.lastIgnition,
            network: tel.lastNetwork || tel.connectivity,
            dtcs,
            lastSeenAt: tel.lastSeenAt,
          }
        : null,
    };
  });

  return NextResponse.json({ vehicles: markers, branches });
}
