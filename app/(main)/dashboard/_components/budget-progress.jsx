"use client";
import { updateBudget } from "@/actions/budget";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import useFetch from "@/hooks/use-fetch";
import { formatCurrency } from "@/lib/currency";
import { Check, Pencil, X, Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

const BudgetProgress = ({ initialBudget, currentExpenses }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newBudget, setNewBudget] = useState(initialBudget?.amount?.toString() || "");

  const {
    loading: isLoading,
    fn: updateBudgetFn,
    data: updatedBudget,
    error,
  } = useFetch(updateBudget);

  const percentUsed = initialBudget
    ? Math.min((currentExpenses / initialBudget.amount) * 100, 100)
    : 0;

  const barColor =
    percentUsed > 90 ? "bg-negative" : percentUsed > 75 ? "bg-warning" : "bg-primary";

  const handleUpdateBudget = async () => {
    const amount = parseFloat(newBudget);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    await updateBudgetFn(amount);
  };

  useEffect(() => {
    if (updatedBudget?.success) {
      setIsEditing(false);
      toast.success("Budget updated");
    }
  }, [updatedBudget]);

  useEffect(() => {
    if (error) toast.error(error?.message || "Budget update failed");
  }, [error]);

  const remaining = initialBudget ? initialBudget.amount - currentExpenses : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">Monthly Budget</CardTitle>
          <CardDescription>
            {initialBudget
              ? `${formatCurrency(currentExpenses)} of ${formatCurrency(initialBudget.amount)} spent`
              : "No budget set for the default account"}
          </CardDescription>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={newBudget}
              className="h-9 w-28"
              onChange={(e) => setNewBudget(e.target.value)}
              placeholder="Amount"
              disabled={isLoading}
              autoFocus
            />
            <Button size="icon" className="size-9" onClick={handleUpdateBudget} disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            </Button>
            <Button size="icon" variant="outline" className="size-9" onClick={() => setIsEditing(false)} disabled={isLoading}>
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setIsEditing(true)}>
            <Pencil className="size-4" />
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Budget</p>
            <p className="mt-1 font-medium nums">{formatCurrency(initialBudget?.amount || 0)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Spent</p>
            <p className="mt-1 font-medium text-negative nums">{formatCurrency(currentExpenses)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Remaining</p>
            <p className={`mt-1 font-medium nums ${remaining < 0 ? "text-negative" : "text-positive"}`}>
              {formatCurrency(remaining)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BudgetProgress;
