import { getAccountWithTransaction } from "@/actions/accounts";
import { notFound } from "next/navigation";
import React, { Suspense } from "react";
import TransactionTable from "../_components/transaction-table";
import { BarLoader } from "react-spinners";
import AccountChart from "../_components/account-chart";

const AccountDetails = async ({ params }) => {
  if (!params?.id) {
    return <p>Loading...</p>; // Handle undefined params case
  }

  const accountData = await getAccountWithTransaction(params.id);

  if (!accountData) {
    notFound();
  }

  const { transactions, balance, ...account } = accountData;

  return (
    <div className="bg-gray-100 min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      {/* Account Info Section */}
      <div className="bg-white p-6 rounded-xl shadow-md mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 sm:space-x-6">
          <div className="space-y-2 text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-800">
              {account.name}
            </h1>
            <p className="text-sm text-gray-600">
              {account.type.charAt(0).toUpperCase() +
                account.type.slice(1).toLowerCase()}{" "}
              Account
            </p>
          </div>
          <div className="text-center sm:text-right space-y-2">
            <div className="text-2xl sm:text-3xl font-bold text-green-600">
            ₹{parseFloat(balance).toFixed(2)}
            </div>
            <p className="text-sm text-gray-600">
              {account._count?.transactions || 0} Transactions
            </p>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <Suspense
        fallback={
          <div className="flex justify-center items-center mt-4">
            <BarLoader width="50%" color="#9333ea" />
          </div>
        }
      >
        <AccountChart transactions={transactions} />
      </Suspense>

      {/* Transaction Table */}
      <Suspense
        fallback={
          <div className="flex justify-center items-center mt-4">
            <BarLoader width="50%" color="#9333ea" />
          </div>
        }
      >
        <TransactionTable transactions={transactions} />
      </Suspense>
    </div>
  );
};

// Wrap in Suspense for smooth loading experience
export default function Accountspage(props) {
  return (
    <Suspense fallback={<p>Loading account details...</p>}>
      <AccountDetails {...props} />
    </Suspense>
  );
}
