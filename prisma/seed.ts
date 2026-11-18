import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.inspection.deleteMany();
  await prisma.rentalAgreement.deleteMany();
  await prisma.bookingExtra.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.extra.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.vehicleCategory.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("demo1234", 10);

  const user = await prisma.user.create({
    data: {
      email: "demo@rentfleet.gr",
      passwordHash,
      name: "Νίκος Δημητρίου",
      role: "OWNER",
    },
  });

  const org = await prisma.organization.create({
    data: {
      name: "Aegean Wheels",
      publicToken: "aegeanwheels",
      afm: "100000003",
      legalForm: "LEGAL",
      pytLicense: "PYT-DEMO-001",
      taxMode: "offline",
      clientLedgerMode: "offline",
      vatCategory: 1,
      invoiceSeries: "RF",
      nextInvoiceAa: 1,
      memberships: {
        create: { userId: user.id, role: "ADMIN" },
      },
    },
  });

  const hq = await prisma.branch.create({
    data: {
      name: "Ηράκλειο Airport",
      code: "HER",
      city: "Ηράκλειο",
      address: "Αεροδρόμιο Ν. Καζαντζάκης",
      aadeBranchCode: 0,
      organizationId: org.id,
    },
  });

  const city = await prisma.branch.create({
    data: {
      name: "Κέντρο Ηρακλείου",
      code: "HER-CITY",
      city: "Ηράκλειο",
      address: "25ης Αυγούστου 10",
      aadeBranchCode: 1,
      organizationId: org.id,
    },
  });

  const economy = await prisma.vehicleCategory.create({
    data: {
      name: "Economy",
      vehicleType: "CAR",
      baseDailyRate: 35,
      depositAmount: 400,
      seats: 5,
      transmission: "Manual",
      organizationId: org.id,
    },
  });

  const scooterCat = await prisma.vehicleCategory.create({
    data: {
      name: "Scooter 125",
      vehicleType: "SCOOTER",
      baseDailyRate: 22,
      depositAmount: 150,
      seats: 2,
      organizationId: org.id,
    },
  });

  const vanCat = await prisma.vehicleCategory.create({
    data: {
      name: "Cargo Van",
      vehicleType: "VAN",
      baseDailyRate: 65,
      depositAmount: 600,
      seats: 3,
      organizationId: org.id,
    },
  });

  const car = await prisma.vehicle.create({
    data: {
      plateNumber: "HKZ-1234",
      make: "Toyota",
      model: "Yaris",
      year: 2023,
      vehicleType: "CAR",
      status: "AVAILABLE",
      odometerKm: 18400,
      fuelType: "Petrol",
      categoryId: economy.id,
      branchId: hq.id,
      organizationId: org.id,
      kteoExpiry: new Date("2027-03-01"),
      insuranceExpiry: new Date("2026-12-31"),
      mechanicalExpiry: new Date("2026-11-15"),
    },
  });

  await prisma.vehicle.create({
    data: {
      plateNumber: "HKZ-901",
      make: "Honda",
      model: "PCX 125",
      year: 2024,
      vehicleType: "SCOOTER",
      status: "AVAILABLE",
      odometerKm: 3200,
      categoryId: scooterCat.id,
      branchId: city.id,
      organizationId: org.id,
      insuranceExpiry: new Date("2026-10-01"),
    },
  });

  await prisma.vehicle.create({
    data: {
      plateNumber: "HKZ-5500",
      make: "Fiat",
      model: "Ducato",
      year: 2022,
      vehicleType: "VAN",
      status: "AVAILABLE",
      odometerKm: 62000,
      categoryId: vanCat.id,
      branchId: hq.id,
      organizationId: org.id,
      insuranceExpiry: new Date("2026-09-01"),
      kteoExpiry: new Date("2026-08-01"),
    },
  });

  const gps = await prisma.extra.create({
    data: {
      name: "GPS",
      code: "GPS",
      dailyRate: 6,
      organizationId: org.id,
    },
  });

  await prisma.extra.create({
    data: {
      name: "Παιδικό κάθισμα",
      code: "CHILD",
      dailyRate: 5,
      organizationId: org.id,
    },
  });

  const customer = await prisma.customer.create({
    data: {
      firstName: "Μαρία",
      lastName: "Παπαδάκη",
      email: "maria@example.com",
      phone: "+306971234567",
      afm: "012345678",
      licenseNumber: "GR-DL-998877",
      licenseCountry: "GR",
      organizationId: org.id,
    },
  });

  const pickup = new Date();
  pickup.setDate(pickup.getDate() + 2);
  pickup.setHours(10, 0, 0, 0);
  const ret = new Date(pickup);
  ret.setDate(ret.getDate() + 5);

  await prisma.booking.create({
    data: {
      code: "AEG-DEMO1",
      channel: "ONLINE",
      status: "CONFIRMED",
      pickupAt: pickup,
      returnAt: ret,
      pickupPlace: hq.name,
      returnPlace: hq.name,
      dailyRate: 35,
      days: 5,
      extrasTotal: 30,
      subtotal: 205,
      vatAmount: 49.2,
      totalAmount: 254.2,
      depositAmount: 400,
      paymentStatus: "UNPAID",
      coveragesJson: JSON.stringify(["CDW"]),
      aadeLedgerStatus: "PENDING",
      customerId: customer.id,
      vehicleId: car.id,
      pickupBranchId: hq.id,
      returnBranchId: hq.id,
      organizationId: org.id,
      extras: {
        create: {
          extraId: gps.id,
          quantity: 1,
          unitPrice: 6,
          total: 30,
        },
      },
    },
  });

  console.log("Seed OK");
  console.log("Login: demo@rentfleet.gr / demo1234");
  console.log("Public booking: /book/aegeanwheels");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
