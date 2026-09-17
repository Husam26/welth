"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  runAnomalyScan,
  runForecast,
  markAnomalyRead,
  markAllAnomaliesRead,
} from "@/actions/insights";
import { formatCurrency } from "@/lib/currency";
import { defaultCategories } from "@/data/categories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Sparkles,
  Check,
  Copy,
  Store,
  Activity,
  PiggyBank,
  Loader2,
} from "lucide-react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const CATEGORY_NAME = Object.fromEntries(
  defaultCategories.map((c) => [c.id, c.name])
);

const SEVERITY_STYLES = {
  HIGH: { border: "border-l-negative", badge: "bg-negative/10 text-negative", label: "High" },
  MEDIUM: { border: "border-l-warning", badge: "bg-warning/15 text-warning-foreground", label: "Medium" },
  LOW: { border: "border-l-border", badge: "bg-muted text-muted-foreground", label: "Low" },
};

const TYPE_ICON = {
  AMOUNT_SPIKE: AlertTriangle,
  CATEGORY_SURGE: Activity,
  NEW_MERCHANT: Store,
  FREQUENCY_SPIKE: Activity,
  BUDGET_OVERRUN: PiggyBank,
  DUPLICATE_CHARGE: Copy,
};

export default function InsightsView({ initialAnomalies, forecast }) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [forecasting, setForecasting] = useState(false);

  const unread = initialAnomalies.filter((a) => !a.isRead);

  const handleScan = async () => {
    setScanning(true);
    const res = await runAnomalyScan();
    setScanning(false);
    if (res.success) {
      toast.success(
        res.created > 0
          ? `Scan complete — ${res.created} new ${res.created === 1 ? "anomaly" : "anomalies"} found`
          : "Scan complete — nothing unusual found"
      );
      router.refresh();
    } else {
      toast.error(res.error || "Scan failed");
    }
  };

  const handleForecast = async () => {
    setForecasting(true);
    const res = await runForecast();
    setForecasting(false);
    if (res.success) {
      toast.success("Forecast updated");
      router.refresh();
    } else {
      toast.error(res.error || "Forecast failed");
    }
  };

  const handleMarkRead = async (id) => {
    const res = await markAnomalyRead(id);
    if (res.success) router.refresh();
    else toast.error(res.error || "Failed");
  };

  const handleMarkAllRead = async () => {
    const res = await markAllAnomaliesRead();
    if (res.success) {
      toast.success("All marked as read");
      router.refresh();
    } else {
      toast.error(res.error || "Failed");
    }
  };

  // Combined chart data: 6 months of actuals + the next-month forecast band
  const chartData = forecast.history.map((h) => ({
    month: h.month,
    actual: h.actual,
    predicted: null,
    range: null,
  }));
  if (forecast.overall) {
    // Bridge the solid/dashed lines by seeding predicted on the last actual point
    if (chartData.length > 0) {
      chartData[chartData.length - 1].predicted = chartData[chartData.length - 1].actual;
    }
    chartData.push({
      month: forecast.nextMonthLabel.slice(0, 3),
      actual: null,
      predicted: Number(forecast.overall.predicted.toFixed(2)),
      range: [
        Number(forecast.overall.lower.toFixed(2)),
        Number(forecast.overall.upper.toFixed(2)),
      ],
    });
  }

  return (
    <div className="space-y-6">
      {/* Forecast */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Expense Forecast — {forecast.nextMonthLabel}
            </CardTitle>
            {forecast.overall && (
              <p className="text-sm text-muted-foreground mt-1">
                Projected spend:{" "}
                <strong>{formatCurrency(forecast.overall.predicted)}</strong>{" "}
                <span className="text-muted-foreground">
                  ({formatCurrency(forecast.overall.lower)} –{" "}
                  {formatCurrency(forecast.overall.upper)}, {forecast.overall.method})
                </span>
              </p>
            )}
          </div>
          <Button variant="outline" onClick={handleForecast} disabled={forecasting}>
            {forecasting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Update forecast
          </Button>
        </CardHeader>
        <CardContent>
          {forecast.overall ? (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <Tooltip formatter={(value) => (value == null ? "-" : formatCurrency(value))} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="range"
                    name="Forecast range"
                    stroke="none"
                    fill="var(--chart-1)"
                    fillOpacity={0.15}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Actual"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    connectNulls
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    name="Forecast"
                    stroke="var(--chart-3)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    connectNulls
                    dot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <p>No forecast yet.</p>
              <p className="text-sm mt-1">
                Click <strong>Update forecast</strong> to generate one from your history
                (needs a few months of transactions).
              </p>
            </div>
          )}

          {forecast.byCategory?.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">By category:</p>
              <div className="flex flex-wrap gap-2">
                {forecast.byCategory.slice(0, 8).map((c) => (
                  <span
                    key={c.category}
                    className="rounded-lg border border-border bg-muted px-3 py-1.5 text-sm"
                  >
                    {CATEGORY_NAME[c.category] || c.category}:{" "}
                    <strong>{formatCurrency(c.predicted)}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Anomaly feed */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Spending Anomalies
            {unread.length > 0 && (
              <span className="ml-1 rounded-full bg-negative/10 px-2 py-0.5 text-xs text-negative">
                {unread.length} new
              </span>
            )}
          </CardTitle>
          <div className="flex gap-2">
            {unread.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                Mark all read
              </Button>
            )}
            <Button onClick={handleScan} disabled={scanning}>
              {scanning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Scan now
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {initialAnomalies.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p>No anomalies detected. 🎉</p>
              <p className="text-sm mt-1">
                Click <strong>Scan now</strong> to analyze your recent spending.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {initialAnomalies.map((a) => {
                const s = SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.LOW;
                const Icon = TYPE_ICON[a.type] || AlertTriangle;
                return (
                  <div
                    key={a.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border-l-4 ${s.border} bg-card border border-border ${
                      a.isRead ? "opacity-60" : ""
                    }`}
                  >
                    <Icon className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${s.badge}`}>
                          {s.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {a.type.replace(/_/g, " ").toLowerCase()}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-1">{a.message}</p>
                    </div>
                    {!a.isRead && (
                      <button
                        onClick={() => handleMarkRead(a.id)}
                        className="shrink-0 text-muted-foreground hover:text-positive"
                        aria-label="Mark as read"
                        title="Mark as read"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
