import { getAccountWithTransaction } from "@/actions/accounts";
import { notFound } from "next/navigation";
import React, { Suspense } from "react";
import TransactionTable from "../_components/transaction-table";
import { BarLoader } from "react-spinners";
import AccountChart from "../_components/account-chart";
import PageHeader from "@/components/page-header";
import { formatCurrency } from "@/lib/currency";

export const metadata = {
  title: "Account Details",
  description: "View account balance, transaction history and spending charts.",
};

const Loader = () => (
  <div className="flex justify-center py-6">
    <BarLoader width="60%" color="#4f46e5" />
  </div>
);

const AccountDetails = async ({ params }) => {
  if (!params?.id) return <Loader />;

  const accountData = await getAccountWithTransaction(params.id);
  if (!accountData) notFound();

  const { transactions, balance, ...account } = accountData;
  const typeLabel = account.type.charAt(0).toUpperCase() + account.type.slice(1).toLowerCase();

  return (
    <div>
      <PageHeader
        title={account.name}
        subtitle={`${typeLabel} account · ${account._count?.transactions || 0} transactions`}
        actions={
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Balance</p>
            <p className="text-2xl font-semibold tracking-tight nums">
              {formatCurrency(parseFloat(balance))}
            </p>
          </div>
        }
      />

      <div className="space-y-6">
        <Suspense fallback={<Loader />}>
          <AccountChart transactions={transactions} />
        </Suspense>
        <Suspense fallback={<Loader />}>
          <TransactionTable transactions={transactions} />
        </Suspense>
      </div>
    </div>
  );
};

export default function Accountspage(props) {
  return (
    <Suspense fallback={<Loader />}>
      <AccountDetails {...props} />
    </Suspense>
  );
}
