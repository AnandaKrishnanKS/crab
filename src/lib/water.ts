import { toNumber } from "./format";

export interface IonFractions {
  naFraction: number;
  mgFraction: number;
  caFraction: number;
  kFraction: number;
  clFraction: number;
  so4Fraction: number;
  hco3Fraction: number;
}

export interface AddedIonsMg {
  naMg: number;
  mgMg: number;
  caMg: number;
  kMg: number;
  clMg: number;
  so4Mg: number;
  hco3Mg: number;
}

export function computeAddedIonsMg(quantityG: number, fractions: IonFractions): AddedIonsMg {
  const q = Math.max(0, quantityG) * 1000;
  return {
    naMg: Math.round(q * fractions.naFraction),
    mgMg: Math.round(q * fractions.mgFraction),
    caMg: Math.round(q * fractions.caFraction),
    kMg: Math.round(q * fractions.kFraction),
    clMg: Math.round(q * fractions.clFraction),
    so4Mg: Math.round(q * fractions.so4Fraction),
    hco3Mg: Math.round(q * fractions.hco3Fraction),
  };
}

export function sumAddedIonsMg(items: AddedIonsMg[]): AddedIonsMg {
  return items.reduce<AddedIonsMg>(
    (acc, cur) => ({
      naMg: acc.naMg + cur.naMg,
      mgMg: acc.mgMg + cur.mgMg,
      caMg: acc.caMg + cur.caMg,
      kMg: acc.kMg + cur.kMg,
      clMg: acc.clMg + cur.clMg,
      so4Mg: acc.so4Mg + cur.so4Mg,
      hco3Mg: acc.hco3Mg + cur.hco3Mg,
    }),
    { naMg: 0, mgMg: 0, caMg: 0, kMg: 0, clMg: 0, so4Mg: 0, hco3Mg: 0 }
  );
}

export interface MineralReadingInputs {
  calciumMgL: number | null;
  magnesiumMgL: number | null;
  potassiumMgL: number | null;
  sodiumMgL: number | null;
}

export interface WaterMineralRatios {
  mgToCa: number | null;
  naToK: number | null;
  caToK: number | null;
}

export function computeWaterRatios(input: MineralReadingInputs): WaterMineralRatios {
  const { calciumMgL, magnesiumMgL, potassiumMgL, sodiumMgL } = input;
  return {
    mgToCa:
      magnesiumMgL !== null && calciumMgL !== null && calciumMgL > 0
        ? Math.round((magnesiumMgL / calciumMgL) * 100) / 100
        : null,
    naToK:
      sodiumMgL !== null && potassiumMgL !== null && potassiumMgL > 0
        ? Math.round((sodiumMgL / potassiumMgL) * 100) / 100
        : null,
    caToK:
      calciumMgL !== null && potassiumMgL !== null && potassiumMgL > 0
        ? Math.round((calciumMgL / potassiumMgL) * 100) / 100
        : null,
  };
}

export interface MineralDefinition extends IonFractions {
  id: string;
  name: string;
  formula: string;
  purpose: "SALINITY" | "MINERAL_BALANCE" | "PH_BUFFER";
  costPerKg: number | string | { toString(): string };
}

export interface DoseCalculatorInput {
  systemVolumeLitres: number;
  currentSalinityPpt?: number | null;
  targetSalinityPpt?: number | null;
  currentCaMgL?: number | null;
  targetCaMgL?: number | null;
  currentMgMgL?: number | null;
  targetMgMgL?: number | null;
  mgCl2SharePercent?: number; // 0..100, default 50
  currentKMgL?: number | null;
  targetKMgL?: number | null;
  alkalinityMode?: "CACO3" | "HCO3";
  currentAlkalinity?: number | null;
  targetAlkalinity?: number | null;
}

export interface DoseRecommendationItem {
  mineralId: string;
  name: string;
  formula: string;
  grams: number;
  estimatedCost: number;
  reason: "SALINITY_ADJUST" | "PH_ADJUST" | "MINERAL_BALANCE";
  note: string;
}

export interface DoseCalculatorResult {
  items: DoseRecommendationItem[];
  totalEstimatedCost: number;
  mineralSalinityPptContribution: number;
}

/**
 * Computes exact chemical doses for RAS adjustment:
 * grams = (increase in mg/L * volume in L / 1000) / ionFraction
 *
 * Alkalinity as CaCO3 converts to HCO3- using equivalent weight ratio 61.017 / 50.045 (~1.22).
 */
export function calculateChemicalDoses(
  input: DoseCalculatorInput,
  minerals: MineralDefinition[]
): DoseCalculatorResult {
  const vol = Math.max(0, input.systemVolumeLitres);
  if (vol <= 0) {
    return { items: [], totalEstimatedCost: 0, mineralSalinityPptContribution: 0 };
  }

  const byFormula = new Map(minerals.map((m) => [m.formula.toLowerCase(), m]));
  const nacl = byFormula.get("nacl") ?? minerals.find((m) => m.purpose === "SALINITY");
  const mgcl2 =
    byFormula.get("mgcl2.6h2o") ??
    minerals.find((m) => m.mgFraction > 0 && m.clFraction > 0);
  const mgso4 =
    byFormula.get("mgso4.7h2o") ??
    minerals.find((m) => m.mgFraction > 0 && m.so4Fraction > 0);
  const cacl2 =
    byFormula.get("cacl2.2h2o") ?? minerals.find((m) => m.caFraction > 0);
  const kcl = byFormula.get("kcl") ?? minerals.find((m) => m.kFraction > 0);
  const nahco3 =
    byFormula.get("nahco3") ??
    minerals.find((m) => m.hco3Fraction > 0 || m.purpose === "PH_BUFFER");

  const items: DoseRecommendationItem[] = [];

  const calcGrams = (deltaMgL: number, fraction: number): number => {
    if (deltaMgL <= 0 || fraction <= 0) return 0;
    return Math.round(((deltaMgL * vol) / 1000 / fraction) * 10) / 10;
  };

  // 1. Salinity (NaCl)
  const deltaSal =
    input.targetSalinityPpt != null && input.currentSalinityPpt != null
      ? Math.max(0, input.targetSalinityPpt - input.currentSalinityPpt)
      : 0;
  if (nacl && deltaSal > 0) {
    const saltFraction = Math.max(0.01, nacl.naFraction + nacl.clFraction);
    const grams = calcGrams(deltaSal * 1000, saltFraction);
    if (grams > 0) {
      items.push({
        mineralId: nacl.id,
        name: nacl.name,
        formula: nacl.formula,
        grams,
        estimatedCost: Math.round(((grams / 1000) * toNumber(nacl.costPerKg)) * 100) / 100,
        reason: "SALINITY_ADJUST",
        note: `Raise salinity by ${deltaSal.toFixed(2)} ppt`,
      });
    }
  }

  // 2. Magnesium (split between MgCl2.6H2O and MgSO4.7H2O)
  const deltaMg =
    input.targetMgMgL != null && input.currentMgMgL != null
      ? Math.max(0, input.targetMgMgL - input.currentMgMgL)
      : 0;
  if (deltaMg > 0) {
    const mgCl2Share = Math.min(100, Math.max(0, input.mgCl2SharePercent ?? 50)) / 100;
    const mgSo4Share = 1 - mgCl2Share;

    if (mgcl2 && mgCl2Share > 0 && mgcl2.mgFraction > 0) {
      const grams = calcGrams(deltaMg * mgCl2Share, mgcl2.mgFraction);
      if (grams > 0) {
        items.push({
          mineralId: mgcl2.id,
          name: mgcl2.name,
          formula: mgcl2.formula,
          grams,
          estimatedCost: Math.round(((grams / 1000) * toNumber(mgcl2.costPerKg)) * 100) / 100,
          reason: "MINERAL_BALANCE",
          note: `Supply ${Math.round(mgCl2Share * 100)}% of +${deltaMg.toFixed(1)} mg/L Mg`,
        });
      }
    }

    if (mgso4 && mgSo4Share > 0 && mgso4.mgFraction > 0) {
      const grams = calcGrams(deltaMg * mgSo4Share, mgso4.mgFraction);
      if (grams > 0) {
        items.push({
          mineralId: mgso4.id,
          name: mgso4.name,
          formula: mgso4.formula,
          grams,
          estimatedCost: Math.round(((grams / 1000) * toNumber(mgso4.costPerKg)) * 100) / 100,
          reason: "MINERAL_BALANCE",
          note: `Supply ${Math.round(mgSo4Share * 100)}% of +${deltaMg.toFixed(1)} mg/L Mg`,
        });
      }
    }
  }

  // 3. Calcium
  const deltaCa =
    input.targetCaMgL != null && input.currentCaMgL != null
      ? Math.max(0, input.targetCaMgL - input.currentCaMgL)
      : 0;
  if (cacl2 && deltaCa > 0 && cacl2.caFraction > 0) {
    const grams = calcGrams(deltaCa, cacl2.caFraction);
    if (grams > 0) {
      items.push({
        mineralId: cacl2.id,
        name: cacl2.name,
        formula: cacl2.formula,
        grams,
        estimatedCost: Math.round(((grams / 1000) * toNumber(cacl2.costPerKg)) * 100) / 100,
        reason: "MINERAL_BALANCE",
        note: `Raise Ca by ${deltaCa.toFixed(1)} mg/L`,
      });
    }
  }

  // 4. Potassium
  const deltaK =
    input.targetKMgL != null && input.currentKMgL != null
      ? Math.max(0, input.targetKMgL - input.currentKMgL)
      : 0;
  if (kcl && deltaK > 0 && kcl.kFraction > 0) {
    const grams = calcGrams(deltaK, kcl.kFraction);
    if (grams > 0) {
      items.push({
        mineralId: kcl.id,
        name: kcl.name,
        formula: kcl.formula,
        grams,
        estimatedCost: Math.round(((grams / 1000) * toNumber(kcl.costPerKg)) * 100) / 100,
        reason: "MINERAL_BALANCE",
        note: `Raise K by ${deltaK.toFixed(1)} mg/L`,
      });
    }
  }

  // 5. Alkalinity / Bicarbonate
  const deltaAlkRaw =
    input.targetAlkalinity != null && input.currentAlkalinity != null
      ? Math.max(0, input.targetAlkalinity - input.currentAlkalinity)
      : 0;
  const deltaHco3 =
    input.alkalinityMode === "HCO3" ? deltaAlkRaw : deltaAlkRaw * 1.2192;
  if (nahco3 && deltaHco3 > 0 && nahco3.hco3Fraction > 0) {
    const grams = calcGrams(deltaHco3, nahco3.hco3Fraction);
    if (grams > 0) {
      items.push({
        mineralId: nahco3.id,
        name: nahco3.name,
        formula: nahco3.formula,
        grams,
        estimatedCost: Math.round(((grams / 1000) * toNumber(nahco3.costPerKg)) * 100) / 100,
        reason: "PH_ADJUST",
        note:
          input.alkalinityMode === "HCO3"
            ? `Raise HCO3 by ${deltaAlkRaw.toFixed(1)} mg/L`
            : `Raise alkalinity by ${deltaAlkRaw.toFixed(1)} mg/L as CaCO3`,
      });
    }
  }

  // Approximate dissolved ions added by non-NaCl minerals (in ppt)
  let nonNaclIonMg = 0;
  for (const item of items) {
    if (nacl && item.mineralId === nacl.id) continue;
    const min = minerals.find((m) => m.id === item.mineralId);
    if (!min) continue;
    const ionSum =
      min.naFraction +
      min.mgFraction +
      min.caFraction +
      min.kFraction +
      min.clFraction +
      min.so4Fraction +
      min.hco3Fraction;
    nonNaclIonMg += item.grams * 1000 * ionSum;
  }

  const mineralSalinityPptContribution =
    vol > 0 ? Math.round((nonNaclIonMg / vol / 1000) * 1000) / 1000 : 0;
  const totalEstimatedCost =
    Math.round(items.reduce((sum, i) => sum + i.estimatedCost, 0) * 100) / 100;

  return {
    items,
    totalEstimatedCost,
    mineralSalinityPptContribution,
  };
}

