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
import { Check, Pencil, X, Loader } from "lucide-react"; // Import Loader for spinner
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
  ? Math.min((currentExpenses / initialBudget.amount) * 100, 100) // ✅ Cap at 100%
  : 0;


  // Determine progress bar color
  const progressBarColor =
    percentUsed > 90
      ? "bg-red-500" // Above 90% → Red
      : percentUsed > 75
      ? "bg-yellow-500" // Above 75% → Yellow
      : "bg-indigo-500"; // Below 75% → Blue (default)

  const handleUpdateBudget = async () => {
    const amount = parseFloat(newBudget);

    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    // Trigger the update function
    await updateBudgetFn(amount);
  };

  useEffect(() => {
    if (updatedBudget && updatedBudget.success) {
      setIsEditing(false);
      toast.success("Budget Updated Successfully");
    }
  }, [updatedBudget]);

  useEffect(() => {
    if (error) {
      toast.error(error?.message || "Budget Update failed");
    }
  }, [error]);

  const handleCancel = () => {
    setNewBudget(initialBudget?.amount?.toString() || "");
    setIsEditing(false);
  };

  return (
    <Card className="bg-white shadow-xl rounded-lg border border-gray-200">
      <CardHeader className="flex justify-between items-center">
        <div>
          <CardTitle className="text-xl font-semibold text-gray-800">
            Monthly Budget (Default Account)
          </CardTitle>
          <CardDescription className="text-sm text-gray-600 mt-2">
            {initialBudget
              ? `${currentExpenses.toFixed(2)} of ${initialBudget.amount.toFixed(2)} spent`
              : "No Budget Set"}
          </CardDescription>
        </div>

        <div className="flex items-center space-x-2">
          {isEditing ? (
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                value={newBudget}
                className="w-24 text-lg py-2 px-4 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onChange={(e) => setNewBudget(e.target.value)}
                placeholder="Enter Amount"
                disabled={isLoading}
              />
              {isLoading ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-2 rounded-full hover:bg-gray-50"
                  disabled={true}
                >
                  <Loader className="h-4 w-4 text-gray-500 animate-spin" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleUpdateBudget}
                  className="p-2 rounded-full hover:bg-green-50"
                  disabled={isLoading}
                >
                  <Check className="h-4 w-4 text-green-500" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCancel}
                className="p-2 rounded-full hover:bg-red-50"
                disabled={isLoading}
              >
                <X className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditing(true)}
              className="h-6 w-6 text-gray-500 hover:bg-gray-100 rounded-full"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col items-center justify-center py-6">
        {/* Progress Bar with Dynamic Color */}
        <div className="w-full h-2 bg-gray-200 rounded-full mb-4">
          <div
            style={{ width: `${percentUsed}%` }}
            className={`h-full ${progressBarColor} rounded-full transition-all duration-300`}
          ></div>
        </div>

        {/* Percentage Text */}
        <div className="text-lg font-medium text-gray-800">
          <span className="text-gray-600">{percentUsed.toFixed(2)}% Used</span>
        </div>

        <div className="flex items-center justify-between w-full text-lg font-medium text-gray-800 mt-2">
          <span className="text-green-500">Total Budget</span>
          <span className="text-gray-600">
          ₹{initialBudget ? initialBudget.amount.toFixed(2) : "0.00"}
          </span>
        </div>
        <div className="flex items-center justify-between w-full text-lg font-medium text-gray-800 mt-2">
          <span className="text-red-500">Spent</span>
          <span className="text-gray-600">₹{currentExpenses.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between w-full text-lg font-medium text-gray-800 mt-2">
          <span className="text-indigo-500">Remaining</span>
          <span className="text-gray-600">
          ₹{initialBudget ? (initialBudget.amount - currentExpenses).toFixed(2) : "0.00"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default BudgetProgress;
