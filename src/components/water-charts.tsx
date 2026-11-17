"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartBox } from "@/components/chart-box";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR, formatNumberIN } from "@/lib/format";

export interface WaterTestPoint {
  dateLabel: string;
  salinityPpt: number | null;
  pH: number | null;
  alkalinityMgL: number | null;
  ammoniaMgL: number | null;
  nitriteMgL: number | null;
  nitrateMgL: number | null;
}

export interface MonthlyChemicalChartPoint {
  monthLabel: string;
  kg: number;
  cost: number;
}

export interface WaterChartThresholds {
  salinityMin: number;
  salinityMax: number;
  phMin: number;
  phMax: number;
  ammoniaMax: number;
  nitriteMax: number;
  nitrateMax: number;
}

function SingleLineTrendCard({
  title,
  data,
  dataKey,
  unit,
  stroke,
  refLines,
}: {
  title: string;
  data: WaterTestPoint[];
  dataKey: keyof WaterTestPoint;
  unit: string;
  stroke: string;
  refLines: Array<{ y: number; label: string; color: string }>;
}) {
  const filtered = data.filter((d) => d[dataKey] !== null);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-slate-900">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-500">
            No {title.toLowerCase()} readings logged yet.
          </p>
        ) : (
          <ChartBox height={210}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filtered} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: "#475569" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#475569" }}
                  width={44}
                  tickFormatter={(v: number) => `${v}`}
                />
                <Tooltip
                  formatter={(value) => [
                    `${formatNumberIN(Number(value ?? 0), 2)}${unit ? ` ${unit}` : ""}`,
                    title,
                  ]}
                />
                {refLines.map((rl) => (
                  <ReferenceLine
                    key={rl.label}
                    y={rl.y}
                    stroke={rl.color}
                    strokeDasharray="4 4"
                    label={{
                      value: rl.label,
                      position: "insideTopRight",
                      fill: rl.color,
                      fontSize: 10,
                    }}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey={dataKey}
                  stroke={stroke}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>
        )}
      </CardContent>
    </Card>
  );
}

export function WaterTrendCharts({
  points,
  thresholds,
}: {
  points: WaterTestPoint[];
  thresholds: WaterChartThresholds;
}) {
  const phAlkData = points.filter((p) => p.pH !== null || p.alkalinityMgL !== null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SingleLineTrendCard
        title="Salinity (ppt)"
        data={points}
        dataKey="salinityPpt"
        unit="ppt"
        stroke="#0f766e"
        refLines={[
          { y: thresholds.salinityMin, label: `Min ${thresholds.salinityMin}`, color: "#b45309" },
          { y: thresholds.salinityMax, label: `Max ${thresholds.salinityMax}`, color: "#b45309" },
        ]}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-slate-900">
            pH &amp; Alkalinity (mg/L CaCO₃)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {phAlkData.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-500">
              No pH or alkalinity readings logged yet.
            </p>
          ) : (
            <ChartBox height={210}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={phAlkData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: "#475569" }} />
                  <YAxis
                    yAxisId="ph"
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 11, fill: "#0369a1" }}
                    width={36}
                  />
                  <YAxis
                    yAxisId="alk"
                    orientation="right"
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 11, fill: "#7c3aed" }}
                    width={42}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      name === "Alkalinity"
                        ? `${formatNumberIN(Number(value ?? 0), 0)} mg/L`
                        : formatNumberIN(Number(value ?? 0), 2),
                      String(name),
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine
                    yAxisId="ph"
                    y={thresholds.phMin}
                    stroke="#b45309"
                    strokeDasharray="4 4"
                  />
                  <ReferenceLine
                    yAxisId="ph"
                    y={thresholds.phMax}
                    stroke="#b45309"
                    strokeDasharray="4 4"
                  />
                  <Line
                    yAxisId="ph"
                    type="monotone"
                    dataKey="pH"
                    name="pH"
                    stroke="#0369a1"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="alk"
                    type="monotone"
                    dataKey="alkalinityMgL"
                    name="Alkalinity"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartBox>
          )}
        </CardContent>
      </Card>

      <SingleLineTrendCard
        title="Ammonia NH₃ (mg/L)"
        data={points}
        dataKey="ammoniaMgL"
        unit="mg/L"
        stroke="#dc2626"
        refLines={[
          { y: thresholds.ammoniaMax, label: `Max ${thresholds.ammoniaMax}`, color: "#dc2626" },
        ]}
      />

      <SingleLineTrendCard
        title="Nitrite NO₂ (mg/L)"
        data={points}
        dataKey="nitriteMgL"
        unit="mg/L"
        stroke="#d97706"
        refLines={[
          { y: thresholds.nitriteMax, label: `Max ${thresholds.nitriteMax}`, color: "#d97706" },
        ]}
      />

      <SingleLineTrendCard
        title="Nitrate NO₃ (mg/L)"
        data={points}
        dataKey="nitrateMgL"
        unit="mg/L"
        stroke="#4f46e5"
        refLines={[
          { y: thresholds.nitrateMax, label: `Max ${thresholds.nitrateMax}`, color: "#4f46e5" },
        ]}
      />
    </div>
  );
}

export function MonthlyChemicalsChart({
  data,
}: {
  data: MonthlyChemicalChartPoint[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-slate-900">
          Monthly Chemical Usage (kg &amp; ₹)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {data.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-500">
            No mineral additions logged yet.
          </p>
        ) : (
          <ChartBox height={230}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "#475569" }} />
                <YAxis
                  yAxisId="kg"
                  tick={{ fontSize: 11, fill: "#0f766e" }}
                  width={54}
                  tickFormatter={(v: number) => `${v} kg`}
                />
                <YAxis
                  yAxisId="cost"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#0369a1" }}
                  width={56}
                  tickFormatter={(v: number) => `₹${Math.round(v)}`}
                />
                <Tooltip
                  formatter={(value, name) => [
                    name === "Cost (₹)"
                      ? formatINR(Number(value ?? 0))
                      : `${formatNumberIN(Number(value ?? 0), 2)} kg`,
                    String(name),
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  yAxisId="kg"
                  dataKey="kg"
                  name="Weight (kg)"
                  fill="#0f766e"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="cost"
                  dataKey="cost"
                  name="Cost (₹)"
                  fill="#0284c7"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        )}
      </CardContent>
    </Card>
  );
}

