"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  createSimulation,
  getSimulation,
  listSimulations,
  deleteSimulation,
} from "@/actions/simulation";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Loader2, Play, Trash2, Shield, TrendingDown, Wallet } from "lucide-react";

const HORIZONS = [6, 12, 24, 36];
const ITERATIONS = [500, 1000, 2000, 5000];

const emptyShocks = {
  JOB_LOSS: { enabled: false, startMonth: 2, durationMonths: 3 },
  INCOME_CHANGE: { enabled: false, startMonth: 1, pct: 10 },
  EXPENSE_INFLATION: { enabled: false, pct: 8 },
  NEW_LOAN: { enabled: false, startMonth: 1, months: 24, emi: 10000 },
  BIG_PURCHASE: { enabled: false, month: 3, amount: 50000 },
};

export default function SimulationLab({ initialSimulations }) {
  const [simulations, setSimulations] = useState(initialSimulations);
  const [name, setName] = useState("My scenario");
  const [horizon, setHorizon] = useState("12");
  const [iterations, setIterations] = useState("1000");
  const [shocks, setShocks] = useState(emptyShocks);

  const [activeSim, setActiveSim] = useState(null);
  const [running, setRunning] = useState(false);
  const pollRef = useRef(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const loadSim = useCallback(async (id) => {
    const sim = await getSimulation(id);
    if (!sim) return;
    setActiveSim(sim);
    if (sim.status === "COMPLETED" || sim.status === "FAILED") {
      setRunning(false);
      stopPolling();
      if (sim.status === "FAILED") toast.error(sim.error || "Simulation failed");
    }
  }, []);

  // Load the most recent simulation on mount (and resume polling if needed)
  useEffect(() => {
    if (initialSimulations.length > 0) {
      loadSim(initialSimulations[0].id);
      if (["PENDING", "RUNNING"].includes(initialSimulations[0].status)) {
        setRunning(true);
      }
    }
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll while a simulation is running
  useEffect(() => {
    if (!running || !activeSim) return;
    stopPolling();
    pollRef.current = setInterval(() => loadSim(activeSim.id), 2000);
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, activeSim?.id]);

  const buildShocks = () => {
    const out = [];
    const s = shocks;
    if (s.JOB_LOSS.enabled)
      out.push({ type: "JOB_LOSS", startMonth: +s.JOB_LOSS.startMonth, durationMonths: +s.JOB_LOSS.durationMonths });
    if (s.INCOME_CHANGE.enabled)
      out.push({ type: "INCOME_CHANGE", startMonth: +s.INCOME_CHANGE.startMonth, pct: +s.INCOME_CHANGE.pct });
    if (s.EXPENSE_INFLATION.enabled)
      out.push({ type: "EXPENSE_INFLATION", pct: +s.EXPENSE_INFLATION.pct });
    if (s.NEW_LOAN.enabled)
      out.push({ type: "NEW_LOAN", startMonth: +s.NEW_LOAN.startMonth, months: +s.NEW_LOAN.months, emi: +s.NEW_LOAN.emi });
    if (s.BIG_PURCHASE.enabled)
      out.push({ type: "BIG_PURCHASE", month: +s.BIG_PURCHASE.month, amount: +s.BIG_PURCHASE.amount });
    return out;
  };

  const handleRun = async () => {
    setRunning(true);
    const res = await createSimulation({
      name,
      horizonMonths: +horizon,
      iterations: +iterations,
      shocks: buildShocks(),
    });
    if (!res.success) {
      setRunning(false);
      toast.error(res.error || "Failed to start simulation");
      return;
    }
    toast.success("Simulation started — crunching thousands of futures…");
    setSimulations(await listSimulations());
    await loadSim(res.id);
  };

  const handleDelete = async (id) => {
    const res = await deleteSimulation(id);
    if (res.success) {
      setSimulations(await listSimulations());
      if (activeSim?.id === id) setActiveSim(null);
    } else {
      toast.error(res.error || "Failed to delete");
    }
  };

  const setShock = (key, field, value) =>
    setShocks((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const results = activeSim?.results;
  const chartData =
    results?.trajectories?.map((t) => ({
      month: `M${t.month}`,
      p50: t.p50,
      band: [t.p10, t.p90],
    })) || [];

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* ── Scenario builder ── */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Scenario Builder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Scenario name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Horizon</label>
              <Select value={horizon} onValueChange={setHorizon}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HORIZONS.map((h) => (
                    <SelectItem key={h} value={String(h)}>{h} months</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Iterations</label>
              <Select value={iterations} onValueChange={setIterations}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ITERATIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>{n.toLocaleString()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <p className="text-sm font-medium text-muted-foreground">Stress-test shocks</p>

            <ShockRow
              label="Job loss"
              enabled={shocks.JOB_LOSS.enabled}
              onToggle={(v) => setShock("JOB_LOSS", "enabled", v)}
            >
              <NumField label="From month" value={shocks.JOB_LOSS.startMonth} onChange={(v) => setShock("JOB_LOSS", "startMonth", v)} />
              <NumField label="For (months)" value={shocks.JOB_LOSS.durationMonths} onChange={(v) => setShock("JOB_LOSS", "durationMonths", v)} />
            </ShockRow>

            <ShockRow
              label="Income change (%)"
              enabled={shocks.INCOME_CHANGE.enabled}
              onToggle={(v) => setShock("INCOME_CHANGE", "enabled", v)}
            >
              <NumField label="From month" value={shocks.INCOME_CHANGE.startMonth} onChange={(v) => setShock("INCOME_CHANGE", "startMonth", v)} />
              <NumField label="Change %" value={shocks.INCOME_CHANGE.pct} onChange={(v) => setShock("INCOME_CHANGE", "pct", v)} />
            </ShockRow>

            <ShockRow
              label="Expense inflation (%)"
              enabled={shocks.EXPENSE_INFLATION.enabled}
              onToggle={(v) => setShock("EXPENSE_INFLATION", "enabled", v)}
            >
              <NumField label="Inflation %" value={shocks.EXPENSE_INFLATION.pct} onChange={(v) => setShock("EXPENSE_INFLATION", "pct", v)} />
            </ShockRow>

            <ShockRow
              label="New loan (EMI)"
              enabled={shocks.NEW_LOAN.enabled}
              onToggle={(v) => setShock("NEW_LOAN", "enabled", v)}
            >
              <NumField label="From month" value={shocks.NEW_LOAN.startMonth} onChange={(v) => setShock("NEW_LOAN", "startMonth", v)} />
              <NumField label="Months" value={shocks.NEW_LOAN.months} onChange={(v) => setShock("NEW_LOAN", "months", v)} />
              <NumField label="EMI (₹)" value={shocks.NEW_LOAN.emi} onChange={(v) => setShock("NEW_LOAN", "emi", v)} />
            </ShockRow>

            <ShockRow
              label="Big purchase"
              enabled={shocks.BIG_PURCHASE.enabled}
              onToggle={(v) => setShock("BIG_PURCHASE", "enabled", v)}
            >
              <NumField label="Month" value={shocks.BIG_PURCHASE.month} onChange={(v) => setShock("BIG_PURCHASE", "month", v)} />
              <NumField label="Amount (₹)" value={shocks.BIG_PURCHASE.amount} onChange={(v) => setShock("BIG_PURCHASE", "amount", v)} />
            </ShockRow>
          </div>

          <Button
            onClick={handleRun}
            disabled={running}
            className="w-full"
          >
            {running ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Simulating…</>
            ) : (
              <><Play className="h-4 w-4 mr-2" /> Run Simulation</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ── Results ── */}
      <div className="space-y-6">
        {!activeSim && (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              Build a scenario and hit <strong>Run Simulation</strong> to see thousands of
              projected futures.
            </CardContent>
          </Card>
        )}

        {activeSim && (running || activeSim.status === "PENDING" || activeSim.status === "RUNNING") && !results && (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-3" />
              Running <strong>{activeSim.iterations?.toLocaleString()}</strong> Monte Carlo
              trajectories across parallel workers…
            </CardContent>
          </Card>
        )}

        {results && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiTile
                icon={Shield}
                label="Chance you stay solvent"
                value={`${((1 - results.probInsolvency) * 100).toFixed(0)}%`}
                tone={results.probInsolvency > 0.3 ? "bad" : results.probInsolvency > 0.1 ? "warn" : "good"}
              />
              <KpiTile
                icon={Wallet}
                label={`Median balance @ M${results.horizonMonths}`}
                value={formatCurrency(results.medianEndBalance)}
                tone={results.medianEndBalance < 0 ? "bad" : "good"}
              />
              <KpiTile
                icon={TrendingDown}
                label="Worst case (5th pct)"
                value={formatCurrency(results.worstCaseEndBalance)}
                tone={results.worstCaseEndBalance < 0 ? "bad" : "warn"}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-foreground">
                  Projected Balance — {activeSim.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Median (line) with 10th–90th percentile range (band), from{" "}
                  {results.iterations.toLocaleString()} simulations.
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                      <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} width={70} />
                      <Tooltip
                        formatter={(value) =>
                          Array.isArray(value)
                            ? `${formatCurrency(value[0])} – ${formatCurrency(value[1])}`
                            : formatCurrency(value)
                        }
                      />
                      <Legend />
                      <ReferenceLine y={0} stroke="var(--negative)" strokeDasharray="4 4" label="Insolvent" />
                      <Area
                        type="monotone"
                        dataKey="band"
                        name="10th–90th percentile"
                        stroke="none"
                        fill="var(--chart-1)"
                        fillOpacity={0.15}
                      />
                      <Line
                        type="monotone"
                        dataKey="p50"
                        name="Median"
                        stroke="var(--chart-1)"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Past simulations */}
        {simulations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Past Simulations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {simulations.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent ${
                    activeSim?.id === s.id ? "border-primary/30 bg-primary/10" : "border-border"
                  }`}
                  onClick={() => {
                    loadSim(s.id);
                    if (["PENDING", "RUNNING"].includes(s.status)) setRunning(true);
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.iterations.toLocaleString()} runs · {s.horizonMonths}mo ·{" "}
                      <span
                        className={
                          s.status === "COMPLETED"
                            ? "text-positive"
                            : s.status === "FAILED"
                            ? "text-negative"
                            : "text-warning"
                        }
                      >
                        {s.status.toLowerCase()}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                    className="text-muted-foreground hover:text-negative shrink-0"
                    aria-label="Delete simulation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ShockRow({ label, enabled, onToggle, children }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      {enabled && <div className="grid grid-cols-2 gap-2 mt-3">{children}</div>}
    </div>
  );
}

function NumField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
      />
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, tone }) {
  const toneClass =
    tone === "bad" ? "text-negative" : tone === "warn" ? "text-warning" : "text-positive";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <p className={`text-2xl font-bold mt-1 ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
