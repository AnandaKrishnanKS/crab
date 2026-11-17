import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set to run seed");
}

const pool = new Pool({
  connectionString,
  max: 5,
  connectionTimeoutMillis: 15000,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function daysAgo(days: number, hourIST = 9): Date {
  const now = new Date();
  // Anchor relative to IST calendar day so seeded timestamps match Asia/Kolkata dates
  const istDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));
  const hh = String(hourIST).padStart(2, "0");
  return new Date(`${istDateStr}T${hh}:00:00+05:30`);
}

async function main() {
  const ownerEmail = process.env.OWNER_EMAIL || "trippycrabs";
  const ownerPassword = process.env.OWNER_PASSWORD || "1710";
  const passwordHash = await bcrypt.hash(ownerPassword, 10);

  // If a previous owner record exists with a different email, update it
  const existingUser = await prisma.user.findFirst();
  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        email: ownerEmail,
        passwordHash,
      },
    });
  } else {
    await prisma.user.create({
      data: {
        name: "Owner",
        email: ownerEmail,
        passwordHash,
      },
    });
  }

  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      systemVolumeLitres: 5000,
      waterChangeWarnDays: 90,
      waterChangeIntervalDays: 120,
      waterTestIntervalDays: 1,
      salinityMin: 18,
      salinityMax: 25,
      phMin: 7.6,
      phMax: 8.3,
      ammoniaMax: 0.25,
      nitriteMax: 0.25,
      nitrateMax: 40,
      tempMin: 26,
      tempMax: 31,
      targetFatteningDays: 45,
      lowMineralStockKg: 2,
      softCrabAlert: true,
      nextBatchIndex: 2,
    },
  });

  const seedMinerals = [
    {
      name: "Sodium chloride",
      formula: "NaCl",
      purpose: "SALINITY" as const,
      costPerKg: 18,
      stockKg: 45,
      naFraction: 0.393,
      mgFraction: 0,
      caFraction: 0,
      kFraction: 0,
      clFraction: 0.607,
      so4Fraction: 0,
      hco3Fraction: 0,
      notes: "Food/aquaculture grade pure NaCl",
    },
    {
      name: "Magnesium chloride",
      formula: "MgCl2.6H2O",
      purpose: "MINERAL_BALANCE" as const,
      costPerKg: 75,
      stockKg: 12,
      naFraction: 0,
      mgFraction: 0.12,
      caFraction: 0,
      kFraction: 0,
      clFraction: 0.349,
      so4Fraction: 0,
      hco3Fraction: 0,
      notes: "Hexahydrate flake",
    },
    {
      name: "Magnesium sulphate",
      formula: "MgSO4.7H2O",
      purpose: "MINERAL_BALANCE" as const,
      costPerKg: 55,
      stockKg: 8,
      naFraction: 0,
      mgFraction: 0.099,
      caFraction: 0,
      kFraction: 0,
      clFraction: 0,
      so4Fraction: 0.39,
      hco3Fraction: 0,
      notes: "Epsom salt heptahydrate",
    },
    {
      name: "Calcium chloride",
      formula: "CaCl2.2H2O",
      purpose: "MINERAL_BALANCE" as const,
      costPerKg: 85,
      stockKg: 6,
      naFraction: 0,
      mgFraction: 0,
      caFraction: 0.273,
      kFraction: 0,
      clFraction: 0.482,
      so4Fraction: 0,
      hco3Fraction: 0,
      notes: "Dihydrate",
    },
    {
      name: "Potassium chloride",
      formula: "KCl",
      purpose: "MINERAL_BALANCE" as const,
      costPerKg: 110,
      stockKg: 1.5,
      naFraction: 0,
      mgFraction: 0,
      caFraction: 0,
      kFraction: 0.524,
      clFraction: 0.476,
      so4Fraction: 0,
      hco3Fraction: 0,
      notes: "Anhydrous KCl",
    },
    {
      name: "Sodium bicarbonate",
      formula: "NaHCO3",
      purpose: "PH_BUFFER" as const,
      costPerKg: 65,
      stockKg: 5,
      naFraction: 0.274,
      mgFraction: 0,
      caFraction: 0,
      kFraction: 0,
      clFraction: 0,
      so4Fraction: 0,
      hco3Fraction: 0.726,
      notes: "Alkalinity & pH buffer",
    },
  ];

  const mineralMap = new Map<string, { id: string; costPerKg: number }>();
  for (const m of seedMinerals) {
    const row = await prisma.mineral.upsert({
      where: { name: m.name },
      update: {},
      create: m,
    });
    mineralMap.set(m.formula, { id: row.id, costPerKg: Number(row.costPerKg) });
  }

  // 12 trays: 01..12, tray 12 is treatment tray
  const trayIds: Record<string, string> = {};
  for (let i = 1; i <= 12; i++) {
    const number = String(i).padStart(2, "0");
    const tray = await prisma.tray.upsert({
      where: { number },
      update: {},
      create: {
        number,
        isTreatmentTray: i === 12,
        active: true,
        notes: i === 12 ? "Quarantine & treatment box" : null,
      },
    });
    trayIds[number] = tray.id;
  }

  // Feed types
  const feedSeed = [
    { name: "Trash fish", costPerKg: 120 },
    { name: "Squid", costPerKg: 220 },
    { name: "Clam meat", costPerKg: 180 },
    { name: "Formulated pellet", costPerKg: 145 },
  ];
  const feedTypeMap = new Map<string, { id: string; costPerKg: number }>();
  for (const ft of feedSeed) {
    const row = await prisma.feedType.upsert({
      where: { name: ft.name },
      update: {},
      create: ft,
    });
    feedTypeMap.set(ft.name, { id: row.id, costPerKg: Number(row.costPerKg) });
  }

  // Only populate sample farm history if no batches exist yet
  const existingBatchCount = await prisma.batch.count();
  if (existingBatchCount > 0) {
    console.log("Seed skipped sample operational data (batches already exist).");
    return;
  }

  const supplier1 = await prisma.supplier.create({
    data: {
      name: "Chilika Crab Traders",
      phone: "9840112233",
      location: "Balugaon, Odisha",
      notes: "Wild-caught mud crabs, steady sizing",
    },
  });
  const supplier2 = await prisma.supplier.create({
    data: {
      name: "Pulicat Aqua Supply",
      phone: "9444223344",
      location: "Pazhaverkadu, TN",
      notes: "Morning live delivery",
    },
  });

  const buyer1 = await prisma.buyer.create({
    data: {
      name: "Chennai Live Exports",
      phone: "9841055667",
      location: "Royapuram, Chennai",
      notes: "Pays on delivery for export grade",
    },
  });
  const buyer2 = await prisma.buyer.create({
    data: {
      name: "Marina Seafood Mart",
      phone: "9940288990",
      location: "Adyar, Chennai",
      notes: "Weekly hotel supply",
    },
  });

  const trashFish = feedTypeMap.get("Trash fish")!;
  const squid = feedTypeMap.get("Squid")!;
  const clam = feedTypeMap.get("Clam meat")!;

  // Batch A (70 days ago): 4 SOLD, 2 DEAD (reusing trays 01..06)
  const batchA = await prisma.batch.create({
    data: {
      letter: "A",
      supplierId: supplier1.id,
      purchaseDate: daysAgo(70, 8),
      pricePerKg: 850,
      nextCrabSeq: 7,
      notes: "First fattening cycle",
    },
  });

  const batchASpecs = [
    { seq: 1, sex: "MALE" as const, initW: 420, finalW: 610, tray: "01", status: "SOLD" as const, endDaysAgo: 28, salePriceKg: 1850, paid: "PAID" as const },
    { seq: 2, sex: "FEMALE" as const, initW: 460, finalW: 640, tray: "02", status: "SOLD" as const, endDaysAgo: 26, salePriceKg: 1950, paid: "PAID" as const },
    { seq: 3, sex: "MALE" as const, initW: 390, finalW: 580, tray: "03", status: "SOLD" as const, endDaysAgo: 24, salePriceKg: 1800, paid: "PAID" as const },
    { seq: 4, sex: "FEMALE" as const, initW: 440, finalW: 625, tray: "04", status: "SOLD" as const, endDaysAgo: 22, salePriceKg: 1900, paid: "PENDING" as const },
    { seq: 5, sex: "MALE" as const, initW: 405, finalW: 420, tray: "05", status: "DEAD" as const, endDaysAgo: 45, deathCause: "Molt failure" },
    { seq: 6, sex: "FEMALE" as const, initW: 380, finalW: 395, tray: "06", status: "DEAD" as const, endDaysAgo: 40, deathCause: "Shell disease" },
  ];

  for (const spec of batchASpecs) {
    const stockedAt = daysAgo(70, 9);
    const endedAt = daysAgo(spec.endDaysAgo, 17);
    const purchaseCost = Math.round((spec.initW / 1000) * 850 * 100) / 100;
    const crab = await prisma.crab.create({
      data: {
        code: `a${spec.seq}`,
        batchId: batchA.id,
        seq: spec.seq,
        sex: spec.sex,
        initialWeightG: spec.initW,
        purchaseCost,
        stockedDate: stockedAt,
        expectedHarvestDate: daysAgo(25, 9),
        status: spec.status,
        currentTrayId: null,
        endDate: endedAt,
        finalWeightG: spec.finalW,
        deathCause: spec.deathCause ?? null,
      },
    });

    await prisma.trayAssignment.create({
      data: {
        crabId: crab.id,
        trayId: trayIds[spec.tray],
        fromDate: stockedAt,
        toDate: endedAt,
        reason: "STOCKED",
      },
    });

    await prisma.weightLog.createMany({
      data: [
        { crabId: crab.id, date: daysAgo(55, 10), weightG: spec.initW + 65 },
        { crabId: crab.id, date: daysAgo(spec.endDaysAgo + 3, 10), weightG: spec.finalW - 10 },
      ],
    });

    await prisma.moltLog.create({
      data: {
        crabId: crab.id,
        date: daysAgo(52, 7),
        stage: spec.status === "DEAD" ? "SOFT" : "HARD",
        weightAfterG: spec.initW + 75,
        notes: spec.status === "DEAD" ? "Incomplete hardening" : "Clean molt",
      },
    });

    const feedDays = [68, 65, 62, 58, 54, 50, 46];
    await prisma.feedLog.createMany({
      data: feedDays.map((d, idx) => {
        const ft = idx % 2 === 0 ? trashFish : squid;
        const qty = 28;
        return {
          crabId: crab.id,
          dateTime: daysAgo(d, 18),
          feedTypeId: ft.id,
          quantityG: qty,
          timeSlot: "EVENING" as const,
          costAtTime: Math.round((qty / 1000) * ft.costPerKg * 100) / 100,
        };
      }),
    });

    if (spec.status === "SOLD" && spec.salePriceKg) {
      await prisma.sale.create({
        data: {
          crabId: crab.id,
          buyerId: spec.seq % 2 === 0 ? buyer1.id : buyer2.id,
          date: endedAt,
          weightG: spec.finalW,
          pricePerKg: spec.salePriceKg,
          totalAmount: Math.round((spec.finalW / 1000) * spec.salePriceKg * 100) / 100,
          paymentStatus: spec.paid ?? "PAID",
        },
      });
    } else if (spec.status === "DEAD") {
      await prisma.treatmentLog.create({
        data: {
          crabId: crab.id,
          date: daysAgo(spec.endDaysAgo + 2, 11),
          symptoms: "Lethargic, dark lesions on carapace",
          diagnosis: "Shell necrosis",
          treatment: "Freshwater dip & oxytetracycline bath",
          dose: "10 ppm bath 30 min",
          cost: 45,
          outcome: "DIED",
        },
      });
    }
  }

  // Batch B (18 days ago): 7 ACTIVE (trays 01..07) + 1 SICK (moved from 08 to treatment tray 12)
  const batchB = await prisma.batch.create({
    data: {
      letter: "B",
      supplierId: supplier2.id,
      purchaseDate: daysAgo(18, 8),
      pricePerKg: 900,
      nextCrabSeq: 9,
      notes: "Current active stock",
    },
  });

  const batchBSpecs = [
    { seq: 1, sex: "MALE" as const, initW: 410, latestW: 485, tray: "01", molt: "HARDENING" as const, fedToday: true },
    { seq: 2, sex: "FEMALE" as const, initW: 450, latestW: 525, tray: "02", molt: "PRE_MOLT" as const, fedToday: true },
    { seq: 3, sex: "MALE" as const, initW: 430, latestW: 510, tray: "03", molt: "SOFT" as const, fedToday: true },
    { seq: 4, sex: "FEMALE" as const, initW: 470, latestW: 545, tray: "04", molt: "HARD" as const, fedToday: true },
    { seq: 5, sex: "MALE" as const, initW: 395, latestW: 460, tray: "05", molt: "HARD" as const, fedToday: true },
    { seq: 6, sex: "FEMALE" as const, initW: 440, latestW: 505, tray: "06", molt: "HARDENING" as const, fedToday: false },
    { seq: 7, sex: "MALE" as const, initW: 415, latestW: 475, tray: "07", molt: "HARD" as const, fedToday: false },
  ];

  for (const spec of batchBSpecs) {
    const stockedAt = daysAgo(18, 9);
    const purchaseCost = Math.round((spec.initW / 1000) * 900 * 100) / 100;
    const crab = await prisma.crab.create({
      data: {
        code: `b${spec.seq}`,
        batchId: batchB.id,
        seq: spec.seq,
        sex: spec.sex,
        initialWeightG: spec.initW,
        purchaseCost,
        stockedDate: stockedAt,
        expectedHarvestDate: daysAgo(-27, 9),
        status: "ACTIVE",
        currentTrayId: trayIds[spec.tray],
      },
    });

    await prisma.trayAssignment.create({
      data: {
        crabId: crab.id,
        trayId: trayIds[spec.tray],
        fromDate: stockedAt,
        toDate: null,
        reason: "STOCKED",
      },
    });

    await prisma.weightLog.create({
      data: { crabId: crab.id, date: daysAgo(4, 10), weightG: spec.latestW },
    });

    await prisma.moltLog.create({
      data: {
        crabId: crab.id,
        date: daysAgo(2, 8),
        stage: spec.molt,
        weightAfterG: spec.molt === "SOFT" ? spec.latestW : null,
        notes: spec.molt === "SOFT" ? "Fresh molt — monitor handling" : null,
      },
    });

    const recentDays = spec.fedToday ? [16, 12, 8, 4, 1, 0] : [16, 12, 8, 4, 1];
    await prisma.feedLog.createMany({
      data: recentDays.map((d, idx) => {
        const ft = idx % 3 === 0 ? clam : idx % 2 === 0 ? squid : trashFish;
        const qty = 25;
        return {
          crabId: crab.id,
          dateTime: daysAgo(d, d === 0 ? 8 : 18),
          feedTypeId: ft.id,
          quantityG: qty,
          timeSlot: d === 0 ? ("MORNING" as const) : ("EVENING" as const),
          costAtTime: Math.round((qty / 1000) * ft.costPerKg * 100) / 100,
        };
      }),
    });
  }

  // b8: SICK crab moved from tray 08 to treatment tray 12
  const b8 = await prisma.crab.create({
    data: {
      code: "b8",
      batchId: batchB.id,
      seq: 8,
      sex: "FEMALE",
      initialWeightG: 425,
      purchaseCost: Math.round((425 / 1000) * 900 * 100) / 100,
      stockedDate: daysAgo(18, 9),
      expectedHarvestDate: daysAgo(-27, 9),
      status: "SICK",
      currentTrayId: trayIds["12"],
      notes: "Moved to treatment tray for shell spot",
    },
  });

  await prisma.trayAssignment.create({
    data: {
      crabId: b8.id,
      trayId: trayIds["08"],
      fromDate: daysAgo(18, 9),
      toDate: daysAgo(3, 11),
      reason: "STOCKED",
    },
  });
  await prisma.trayAssignment.create({
    data: {
      crabId: b8.id,
      trayId: trayIds["12"],
      fromDate: daysAgo(3, 11),
      toDate: null,
      reason: "MOVED_TO_TREATMENT",
    },
  });
  await prisma.weightLog.create({
    data: { crabId: b8.id, date: daysAgo(5, 10), weightG: 440 },
  });
  await prisma.treatmentLog.create({
    data: {
      crabId: b8.id,
      date: daysAgo(3, 11),
      symptoms: "White spot on cheliped, reduced appetite",
      diagnosis: "Early bacterial shell lesion",
      treatment: "Iodine dip + clean salted quarantine water",
      dose: "50 ppm 15 min dip",
      cost: 60,
      outcome: "ONGOING",
      notes: "Check appetite after 48h",
    },
  });

  // Daily water tests for 30 days (including today)
  const waterTestRows = [];
  for (let d = 29; d >= 0; d--) {
    const wave = Math.sin(d / 3);
    waterTestRows.push({
      dateTime: daysAgo(d, 7),
      salinityPpt: Math.round((20.5 + wave * 0.8) * 10) / 10,
      pH: Math.round((7.95 + wave * 0.1) * 100) / 100,
      ammoniaMgL: Math.round((0.06 + Math.abs(wave) * 0.05) * 100) / 100,
      nitriteMgL: Math.round((0.05 + Math.abs(wave) * 0.04) * 100) / 100,
      nitrateMgL: Math.round((18 + (29 - d) * 0.3) * 10) / 10,
      alkalinityMgL: Math.round(132 + wave * 6),
      temperatureC: Math.round((28.4 + wave * 0.6) * 10) / 10,
      dissolvedOxygenMgL: Math.round((6.2 + wave * 0.2) * 10) / 10,
      notes: d === 0 ? "Morning routine check" : null,
    });
  }
  await prisma.waterTest.createMany({ data: waterTestRows });

  // Water change ~2 months (62 days) ago with all 6 chemicals
  const wcDate = daysAgo(62, 10);
  const waterChange = await prisma.waterChange.create({
    data: {
      date: wcDate,
      quantityLitres: 4500,
      percentChanged: 90,
      calciumMgL: 245,
      magnesiumMgL: 735,
      potassiumMgL: 215,
      sodiumMgL: 6150,
      notes: "Full RAS water exchange and mineral balance",
    },
  });

  const wcChemicals = [
    { formula: "NaCl", grams: 95000, reason: "WATER_CHANGE" as const },
    { formula: "MgCl2.6H2O", grams: 14500, reason: "WATER_CHANGE" as const },
    { formula: "MgSO4.7H2O", grams: 9800, reason: "WATER_CHANGE" as const },
    { formula: "CaCl2.2H2O", grams: 4200, reason: "WATER_CHANGE" as const },
    { formula: "KCl", grams: 1950, reason: "WATER_CHANGE" as const },
    { formula: "NaHCO3", grams: 950, reason: "WATER_CHANGE" as const },
  ];

  for (const item of wcChemicals) {
    const min = mineralMap.get(item.formula)!;
    await prisma.mineralAddition.create({
      data: {
        dateTime: wcDate,
        mineralId: min.id,
        quantityG: item.grams,
        costAtTime: Math.round((item.grams / 1000) * min.costPerKg * 100) / 100,
        reason: item.reason,
        waterChangeId: waterChange.id,
        notes: "Dissolved & dosed during water change",
      },
    });
  }

  // Standalone NaCl and NaHCO3 additions
  const nacl = mineralMap.get("NaCl")!;
  const nahco3 = mineralMap.get("NaHCO3")!;
  await prisma.mineralAddition.createMany({
    data: [
      {
        dateTime: daysAgo(21, 16),
        mineralId: nacl.id,
        quantityG: 4500,
        costAtTime: Math.round((4500 / 1000) * nacl.costPerKg * 100) / 100,
        reason: "SALINITY_ADJUST",
        notes: "Adjusted salinity back to 21 ppt after freshwater top-up",
      },
      {
        dateTime: daysAgo(10, 15),
        mineralId: nahco3.id,
        quantityG: 350,
        costAtTime: Math.round((350 / 1000) * nahco3.costPerKg * 100) / 100,
        reason: "PH_ADJUST",
        notes: "Buffered alkalinity & pH",
      },
      {
        dateTime: daysAgo(3, 15),
        mineralId: nahco3.id,
        quantityG: 250,
        costAtTime: Math.round((250 / 1000) * nahco3.costPerKg * 100) / 100,
        reason: "PH_ADJUST",
        notes: "Minor alkalinity top-up",
      },
    ],
  });

  // RAS Maintenance logs
  await prisma.systemLog.createMany({
    data: [
      {
        date: daysAgo(22, 11),
        type: "TOP_UP",
        quantityLitres: 250,
        cost: 0,
        notes: "Evaporation replacement",
      },
      {
        date: daysAgo(12, 11),
        type: "MECHANICAL_FILTER_CLEAN",
        notes: "Rinsed filter socks & drum screen",
      },
      {
        date: daysAgo(5, 10),
        type: "BIOFILTER_CLEAN",
        cost: 150,
        notes: "Gentle sump sludge purge",
      },
    ],
  });

  // Sample Expenses
  await prisma.expense.createMany({
    data: [
      { date: daysAgo(35, 12), category: "ELECTRICITY", amount: 4800, notes: "RAS pump & blower power bill" },
      { date: daysAgo(32, 12), category: "LABOUR", amount: 6500, notes: "Part-time helper monthly pay" },
      { date: daysAgo(15, 14), category: "TRANSPORT", amount: 850, notes: "Batch B live crab pickup" },
      { date: daysAgo(6, 12), category: "ELECTRICITY", amount: 5100, notes: "Current cycle power bill" },
      { date: daysAgo(2, 12), category: "EQUIPMENT", amount: 1400, notes: "Air stones & test reagents" },
    ],
  });

  console.log("Seed completed successfully.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

