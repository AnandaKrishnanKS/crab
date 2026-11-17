-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "CrabStatus" AS ENUM ('ACTIVE', 'SICK', 'SOLD', 'DEAD');

-- CreateEnum
CREATE TYPE "TrayAssignmentReason" AS ENUM ('STOCKED', 'MOVED_TO_TREATMENT', 'MOVED_BACK', 'MOVED_OTHER');

-- CreateEnum
CREATE TYPE "MoltStage" AS ENUM ('PRE_MOLT', 'MOLTED', 'SOFT', 'HARDENING', 'HARD');

-- CreateEnum
CREATE TYPE "FeedTimeSlot" AS ENUM ('MORNING', 'EVENING', 'NIGHT');

-- CreateEnum
CREATE TYPE "TreatmentOutcome" AS ENUM ('ONGOING', 'RECOVERED', 'DIED');

-- CreateEnum
CREATE TYPE "MineralPurpose" AS ENUM ('SALINITY', 'MINERAL_BALANCE', 'PH_BUFFER');

-- CreateEnum
CREATE TYPE "MineralAdditionReason" AS ENUM ('SALINITY_ADJUST', 'PH_ADJUST', 'WATER_CHANGE', 'TOP_UP', 'OTHER');

-- CreateEnum
CREATE TYPE "SystemLogType" AS ENUM ('TOP_UP', 'BIOFILTER_CLEAN', 'MECHANICAL_FILTER_CLEAN', 'UV_SERVICE', 'PUMP_SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PENDING');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('ELECTRICITY', 'LABOUR', 'EQUIPMENT', 'TRANSPORT', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tray" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "isTreatmentTray" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tray_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Buyer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Buyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "letter" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "pricePerKg" DECIMAL(10,2),
    "nextCrabSeq" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crab" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "sex" "Sex" NOT NULL,
    "initialWeightG" DOUBLE PRECISION NOT NULL,
    "purchaseCost" DECIMAL(10,2) NOT NULL,
    "stockedDate" TIMESTAMP(3) NOT NULL,
    "expectedHarvestDate" TIMESTAMP(3),
    "status" "CrabStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentTrayId" TEXT,
    "endDate" TIMESTAMP(3),
    "deathCause" TEXT,
    "finalWeightG" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Crab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrayAssignment" (
    "id" TEXT NOT NULL,
    "crabId" TEXT NOT NULL,
    "trayId" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3),
    "reason" "TrayAssignmentReason" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrayAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightLog" (
    "id" TEXT NOT NULL,
    "crabId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weightG" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeightLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoltLog" (
    "id" TEXT NOT NULL,
    "crabId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "stage" "MoltStage" NOT NULL,
    "weightAfterG" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoltLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "costPerKg" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedLog" (
    "id" TEXT NOT NULL,
    "crabId" TEXT NOT NULL,
    "dateTime" TIMESTAMP(3) NOT NULL,
    "feedTypeId" TEXT NOT NULL,
    "quantityG" DOUBLE PRECISION NOT NULL,
    "timeSlot" "FeedTimeSlot" NOT NULL,
    "costAtTime" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentLog" (
    "id" TEXT NOT NULL,
    "crabId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "symptoms" TEXT NOT NULL,
    "diagnosis" TEXT,
    "treatment" TEXT NOT NULL,
    "dose" TEXT,
    "cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "outcome" "TreatmentOutcome" NOT NULL DEFAULT 'ONGOING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterTest" (
    "id" TEXT NOT NULL,
    "dateTime" TIMESTAMP(3) NOT NULL,
    "salinityPpt" DOUBLE PRECISION,
    "pH" DOUBLE PRECISION,
    "ammoniaMgL" DOUBLE PRECISION,
    "nitriteMgL" DOUBLE PRECISION,
    "nitrateMgL" DOUBLE PRECISION,
    "alkalinityMgL" DOUBLE PRECISION,
    "temperatureC" DOUBLE PRECISION,
    "dissolvedOxygenMgL" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterChange" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantityLitres" DOUBLE PRECISION NOT NULL,
    "percentChanged" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "calciumMgL" DOUBLE PRECISION,
    "magnesiumMgL" DOUBLE PRECISION,
    "potassiumMgL" DOUBLE PRECISION,
    "sodiumMgL" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mineral" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "purpose" "MineralPurpose" NOT NULL,
    "costPerKg" DECIMAL(10,2) NOT NULL,
    "stockKg" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "naFraction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mgFraction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "caFraction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kFraction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clFraction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "so4Fraction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hco3Fraction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mineral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MineralAddition" (
    "id" TEXT NOT NULL,
    "dateTime" TIMESTAMP(3) NOT NULL,
    "mineralId" TEXT NOT NULL,
    "quantityG" DOUBLE PRECISION NOT NULL,
    "costAtTime" DECIMAL(10,2) NOT NULL,
    "reason" "MineralAdditionReason" NOT NULL,
    "waterChangeId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MineralAddition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "SystemLogType" NOT NULL,
    "quantityLitres" DOUBLE PRECISION,
    "cost" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "crabId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weightG" DOUBLE PRECISION NOT NULL,
    "pricePerKg" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PAID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "systemVolumeLitres" DOUBLE PRECISION NOT NULL DEFAULT 5000,
    "waterChangeWarnDays" INTEGER NOT NULL DEFAULT 90,
    "waterChangeIntervalDays" INTEGER NOT NULL DEFAULT 120,
    "waterTestIntervalDays" INTEGER NOT NULL DEFAULT 1,
    "salinityMin" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "salinityMax" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "phMin" DOUBLE PRECISION NOT NULL DEFAULT 7.6,
    "phMax" DOUBLE PRECISION NOT NULL DEFAULT 8.3,
    "ammoniaMax" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "nitriteMax" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "nitrateMax" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "tempMin" DOUBLE PRECISION NOT NULL DEFAULT 26,
    "tempMax" DOUBLE PRECISION NOT NULL DEFAULT 31,
    "targetFatteningDays" INTEGER NOT NULL DEFAULT 45,
    "lowMineralStockKg" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "softCrabAlert" BOOLEAN NOT NULL DEFAULT true,
    "nextBatchIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tray_number_key" ON "Tray"("number");

-- CreateIndex
CREATE INDEX "Tray_active_idx" ON "Tray"("active");

-- CreateIndex
CREATE INDEX "Supplier_active_idx" ON "Supplier"("active");

-- CreateIndex
CREATE INDEX "Buyer_active_idx" ON "Buyer"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_letter_key" ON "Batch"("letter");

-- CreateIndex
CREATE INDEX "Batch_supplierId_idx" ON "Batch"("supplierId");

-- CreateIndex
CREATE INDEX "Batch_purchaseDate_idx" ON "Batch"("purchaseDate");

-- CreateIndex
CREATE UNIQUE INDEX "Crab_code_key" ON "Crab"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Crab_currentTrayId_key" ON "Crab"("currentTrayId");

-- CreateIndex
CREATE INDEX "Crab_status_idx" ON "Crab"("status");

-- CreateIndex
CREATE INDEX "Crab_batchId_idx" ON "Crab"("batchId");

-- CreateIndex
CREATE INDEX "Crab_stockedDate_idx" ON "Crab"("stockedDate");

-- CreateIndex
CREATE UNIQUE INDEX "Crab_batchId_seq_key" ON "Crab"("batchId", "seq");

-- CreateIndex
CREATE INDEX "TrayAssignment_crabId_idx" ON "TrayAssignment"("crabId");

-- CreateIndex
CREATE INDEX "TrayAssignment_trayId_idx" ON "TrayAssignment"("trayId");

-- CreateIndex
CREATE INDEX "TrayAssignment_fromDate_idx" ON "TrayAssignment"("fromDate");

-- CreateIndex
CREATE INDEX "WeightLog_crabId_date_idx" ON "WeightLog"("crabId", "date");

-- CreateIndex
CREATE INDEX "MoltLog_crabId_date_idx" ON "MoltLog"("crabId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FeedType_name_key" ON "FeedType"("name");

-- CreateIndex
CREATE INDEX "FeedType_active_idx" ON "FeedType"("active");

-- CreateIndex
CREATE INDEX "FeedLog_crabId_dateTime_idx" ON "FeedLog"("crabId", "dateTime");

-- CreateIndex
CREATE INDEX "FeedLog_feedTypeId_idx" ON "FeedLog"("feedTypeId");

-- CreateIndex
CREATE INDEX "FeedLog_dateTime_idx" ON "FeedLog"("dateTime");

-- CreateIndex
CREATE INDEX "TreatmentLog_crabId_date_idx" ON "TreatmentLog"("crabId", "date");

-- CreateIndex
CREATE INDEX "WaterTest_dateTime_idx" ON "WaterTest"("dateTime");

-- CreateIndex
CREATE INDEX "WaterChange_date_idx" ON "WaterChange"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Mineral_name_key" ON "Mineral"("name");

-- CreateIndex
CREATE INDEX "Mineral_active_idx" ON "Mineral"("active");

-- CreateIndex
CREATE INDEX "MineralAddition_dateTime_idx" ON "MineralAddition"("dateTime");

-- CreateIndex
CREATE INDEX "MineralAddition_mineralId_idx" ON "MineralAddition"("mineralId");

-- CreateIndex
CREATE INDEX "MineralAddition_waterChangeId_idx" ON "MineralAddition"("waterChangeId");

-- CreateIndex
CREATE INDEX "SystemLog_date_idx" ON "SystemLog"("date");

-- CreateIndex
CREATE INDEX "SystemLog_type_idx" ON "SystemLog"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_crabId_key" ON "Sale"("crabId");

-- CreateIndex
CREATE INDEX "Sale_buyerId_idx" ON "Sale"("buyerId");

-- CreateIndex
CREATE INDEX "Sale_date_idx" ON "Sale"("date");

-- CreateIndex
CREATE INDEX "Sale_paymentStatus_idx" ON "Sale"("paymentStatus");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crab" ADD CONSTRAINT "Crab_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crab" ADD CONSTRAINT "Crab_currentTrayId_fkey" FOREIGN KEY ("currentTrayId") REFERENCES "Tray"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrayAssignment" ADD CONSTRAINT "TrayAssignment_crabId_fkey" FOREIGN KEY ("crabId") REFERENCES "Crab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrayAssignment" ADD CONSTRAINT "TrayAssignment_trayId_fkey" FOREIGN KEY ("trayId") REFERENCES "Tray"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeightLog" ADD CONSTRAINT "WeightLog_crabId_fkey" FOREIGN KEY ("crabId") REFERENCES "Crab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoltLog" ADD CONSTRAINT "MoltLog_crabId_fkey" FOREIGN KEY ("crabId") REFERENCES "Crab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedLog" ADD CONSTRAINT "FeedLog_crabId_fkey" FOREIGN KEY ("crabId") REFERENCES "Crab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedLog" ADD CONSTRAINT "FeedLog_feedTypeId_fkey" FOREIGN KEY ("feedTypeId") REFERENCES "FeedType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentLog" ADD CONSTRAINT "TreatmentLog_crabId_fkey" FOREIGN KEY ("crabId") REFERENCES "Crab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MineralAddition" ADD CONSTRAINT "MineralAddition_mineralId_fkey" FOREIGN KEY ("mineralId") REFERENCES "Mineral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MineralAddition" ADD CONSTRAINT "MineralAddition_waterChangeId_fkey" FOREIGN KEY ("waterChangeId") REFERENCES "WaterChange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_crabId_fkey" FOREIGN KEY ("crabId") REFERENCES "Crab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- PartialUniqueIndex: only one open assignment (toDate IS NULL) per tray and per crab
CREATE UNIQUE INDEX "TrayAssignment_trayId_open_key" ON "TrayAssignment"("trayId") WHERE "toDate" IS NULL;
CREATE UNIQUE INDEX "TrayAssignment_crabId_open_key" ON "TrayAssignment"("crabId") WHERE "toDate" IS NULL;
