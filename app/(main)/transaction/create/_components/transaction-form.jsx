"use client";
import { createTransaction, updateTransaction } from "@/actions/transaction";
import { transactionSchema } from "@/app/lib/schema";
import CreateAccountDrawer from "@/components/create-account-drawer";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import useFetch from "@/hooks/use-fetch";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, PlusCircleIcon, WalletIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import ReceiptScanner from "./recipt-scanner";

const AddTransactionForm = ({
  accounts,
  categories,
  editMode = false,
  initialData = null,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors },
    watch,
    getValues,
    reset,
  } = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues:
      editMode && initialData
        ? {
            type: initialData.type,
            amount: initialData.amount.toString(),
            description: initialData.description,
            accountId: initialData.accountId,
            category: initialData.category,
            date: new Date(initialData.date),
            isRecurring: initialData.isRecurring,
            ...(initialData.recurringInterval && {
              recurringInterval: initialData.recurringInterval,
            }),
          }
        : {
            type: "EXPENSE",
            amount: "",
            description: "",
            accountId: accounts.find((ac) => ac.isDefault)?.id,
            date: new Date(),
            isRecurring: false,
          },
  });

  const {
    loading: transactionLoading,
    fn: transactionFn,
    data: transactionResult,
  } = useFetch(editMode ? updateTransaction : createTransaction);

  const type = watch("type");
  const isRecurring = watch("isRecurring");
  const date = watch("date");

  const filteredCategories = categories.filter(
    (category) => category.type === type
  );

  const onSubmit = async (data) => {
    console.log("Errors before submit:", errors);

    console.log("Form Submitted!"); // Check if this prints
    console.log("Submitting Transaction:", data);
    // Handle form submission
    const formData = {
      ...data,
      amount: parseFloat(data.amount),
    };

    if (editMode) {
      transactionFn(editId, formData);
    } else {
      transactionFn(formData);
    }
  };

  useEffect(() => {
    if (transactionResult?.success && !transactionLoading) {
      toast.success(
        editMode
          ? "Transaction updated successfully"
          : "Transaction created successfully"
      );
      reset();
      router.push(`/account/${transactionResult.data.accountId}`);
    }
  }, [transactionResult, transactionLoading, editMode]);

  const handleScanComplete = (scannedData) => {
    if (scannedData) {
      setValue("amount", scannedData.amount.toString());
      setValue("date", new Date(scannedData.date));
      if (scannedData.description) {
        setValue("description", scannedData.description);
      }
      if (scannedData.category) {
        setValue("category", scannedData.category);
      }
    }
  };

  useEffect(() => {
    console.log("Updated Category:", watch("category"));
  }, [watch("category")]);

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-4xl mx-auto p-8 shadow-xl rounded-lg mt-3 border"
    >
      {/* AI reciept scanner */}
      {!editMode && <ReceiptScanner onScanComplete={handleScanComplete} />}

      <h2 className="text-3xl font-semibold text-gray-800 text-center mb-8 mt-4">
        {editId ? "Edit" : "Add"} Transaction
      </h2>

      <div className="space-y-6">
        {/* Type Selection */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Transaction Type
          </label>
          <Select
            onValueChange={(value) => setValue("type", value)}
            defaultValue={type}
          >
            <SelectTrigger className="w-full mt-1 border-gray-300 shadow-sm rounded-lg hover:ring-2 focus:ring-2 focus:ring-blue-500 transition">
              <SelectValue placeholder="Select Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EXPENSE">Expense</SelectItem>
              <SelectItem value="INCOME">Income</SelectItem>
            </SelectContent>
          </Select>
          {errors.type && (
            <p className="text-sm text-red-500 mt-2">{errors.type.message}</p>
          )}
        </div>

        {/* Amount & Account Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Amount Input */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Amount
            </label>
            <Input
              type="number"
              step="0.01"
              placeholder="₹0.00"
              className="w-full mt-1 border-gray-300 shadow-sm rounded-lg text-lg focus:ring-2 focus:ring-blue-500"
              {...register("amount")}
            />
            {errors.amount && (
              <p className="text-sm text-red-500 mt-2">
                {errors.amount.message}
              </p>
            )}
          </div>

          {/* Account Selection */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Account
            </label>
            <Select
              onValueChange={(value) => setValue("accountId", value)}
              defaultValue={getValues("accountId")}
            >
              <SelectTrigger className="w-full mt-1 border-gray-300 shadow-sm rounded-lg hover:ring-2 focus:ring-2 focus:ring-blue-500">
                <SelectValue placeholder="Select Account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center gap-2">
                      <WalletIcon className="w-4 h-4 text-blue-500" />
                      {account.name} (₹{parseFloat(account.balance).toFixed(2)})
                    </div>
                  </SelectItem>
                ))}
                <CreateAccountDrawer>
                  <Button className="mt-4 w-full bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 py-2 rounded-lg transition">
                    <PlusCircleIcon className="w-5 h-5" />
                    Create Account
                  </Button>
                </CreateAccountDrawer>
              </SelectContent>
            </Select>
            {errors.accountId && (
              <p className="text-sm text-red-500 mt-2">
                {errors.accountId.message}
              </p>
            )}
          </div>
        </div>

        {/* Category Selection */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Category
          </label>
          <Select
            value={watch("category")}
            onValueChange={(value) => setValue("category", value)}
            // defaultValue={getValues("category")}
          >
            <SelectTrigger className="w-full mt-1 border-gray-300 shadow-sm rounded-lg hover:ring-2 focus:ring-2 focus:ring-blue-500">
              <SelectValue placeholder="Select Category" />
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-sm text-red-500 mt-2">
              {errors.category.message}
            </p>
          )}
        </div>

        {/* Date Picker */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Transaction Date
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full flex justify-between items-center px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all"
              >
                {date ? format(date, "PPP") : <span>Pick a Date</span>}
                <CalendarIcon className="w-5 h-5 text-gray-500" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(selectedDate) => setValue("date", selectedDate)}
                disabled={(day) =>
                  day > new Date() || day < new Date("1900-01-01")
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {errors.date && (
            <p className="text-sm text-red-500 mt-2">{errors.date.message}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Description
          </label>
          <Input
            placeholder="Enter the description"
            className="w-full mt-1 border-gray-300 shadow-sm rounded-lg"
            {...register("description")}
          />
          {errors.description && (
            <p className="text-sm text-red-500 mt-2">
              {errors.description.message}
            </p>
          )}
        </div>

        {/* Recurring Transaction */}
        <div className="space-y-3">
          <label className="block text-gray-700 font-medium">
            Recurring Transaction
          </label>
          <p className="text-sm text-gray-600">
            Setup a recurring schedule for the transaction
          </p>
          <div className="flex items-center space-x-3">
            <Switch
              checked={isRecurring}
              onCheckedChange={(checked) => setValue("isRecurring", checked)}
              className="w-8 h-5 bg-gray-600 rounded-full relative transition-colors duration-300 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {isRecurring && (
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Recurring Interval
              </label>
              <Select
                onValueChange={(value) => setValue("recurringInterval", value)}
                defaultValue={getValues("recurringInterval")}
              >
                <SelectTrigger className="w-full mt-1 border-gray-300 shadow-sm rounded-lg hover:ring-2 focus:ring-2 focus:ring-blue-500">
                  <SelectValue placeholder="Select Interval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">DAILY</SelectItem>
                  <SelectItem value="WEEKLY">WEEKLY</SelectItem>
                  <SelectItem value="MONTHLY">MONTHLY</SelectItem>
                  <SelectItem value="YEARLY">YEARLY</SelectItem>
                </SelectContent>
              </Select>
              {errors.recurringInterval && (
                <p className="text-sm text-red-500 mt-2">
                  {errors.recurringInterval.message}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Cancel Button */}
        <div>
          <Button
            type="button"
            variant="outline"
            className="w-full py-3 px-5 bg-gray-200 border-gray-300 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-300 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>

        {/* Submit Button */}
        <div className="mt-8">
          <Button
            type="submit"
            onClick={() => console.log("Validation Errors:", errors)}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-purple-500 hover:to-blue-500 text-white py-2 rounded-lg shadow-md transition-transform transform hover:scale-105"
            disabled={transactionLoading}
          >
            {transactionLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {editMode ? "Updating..." : "Creating..."}
              </>
            ) : editMode ? (
              "Update Transaction"
            ) : (
              "Create Transaction"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default AddTransactionForm;
