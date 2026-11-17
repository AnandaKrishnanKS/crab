"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartBox } from "@/components/chart-box";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface WeightChartPoint {
  dateLabel: string;
  weightG: number;
  source: string;
}

export interface DailyFeedChartPoint {
  dateLabel: string;
  grams: number;
}

export function CrabCharts({
  weightPoints,
  dailyFeedPoints,
}: {
  weightPoints: WeightChartPoint[];
  dailyFeedPoints: DailyFeedChartPoint[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Weight Growth (g)</CardTitle>
        </CardHeader>
        <CardContent>
          {weightPoints.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No weight measurements yet.
            </p>
          ) : (
            <ChartBox height={230}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={weightPoints}
                  margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: "#475569" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#475569" }}
                    width={45}
                    unit="g"
                  />
                  <Tooltip
                    formatter={(val) => [`${val ?? 0} g`, "Weight"]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="weightG"
                    stroke="#0f766e"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#0f766e" }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartBox>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feed Intake per Day (g)</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyFeedPoints.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No feeding logs yet.
            </p>
          ) : (
            <ChartBox height={230}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dailyFeedPoints}
                  margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: "#475569" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#475569" }}
                    width={45}
                    unit="g"
                  />
                  <Tooltip
                    formatter={(val) => [`${val ?? 0} g`, "Feed"]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Bar
                    dataKey="grams"
                    fill="#0d9488"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

