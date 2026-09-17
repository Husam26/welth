'use client';

import { updateDefaultAccount, deleteAccount, updateAccountBalance } from "@/actions/accounts";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import useFetch from "@/hooks/use-fetch";
import { formatCurrency } from "@/lib/currency";
import { ArrowUpRight, ArrowDownRight, Trash2, Pencil, Check, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

const AccountCard = ({ account }) => {
  const router = useRouter();
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
    if (updatedAccount?.success) toast.success("Default account updated");
  }, [updatedAccount]);

  useEffect(() => {
    if (error) toast.error(error.message || "Failed to update default account");
  }, [error]);

  const handleDelete = async (event) => {
    event.stopPropagation();
    event.preventDefault();
    if (!confirm("Delete this account? This cannot be undone.")) return;

    setIsDeleting(true);
    const response = await deleteAccount(id);
    setIsDeleting(false);

    if (response.success) {
      toast.success("Account deleted");
      router.refresh();
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
    const response = await updateBalanceFn(id, newBalance);
    if (response?.success) {
      toast.success("Balance updated");
      setIsEditing(false);
      setNewBalance(parseFloat(response.data.balance).toFixed(2));
      router.refresh();
    } else {
      toast.error(response?.error || "Failed to update balance.");
    }
  };

  return (
    <Card className="transition-colors hover:border-primary/30">
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="space-y-1.5">
          <CardTitle className="text-base">{name}</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()} account
            </span>
            {isDefault && <Badge variant="muted" className="text-[10px]">Default</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isDefault} onClick={handleDefaultChange} disabled={updateDefaultLoading} />
        </div>
      </CardHeader>

      <CardContent>
        {!isEditing ? (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold tracking-tight nums">
              {formatCurrency(parseFloat(balance))}
            </span>
            <button
              onClick={() => setIsEditing(true)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Edit balance"
            >
              <Pencil className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              className="h-9 max-w-[10rem]"
              autoFocus
            />
            <Button size="icon" className="size-9 shrink-0" onClick={handleEditBalance} disabled={updateBalanceLoading}>
              <Check className="size-4" />
            </Button>
            <Button size="icon" variant="outline" className="size-9 shrink-0" onClick={() => setIsEditing(false)}>
              <X className="size-4" />
            </Button>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t pt-4 text-sm">
        <div className="flex items-center gap-4 text-muted-foreground">
          <span className="flex items-center gap-1 text-positive"><ArrowUpRight className="size-4" /> Income</span>
          <span className="flex items-center gap-1 text-negative"><ArrowDownRight className="size-4" /> Expense</span>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/account/${id}`}>
            <Button variant="ghost" size="sm">View</Button>
          </Link>
          <button onClick={handleDelete} disabled={isDeleting} className="text-muted-foreground hover:text-negative" aria-label="Delete account">
            <Trash2 className="size-4" />
          </button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default AccountCard;
