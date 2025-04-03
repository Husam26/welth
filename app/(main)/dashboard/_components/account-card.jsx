'use client';

import { updateDefaultAccount, deleteAccount, updateAccountBalance } from "@/actions/accounts";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import useFetch from "@/hooks/use-fetch";
import { ArrowDownRight, ArrowUpRight, Trash2, Edit } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

const AccountCard = ({ account }) => {
  const { name, type, balance, id, isDefault } = account;
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newBalance, setNewBalance] = useState(balance);

  const {
    loading: updateDefaultLoading,
    fn: updateDefaultFn,
    data: updatedAccount,
    error,
  } = useFetch(updateDefaultAccount);

  const { fn: updateBalanceFn, loading: updateBalanceLoading } = useFetch(updateAccountBalance);

  const handleDefaultChange = async (event) => {
    event.preventDefault();

    if (isDefault) {
      toast.warning("You need at least one default account");
      return;
    }

    await updateDefaultFn(id);
  };

  useEffect(() => {
    if (updatedAccount?.success) {
      toast.success("Default Account Updated Successfully");
    }
  }, [updatedAccount, updateDefaultLoading]);

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to Update Default account");
    }
  }, [updatedAccount, updateDefaultLoading]);

  const handleDelete = async (event) => {
    event.stopPropagation(); // Prevents navigation
    event.preventDefault(); // Prevents any default behavior

    if (!confirm("Are you sure you want to delete this account? This action cannot be undone.")) return;

    setIsDeleting(true);
    const response = await deleteAccount(id);
    setIsDeleting(false);

    if (response.success) {
      toast.success("Account deleted successfully");
      window.location.reload(); // Refresh the page
    } else {
      toast.error(response.error || "Failed to delete account");
    }
  };

  const handleEditBalance = async (event) => {
    event.preventDefault();
  
    if (isNaN(newBalance) || newBalance <= 0) {
      toast.error("Please enter a valid balance.");
      return;
    }
  
    console.log("🚀 Calling updateBalanceFn with:", { id, newBalance });
    console.log("🔍 updateBalanceFn:", updateBalanceFn);
  
    if (typeof updateBalanceFn !== "function") {
      console.error("❌ updateBalanceFn is not a function!");
      return;
    }
  
    const response = await updateBalanceFn(id, newBalance);
    console.log("✅ API Response in AccountCard:", response);
  
    if (response?.success) {
      toast.success("Balance updated successfully");
      setIsEditing(false);
      setNewBalance(parseFloat(response.data.balance).toFixed(2));
    } else {
      console.error("❌ Failed to update balance:", response);
      toast.error(response?.error || "Failed to update balance.");
    }
  };
  
  
  
  return (
    <Card className="transition-transform transform hover:scale-105 shadow-lg rounded-lg border border-gray-200 hover:bg-gray-50 relative">
      <CardHeader className="flex justify-between items-center">
        <div>
          <CardTitle className="text-xl font-semibold text-gray-800">{name}</CardTitle>
          {isDefault && (
            <span className="bg-gray-600 text-white text-xs font-bold px-2 py-1 rounded-full">
              Default
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            checked={isDefault}
            onClick={handleDefaultChange}
            disabled={updateDefaultLoading}
          />
          {updateDefaultLoading && (
            <span className="text-xs text-gray-500">Updating...</span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="flex justify-between items-center relative">
          {!isEditing ? (
            <div className="text-3xl font-bold text-gray-900">
              ₹{parseFloat(balance).toFixed(2)}
            </div>
          ) : (
            <div className="absolute left-0 top-full mt-2 bg-white shadow-md p-4 rounded-md w-full max-w-xs border border-gray-300">
              <input
                type="number"
                className="border p-2 rounded-md w-full"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                autoFocus
              />
              <button
                className="mt-2 bg-blue-500 text-white p-2 rounded-md"
                onClick={handleEditBalance}
                disabled={updateBalanceLoading}
              >
                {updateBalanceLoading ? "Updating..." : "Save"}
              </button>
            </div>
          )}
          
          <button
            className="ml-2 text-gray-500 hover:text-gray-700"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-gray-500">
          {type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()} Account
        </p>
      </CardContent>

      <CardFooter className="flex justify-between items-center">
        <div className="flex items-center text-green-400 space-x-1">
          <ArrowUpRight className="h-5 w-5" />
          <span>Income</span>
        </div>
        <div className="flex items-center text-red-400 space-x-1">
          <ArrowDownRight className="h-5 w-5" />
          <span>Expense</span>
        </div>

        {/* New View Account Details Button */}
        <Link href={`/account/${id}`} className="text-blue-500 hover:text-blue-700 transition">
          <button className="text-sm px-3 py-1 rounded-md bg-blue-100 hover:bg-blue-200">
            View Account Details
          </button>
        </Link>

        {/* Delete Button */}
        <div onClick={handleDelete} className="cursor-pointer">
          <button
            className="text-red-500 hover:text-red-700 transition"
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : <Trash2 className="h-5 w-5" />}
          </button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default AccountCard;
