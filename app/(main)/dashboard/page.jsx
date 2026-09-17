import { getDashboardData, getUserAccounts } from "@/actions/dashboard";
import CreateAccountDrawer from "@/components/create-account-drawer";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Wallet, ArrowUpRight, ArrowDownRight, Scale } from "lucide-react";
import React, { Suspense } from "react";
import AccountCard from "./_components/account-card";
import { getCurrentBudget } from "@/actions/budget";
import BudgetProgress from "./_components/budget-progress";
import { DashboardOverview } from "./_components/transaction-overview";
import PageHeader from "@/components/page-header";
import StatCard from "@/components/stat-card";
import { formatCurrency } from "@/lib/currency";

export const metadata = {
  title: "Dashboard",
  description: "Your financial overview — budgets, accounts and recent activity.",
};

function isThisMonth(date) {
  const d = new Date(date);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

async function DashboardPage() {
  const accounts = await getUserAccounts();
  const defaultAccount = accounts.find((account) => account.isDefault);

  let budgetData = null;
  if (defaultAccount) {
    budgetData = await getCurrentBudget(defaultAccount.id);
  }

  const transactions = await getDashboardData();

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance || 0), 0);
  const monthTx = (transactions || []).filter((t) => isThisMonth(t.date));
  const income = monthTx.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const net = income - expense;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Your financial overview at a glance."
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Balance" value={formatCurrency(totalBalance)} icon={Wallet} tone="primary" />
        <StatCard label="Income (this month)" value={formatCurrency(income)} icon={ArrowUpRight} tone="positive" />
        <StatCard label="Expenses (this month)" value={formatCurrency(expense)} icon={ArrowDownRight} tone="negative" />
        <StatCard label="Net (this month)" value={formatCurrency(net)} icon={Scale} tone={net >= 0 ? "positive" : "negative"} />
      </div>

      {/* Budget */}
      {defaultAccount && (
        <div className="mt-6">
          <BudgetProgress
            initialBudget={budgetData?.budget}
            currentExpenses={budgetData?.currentExpenses || 0}
          />
        </div>
      )}

      {/* Overview */}
      <div className="mt-6">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading overview…</p>}>
          <DashboardOverview accounts={accounts} transactions={transactions || []} />
        </Suspense>
      </div>

      {/* Accounts */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Accounts
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <CreateAccountDrawer>
            <Card className="cursor-pointer border-dashed transition-colors hover:border-primary/40 hover:bg-accent">
              <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                <Plus className="size-6" />
                <p className="text-sm font-medium">Add New Account</p>
              </CardContent>
            </Card>
          </CreateAccountDrawer>

          {accounts.length > 0 &&
            accounts.map((account) => <AccountCard key={account.id} account={account} />)}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
