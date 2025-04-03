"use client";

import { bulkDeleteTransactions } from "@/actions/accounts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { categoryColors } from "@/data/categories";
import useFetch from "@/hooks/use-fetch";
import { format } from "date-fns";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  MoreHorizontal,
  RefreshCw,
  Trash,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { BarLoader } from "react-spinners";
import { toast } from "sonner";

const RECURRING_INTERVALS = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

const TransactionTable = ({ transactions }) => {
  const router = useRouter();

  const [selectedIds, setSelectedIds] = useState([]);
  const [sortConfig, setSortConfig] = useState({
    field: "date",
    direction: "desc",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [recurringFilter, setRecurringFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Number of transactions per page

  const {
    loading: deleteLoading,
    fn: deleteFn,
    data: deleted,
  } = useFetch(bulkDeleteTransactions);

  const handleDeleteSelected = async () => {
    if (
      !window.confirm(
        `Are You sure want to delete ${selectedIds.length} transactions`
      )
    ) {
      return;
    }
    deleteFn(selectedIds);
    setSelectedIds([]);
  };

  useEffect(() => {
    if (deleted && !deleteLoading) {
      toast.error("Transactions deleted successFully");
      setSelectedIds([]);
    }
  }, [deleted, deleteLoading]);

  const handleSort = (field) => {
    setSortConfig((current) => ({
      field,
      direction:
        current.field === field && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleSelect = (id) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds((current) =>
      current.length === filteredAndSortedTransactions.length
        ? []
        : filteredAndSortedTransactions.map((t) => t.id)
    );
  };

  // Reset filters
  const resetFilters = () => {
    setSearchTerm("");
    setTypeFilter("");
    setRecurringFilter("");
  };

  // Filter the transactions based on search and selected filters
  const filteredAndSortedTransactions = transactions
    .filter((transaction) => {
      // Filter by search term
      const searchMatch =
        transaction.description
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        transaction.amount.toString().includes(searchTerm);

      // Filter by type (Income/Expense)
      const typeMatch = typeFilter === "" || transaction.type === typeFilter;

      // Filter by recurring status
      const recurringMatch =
        recurringFilter === "" ||
        (recurringFilter === "recurring" && transaction.isRecurring) ||
        (recurringFilter === "non-recurring" && !transaction.isRecurring);

      return searchMatch && typeMatch && recurringMatch;
    })
    .sort((a, b) => {
      if (sortConfig.direction === "asc") {
        return a[sortConfig.field] > b[sortConfig.field] ? 1 : -1;
      } else {
        return a[sortConfig.field] < b[sortConfig.field] ? 1 : -1;
      }
    });

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = currentPage * itemsPerPage;

  const transactionsToShow = filteredAndSortedTransactions.slice(
    startIndex,
    endIndex
  );

  return (
    <div className="space-y-8">
      {deleteLoading && (
        <BarLoader
          className="mt-4"
          width="100%" // Make sure it's full width
          color="#9333ea" // Color for the bar (purple shade as you want)
          loading={deleteLoading} // This should control the loading state
        />
      )}

      {/* Filter Section */}
      <div className="flex flex-wrap gap-4 justify-center sm:justify-between items-center p-4 bg-gray-100 rounded-lg shadow-md w-full">
        <div className="flex-1 max-w-xl mb-4 sm:mb-0">
          {/* Large Search Bar */}
          <input
            type="text"
            className="w-full max-w-xl border border-gray-300 rounded-lg p-2 text-sm shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search by description or amount"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-center sm:justify-end">
          {/* Type Filter */}
          <select
            className="border border-gray-300 rounded-md p-2 text-sm shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
          </select>

          {/* Recurring Filter */}
          <select
            className="border border-gray-300 rounded-md p-2 text-sm shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={recurringFilter}
            onChange={(e) => setRecurringFilter(e.target.value)}
          >
            <option value="">All Recurring</option>
            <option value="recurring">Recurring</option>
            <option value="non-recurring">Non-recurring</option>
          </select>

          {/* Delete Selected Button */}
          {selectedIds.length > 0 && (
            <Button
              onClick={handleDeleteSelected}
              variant="destructive"
              className="bg-red-500 text-white hover:bg-red-600"
            >
              <Trash className="h-4 w-4 mr-2" />
              Delete Selected Transactions ({selectedIds.length})
            </Button>
          )}

          {/* Reset Filters Button */}
          <Button
            onClick={resetFilters}
            variant="outline"
            className="bg-gray-200 text-gray-700 hover:bg-gray-300 "
          >
            Reset Filters
          </Button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-xl shadow-md overflow-hidden border border-gray-300 bg-white">
        <Table className="table-auto w-full">
          <TableHeader className="bg-gray-100 text-gray-700 text-sm font-semibold border-b">
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  onCheckedChange={handleSelectAll}
                  checked={
                    selectedIds.length ===
                      filteredAndSortedTransactions.length &&
                    filteredAndSortedTransactions.length > 0
                  }
                  className="cursor-pointer"
                />
              </TableHead>
              <TableHead
                className="cursor-pointer text-center"
                onClick={() => handleSort("date")}
              >
                <div className="flex items-center">
                  Date:
                  {sortConfig.field === "date" &&
                    (sortConfig.direction === "asc" ? (
                      <ChevronUp className="m1-1 h-4 w-4" />
                    ) : (
                      <ChevronDown className="m1-1 h-4 w-4" />
                    ))}
                </div>
              </TableHead>
              <TableHead className="text-center">Description</TableHead>
              <TableHead
                className="cursor-pointer text-center"
                onClick={() => handleSort("category")}
              >
                <div className="flex items-center justify-center">
                  Category
                  {sortConfig.field === "category" &&
                    (sortConfig.direction === "asc" ? (
                      <ChevronUp className="m1-1 h-4 w-4" />
                    ) : (
                      <ChevronDown className="m1-1 h-4 w-4" />
                    ))}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer text-center"
                onClick={() => handleSort("amount")}
              >
                <div className="flex items-center justify-center">
                  Amount
                  {sortConfig.field === "amount" &&
                    (sortConfig.direction === "asc" ? (
                      <ChevronUp className="m1-1 h-4 w-4" />
                    ) : (
                      <ChevronDown className="m1-1 h-4 w-4" />
                    ))}
                </div>
              </TableHead>
              <TableHead className="text-center">Recurring</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactionsToShow.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-gray-500 py-6"
                >
                  No Transactions Found
                </TableCell>
              </TableRow>
            ) : (
              transactionsToShow.map((transaction) => (
                <TableRow
                  key={transaction.id}
                  className="border-b hover:bg-gray-50 transition-all duration-300"
                >
                  <TableCell className="text-center">
                    <Checkbox
                      onCheckedChange={() => handleSelect(transaction.id)}
                      checked={selectedIds.includes(transaction.id)}
                      className="cursor-pointer"
                    />
                  </TableCell>
                  <TableCell className="text-center text-gray-700">
                    {format(new Date(transaction.date), "PP")}
                  </TableCell>
                  <TableCell className="text-center">
                    {transaction.description}
                  </TableCell>
                  <TableCell className="capitalize text-center">
                    <span
                      style={{
                        background: categoryColors[transaction.category],
                      }}
                      className="px-3 py-1 rounded-full text-white text-xs font-medium"
                    >
                      {transaction.category}
                    </span>
                  </TableCell>
                  <TableCell
                    className="text-right font-medium text-lg"
                    style={{
                      color:
                        transaction.type === "EXPENSE" ? "#E53E3E" : "#48BB78",
                    }}
                  >
                    {transaction.type === "EXPENSE" ? "-" : "+"} ₹
                    {transaction.amount.toFixed(2)}
                  </TableCell>

                  <TableCell className="text-center">
                    {transaction.isRecurring ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge
                              variant="outline"
                              className="gap-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-full py-1 px-2 text-xs font-semibold"
                            >
                              <RefreshCw className="h-4 w-4 mr-1" />
                              {
                                RECURRING_INTERVALS[
                                  transaction.reccuringInterval
                                ]
                              }
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-sm">
                              <div className="font-medium">Next Date:</div>
                              <div>
                                {format(
                                  new Date(transaction.nextRecurringDate),
                                  "PP"
                                )}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Badge variant="outline" className="gap-2 text-gray-500">
                        <Clock className="h-4 w-4 mr-1" />
                        One-time
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0 hover:bg-gray-200"
                        >
                          <MoreHorizontal className="h-4 w-4 text-gray-600" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-white shadow-md rounded-lg">
                        <DropdownMenuLabel
                          className="cursor-pointer text-gray-800"
                          onClick={() => {
                            router.push(
                              `/transaction/create?edit=${transaction.id}`
                            );
                          }}
                        >
                          Edit
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteFn([transaction.id])}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-center items-center mt-4 space-x-2">
        <Button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          variant="outline"
          className="px-4 py-2 text-sm"
        >
          Previous
        </Button>

        <span>
          Page {currentPage} of{" "}
          {Math.ceil(filteredAndSortedTransactions.length / itemsPerPage)}
        </span>

        <Button
          onClick={() =>
            setCurrentPage((prev) =>
              Math.min(
                prev + 1,
                Math.ceil(filteredAndSortedTransactions.length / itemsPerPage)
              )
            )
          }
          disabled={
            currentPage ===
            Math.ceil(filteredAndSortedTransactions.length / itemsPerPage)
          }
          variant="outline"
          className="px-4 py-2 text-sm"
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default TransactionTable;
