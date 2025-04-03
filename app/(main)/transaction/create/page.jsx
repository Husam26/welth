import { getUserAccounts } from "@/actions/dashboard";
import { defaultCategories } from "@/data/categories";
import React from "react";
import AddTransactionForm from "./_components/transaction-form";
import { getTransaction } from "@/actions/transaction";

const AddTransactionPage = async ({searchParams}) => {
  const accounts = await getUserAccounts();


  const params = await searchParams; 
  console.log(params)
  const editId = params?.edit;

  let initialData = null;
  if (editId) {
    const transaction = await getTransaction(editId);
    initialData = transaction;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-6">
      {/* Gradient Heading */}
      <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-6">
        {editId ? "Edit" : "Add"} Transaction
      </h1>

      {/* Form Container */}
      <div className="w-full max-w-4xl bg-white shadow-md rounded-lg p-6">
      <AddTransactionForm
        accounts={accounts}
        categories={defaultCategories}
        editMode={!!editId}
        initialData={initialData}
      />
      </div>
    </div>
  );
};

export default AddTransactionPage;
