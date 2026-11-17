"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Info, KeyRound, Save } from "lucide-react";
import { toast } from "sonner";
import {
  changePasswordAction,
  updateSettingsAction,
} from "@/app/actions/settings";
import { MineralsManager, type MineralRow } from "@/components/minerals-manager";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs } from "@/components/ui/tabs";

export interface SettingsData {
  systemVolumeLitres: number;
  waterChangeWarnDays: number;
  waterChangeIntervalDays: number;
  waterTestIntervalDays: number;
  salinityMin: number;
  salinityMax: number;
  phMin: number;
  phMax: number;
  ammoniaMax: number;
  nitriteMax: number;
  nitrateMax: number;
  tempMin: number;
  tempMax: number;
  targetFatteningDays: number;
  lowMineralStockKg: number;
  softCrabAlert: boolean;
}

type SettingsTab = "ras" | "minerals" | "account";

export function SettingsManager({
  initialSettings,
  minerals,
  initialTab = "ras",
  userEmail,
}: {
  initialSettings: SettingsData;
  minerals: MineralRow[];
  initialTab?: SettingsTab;
  userEmail: string;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<SettingsTab>(initialTab);
  const [form, setForm] = React.useState<SettingsData>(initialSettings);
  const [savingSettings, setSavingSettings] = React.useState(false);

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [savingPassword, setSavingPassword] = React.useState(false);

  const setNum = (key: keyof Omit<SettingsData, "softCrabAlert">, raw: string) => {
    const val = raw === "" ? 0 : Number(raw);
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    const res = await updateSettingsAction(form);
    setSavingSettings(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Settings saved");
    router.refresh();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    const res = await changePasswordAction({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    setSavingPassword(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Password updated");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600">
          Configure RAS water targets, mineral formulas, and your owner account.
        </p>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { id: "ras", label: "RAS & Thresholds" },
          { id: "minerals", label: "Minerals", count: minerals.length },
          { id: "account", label: "Account & Links" },
        ]}
      />

      {tab === "ras" && (
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-3.5 text-sm text-teal-950 flex items-start gap-2.5">
            <Info className="h-5 w-5 shrink-0 text-teal-700 mt-0.5" />
            <div>
              <p className="font-semibold">Farm-specific RAS thresholds</p>
              <p className="text-xs text-teal-900 mt-0.5">
                Starter defaults match typical Scylla serrata RAS targets. Adjust these to match your source water, salinity acclimation, and farm SOP.
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>System &amp; Schedule</CardTitle>
              <CardDescription>
                Whole-RAS volume used by the Dose Calculator and maintenance intervals.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label htmlFor="set-volume">System Volume (L)</Label>
                <Input
                  id="set-volume"
                  type="number"
                  step="any"
                  min="1"
                  value={form.systemVolumeLitres}
                  onChange={(e) => setNum("systemVolumeLitres", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="set-test-days">Water Test Every (days)</Label>
                <Input
                  id="set-test-days"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={form.waterTestIntervalDays}
                  onChange={(e) => setNum("waterTestIntervalDays", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="set-wc-warn">Water Change Warn (days)</Label>
                <Input
                  id="set-wc-warn"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={form.waterChangeWarnDays}
                  onChange={(e) => setNum("waterChangeWarnDays", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="set-wc-due">Water Change Due (days)</Label>
                <Input
                  id="set-wc-due"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={form.waterChangeIntervalDays}
                  onChange={(e) => setNum("waterChangeIntervalDays", e.target.value)}
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Water Quality Thresholds</CardTitle>
              <CardDescription>
                Alerts on Dashboard &amp; Water charts trigger outside these ranges.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="set-sal-min">Min Salinity (ppt)</Label>
                <Input
                  id="set-sal-min"
                  type="number"
                  step="any"
                  value={form.salinityMin}
                  onChange={(e) => setNum("salinityMin", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="set-sal-max">Max Salinity (ppt)</Label>
                <Input
                  id="set-sal-max"
                  type="number"
                  step="any"
                  value={form.salinityMax}
                  onChange={(e) => setNum("salinityMax", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="set-ph-min">Min pH</Label>
                <Input
                  id="set-ph-min"
                  type="number"
                  step="any"
                  value={form.phMin}
                  onChange={(e) => setNum("phMin", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="set-ph-max">Max pH</Label>
                <Input
                  id="set-ph-max"
                  type="number"
                  step="any"
                  value={form.phMax}
                  onChange={(e) => setNum("phMax", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="set-temp-min">Min Temp (°C)</Label>
                <Input
                  id="set-temp-min"
                  type="number"
                  step="any"
                  value={form.tempMin}
                  onChange={(e) => setNum("tempMin", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="set-temp-max">Max Temp (°C)</Label>
                <Input
                  id="set-temp-max"
                  type="number"
                  step="any"
                  value={form.tempMax}
                  onChange={(e) => setNum("tempMax", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="set-nh3">Max Ammonia (mg/L)</Label>
                <Input
                  id="set-nh3"
                  type="number"
                  step="any"
                  min="0"
                  value={form.ammoniaMax}
                  onChange={(e) => setNum("ammoniaMax", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="set-no2">Max Nitrite (mg/L)</Label>
                <Input
                  id="set-no2"
                  type="number"
                  step="any"
                  min="0"
                  value={form.nitriteMax}
                  onChange={(e) => setNum("nitriteMax", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="set-no3">Max Nitrate (mg/L)</Label>
                <Input
                  id="set-no3"
                  type="number"
                  step="any"
                  min="0"
                  value={form.nitrateMax}
                  onChange={(e) => setNum("nitrateMax", e.target.value)}
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fattening &amp; Alert Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="set-fat-days">Target Fattening Days</Label>
                  <Input
                    id="set-fat-days"
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={form.targetFatteningDays}
                    onChange={(e) => setNum("targetFatteningDays", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="set-low-min">Low Mineral Stock Alert (kg)</Label>
                  <Input
                    id="set-low-min"
                    type="number"
                    step="any"
                    min="0"
                    value={form.lowMineralStockKg}
                    onChange={(e) => setNum("lowMineralStockKg", e.target.value)}
                    required
                  />
                </div>
              </div>

              <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.softCrabAlert}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, softCrabAlert: e.target.checked }))
                  }
                  className="h-5 w-5 accent-teal-700"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Soft-crab / recent-molt dashboard alert
                  </div>
                  <div className="text-xs text-slate-600">
                    Show an alert banner when any active crab is in MOLTED or SOFT stage
                  </div>
                </div>
              </label>

              <div className="flex justify-end pt-1">
                <Button type="submit" disabled={savingSettings}>
                  <Save className="h-4 w-4" />
                  {savingSettings ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}

      {tab === "minerals" && (
        <MineralsManager
          minerals={minerals}
          lowMineralStockKg={form.lowMineralStockKg}
        />
      )}

      {tab === "account" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Master Lists</CardTitle>
              <CardDescription>Jump to farm reference lists.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Link
                href="/trays"
                className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              >
                Manage Trays
              </Link>
              <Link
                href="/feed-types"
                className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              >
                Feed Types
              </Link>
              <Link
                href="/contacts"
                className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              >
                Suppliers &amp; Buyers
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change Owner Password</CardTitle>
              <CardDescription>Signed in as {userEmail}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
                <div>
                  <Label htmlFor="pw-current">Current Password *</Label>
                  <Input
                    id="pw-current"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="pw-new">New Password (min 4 chars) *</Label>
                  <Input
                    id="pw-new"
                    type="password"
                    minLength={4}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="pw-confirm">Confirm New Password *</Label>
                  <Input
                    id="pw-confirm"
                    type="password"
                    minLength={4}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={savingPassword}>
                  <KeyRound className="h-4 w-4" />
                  {savingPassword ? "Updating..." : "Update Password"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Export &amp; Backup</CardTitle>
              <CardDescription>
                Download all farm records as a CSV ZIP archive (one CSV per table) or a complete
                JSON backup. Password hashes are excluded for security.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <a
                href="/api/export/csv"
                download
                className={buttonVariants({ variant: "default" })}
              >
                <Download className="h-4 w-4" />
                Download Full CSV (ZIP)
              </a>
              <a
                href="/api/export/json"
                download
                className={buttonVariants({ variant: "outline" })}
              >
                <Download className="h-4 w-4" />
                Download JSON Backup
              </a>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

