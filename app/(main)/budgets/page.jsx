import React from "react";
import { getBudgetOverview, getCategoryBudgets } from "@/actions/category-budget";
import CategoryBudgetManager from "./_components/category-budget-manager";
import PageHeader from "@/components/page-header";

export const metadata = {
  title: "Budgets",
  description: "Set and track per-category monthly budgets with smart suggestions.",
};

export default async function BudgetsPage() {
  const [overview, budgets] = await Promise.all([
    getBudgetOverview(),
    getCategoryBudgets(),
  ]);

  return (
    <div>
      <PageHeader
        title="Category Budgets"
        subtitle="Set a monthly budget per category and track progress in real time."
      />
      <CategoryBudgetManager initialOverview={overview} initialBudgets={budgets} />
    </div>
  );
}
