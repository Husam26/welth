import { getUserAccounts } from "@/actions/dashboard";
import { defaultCategories } from "@/data/categories";
import React from "react";
import AddTransactionForm from "./_components/transaction-form";
import { getTransaction } from "@/actions/transaction";
import PageHeader from "@/components/page-header";

export const metadata = {
  title: "Add Transaction",
  description: "Add or edit a transaction, or scan a receipt with AI.",
};

const AddTransactionPage = async ({ searchParams }) => {
  const accounts = await getUserAccounts();

  const params = await searchParams;
  const editId = params?.edit;

  let initialData = null;
  if (editId) {
    initialData = await getTransaction(editId);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`${editId ? "Edit" : "Add"} Transaction`}
        subtitle="Record income or an expense — or scan a receipt with AI."
      />
      <AddTransactionForm
        accounts={accounts}
        categories={defaultCategories}
        editMode={!!editId}
        initialData={initialData}
      />
    </div>
  );
};

export default AddTransactionPage;
