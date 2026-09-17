"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  upsertCategoryBudget,
  deleteCategoryBudget,
  suggestCategoryBudgets,
} from "@/actions/category-budget";
import { defaultCategories } from "@/data/categories";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Trash2, Check, Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// id -> { name, color } lookup for expense categories
const CATEGORY_META = Object.fromEntries(
  defaultCategories
    .filter((c) => c.type === "EXPENSE")
    .map((c) => [c.id, { name: c.name, color: c.color }])
);
const EXPENSE_CATEGORIES = defaultCategories.filter((c) => c.type === "EXPENSE");

const statusColor = {
  ok: "bg-primary",
  warning: "bg-warning",
  over: "bg-negative",
  "no-budget": "bg-muted",
};

export default function CategoryBudgetManager({ initialOverview, initialBudgets }) {
  const router = useRouter();
  const [savingCategory, setSavingCategory] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // "Add budget" form state
  const [newCategory, setNewCategory] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const budgetedCategoryIds = new Set(initialBudgets.map((b) => b.category));

  const totalBudgeted = initialOverview.reduce(
    (sum, o) => sum + (o.budget || 0),
    0
  );
  const totalSpentOnBudgeted = initialOverview.reduce(
    (sum, o) => sum + (o.budget !== null ? o.spent : 0),
    0
  );

  const chartData = initialOverview
    .filter((o) => o.budget !== null)
    .map((o) => ({
      name: CATEGORY_META[o.category]?.name || o.category,
      Budget: o.budget,
      Spent: Number(o.spent.toFixed(2)),
    }));

  const handleSave = async (category, amount) => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    setSavingCategory(category);
    const res = await upsertCategoryBudget({ category, amount: parsedAmount });
    setSavingCategory(null);

    if (res.success) {
      toast.success(`Budget for ${CATEGORY_META[category]?.name || category} saved`);
      router.refresh();
    } else {
      toast.error(res.error || "Failed to save budget");
    }
  };

  const handleDelete = async (category) => {
    if (!confirm(`Remove the budget for ${CATEGORY_META[category]?.name || category}?`)) {
      return;
    }
    const res = await deleteCategoryBudget(category);
    if (res.success) {
      toast.success("Budget removed");
      router.refresh();
    } else {
      toast.error(res.error || "Failed to remove budget");
    }
  };

  const handleSuggest = async () => {
    setSuggestLoading(true);
    const res = await suggestCategoryBudgets();
    setSuggestLoading(false);
    if (res.success) {
      setSuggestions(res.data);
      if (res.data.length === 0) {
        toast.info(res.message || "Not enough history to suggest budgets yet.");
      }
    } else {
      toast.error(res.error || "Failed to generate suggestions");
    }
  };

  const handleAddNew = async () => {
    if (!newCategory) {
      toast.error("Pick a category");
      return;
    }
    await handleSave(newCategory, newAmount);
    setNewCategory("");
    setNewAmount("");
  };

  const availableCategories = EXPENSE_CATEGORIES.filter(
    (c) => !budgetedCategoryIds.has(c.id)
  );

  return (
    <div className="space-y-6">
      {/* Summary + actions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg text-foreground">This Month</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {formatCurrency(totalSpentOnBudgeted)} spent of{" "}
              {formatCurrency(totalBudgeted)} budgeted
            </p>
          </div>
          <Button onClick={handleSuggest} disabled={suggestLoading} variant="outline">
            {suggestLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Suggest Budgets
          </Button>
        </CardHeader>

        {suggestions && suggestions.length > 0 && (
          <CardContent>
            <p className="text-sm font-medium text-muted-foreground mb-3">
              Suggested monthly budgets (based on your last 3 months):
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.category}
                  onClick={() => handleSave(s.category, s.suggested)}
                  disabled={savingCategory === s.category}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm transition-colors hover:bg-accent"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: CATEGORY_META[s.category]?.color || "#94a3b8" }}
                  />
                  {CATEGORY_META[s.category]?.name || s.category}:{" "}
                  <strong>{formatCurrency(s.suggested)}</strong>
                </button>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Budgeted vs Actual chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Budgeted vs Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#4B5563", fontSize: 12 }}
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fill: "#4B5563", fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="Budget" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Spent" fill="var(--chart-6)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {initialOverview.map((o) => (
          <CategoryCard
            key={o.category}
            overview={o}
            saving={savingCategory === o.category}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Add a new budget */}
      {availableCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Add a Budget</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
            <div className="flex-1">
              <label className="block text-sm text-muted-foreground mb-1">Category</label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="block text-sm text-muted-foreground mb-1">Monthly amount (₹)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="₹0.00"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
            </div>
            <Button
              onClick={handleAddNew}
              disabled={savingCategory === newCategory}
            >
              Add Budget
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CategoryCard({ overview, saving, onSave, onDelete }) {
  const { category, budget, spent, remaining, pct, status } = overview;
  const meta = CATEGORY_META[category] || { name: category, color: "#94a3b8" };
  const [editing, setEditing] = useState(budget === null);
  const [amount, setAmount] = useState(budget !== null ? String(budget) : "");

  const width = pct !== null ? pct : 0;

  return (
    <Card className="shadow-md hover:shadow-lg transition">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: meta.color }} />
          <CardTitle className="text-base text-foreground">{meta.name}</CardTitle>
        </div>
        {budget !== null && (
          <button
            onClick={() => onDelete(category)}
            className="text-muted-foreground hover:text-negative"
            aria-label={`Delete ${meta.name} budget`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          {formatCurrency(spent)} spent
          {budget !== null && <> of {formatCurrency(budget)}</>}
        </div>

        {budget !== null && (
          <>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${statusColor[status]}`}
                style={{ width: `${width}%` }}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className={status === "over" ? "text-negative font-medium" : "text-muted-foreground"}>
                {pct !== null ? `${pct.toFixed(0)}% used` : ""}
              </span>
              <span className={remaining < 0 ? "text-negative" : "text-positive"}>
                {remaining < 0
                  ? `${formatCurrency(Math.abs(remaining))} over`
                  : `${formatCurrency(remaining)} left`}
              </span>
            </div>
          </>
        )}

        {editing ? (
          <div className="flex items-center gap-2 pt-1">
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Set amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9"
            />
            <Button
              size="icon"
              className="h-9 w-9 bg-green-500 hover:bg-green-600 shrink-0"
              disabled={saving}
              onClick={() => onSave(category, amount)}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setEditing(true)}
          >
            Edit budget
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
