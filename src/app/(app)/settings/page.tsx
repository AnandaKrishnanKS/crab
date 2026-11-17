import { db } from "@/lib/db";
import { requireAuthPage } from "@/lib/auth-guard";
import { toNumber } from "@/lib/format";
import { type MineralRow } from "@/components/minerals-manager";
import { SettingsManager, type SettingsData } from "@/components/settings-manager";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [user, resolvedSearchParams, rawSettings, rawMinerals] = await Promise.all([
    requireAuthPage(),
    searchParams,
    db.settings.findUnique({ where: { id: 1 } }),
    db.mineral.findMany({
      include: { _count: { select: { additions: true } } },
      orderBy: [{ active: "desc" }, { purpose: "asc" }, { name: "asc" }],
    }),
  ]);

  const s = rawSettings;
  const initialSettings: SettingsData = {
    systemVolumeLitres: s?.systemVolumeLitres ?? 5000,
    waterChangeWarnDays: s?.waterChangeWarnDays ?? 90,
    waterChangeIntervalDays: s?.waterChangeIntervalDays ?? 120,
    waterTestIntervalDays: s?.waterTestIntervalDays ?? 1,
    salinityMin: s?.salinityMin ?? 18,
    salinityMax: s?.salinityMax ?? 25,
    phMin: s?.phMin ?? 7.6,
    phMax: s?.phMax ?? 8.3,
    ammoniaMax: s?.ammoniaMax ?? 0.25,
    nitriteMax: s?.nitriteMax ?? 0.25,
    nitrateMax: s?.nitrateMax ?? 40,
    tempMin: s?.tempMin ?? 26,
    tempMax: s?.tempMax ?? 31,
    targetFatteningDays: s?.targetFatteningDays ?? 45,
    lowMineralStockKg: s?.lowMineralStockKg ?? 2,
    softCrabAlert: s?.softCrabAlert ?? true,
  };

  const minerals: MineralRow[] = rawMinerals.map((m) => ({
    id: m.id,
    name: m.name,
    formula: m.formula,
    purpose: m.purpose,
    costPerKg: toNumber(m.costPerKg),
    stockKg: m.stockKg,
    active: m.active,
    notes: m.notes,
    naFraction: m.naFraction,
    mgFraction: m.mgFraction,
    caFraction: m.caFraction,
    kFraction: m.kFraction,
    clFraction: m.clFraction,
    so4Fraction: m.so4Fraction,
    hco3Fraction: m.hco3Fraction,
    additionCount: m._count.additions,
  }));

  const tabParam = resolvedSearchParams.tab;
  const initialTab =
    tabParam === "minerals" || tabParam === "account" ? tabParam : "ras";

  return (
    <SettingsManager
      initialSettings={initialSettings}
      minerals={minerals}
      initialTab={initialTab}
      userEmail={user.email ?? "owner@mudcrab.local"}
    />
  );
}
