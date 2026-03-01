"use client";

import { useEffect, useState } from "react";
import { useFinances } from "@/hooks";
import { AccountCard, AccountForm, UpdateBalanceForm } from "@/components/finances";
import { Button } from "@/components/ui";
import { Plus, Building2 } from "lucide-react";
import type { FinancialAccount } from "@/types";

export default function AccountsPage() {
  const {
    accounts,
    accountsLoading,
    fetchAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
    updateBalance,
  } = useFinances();

  const [showForm, setShowForm] = useState(false);
  const [editAccount, setEditAccount] = useState<FinancialAccount | null>(null);
  const [balanceAccount, setBalanceAccount] = useState<FinancialAccount | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleCreate = async (data: Partial<FinancialAccount>) => {
    await createAccount(data);
  };

  const handleEdit = async (data: Partial<FinancialAccount>) => {
    if (!editAccount) return;
    await updateAccount(editAccount.id, data);
  };

  const handleDelete = async (account: FinancialAccount) => {
    if (!confirm(`Delete "${account.name}"? This cannot be undone.`)) return;
    await deleteAccount(account.id);
  };

  const handleUpdateBalance = async (balance: number) => {
    if (!balanceAccount) return;
    await updateBalance(balanceAccount.id, balance);
  };

  const totalBalance = accounts
    .filter((a) => a.is_active && a.current_balance !== null)
    .reduce((sum, a) => sum + (a.current_balance ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""} ·{" "}
            Net balance:{" "}
            <span className={totalBalance >= 0 ? "text-emerald-600" : "text-destructive"}>
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalBalance)}
            </span>
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>

      {accountsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-muted h-40 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <Building2 className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
          <p className="font-medium">No accounts yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Add your bank accounts, credit cards, and investments
          </p>
          <Button className="mt-4" onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={(a) => {
                setEditAccount(a);
                setShowForm(true);
              }}
              onDelete={handleDelete}
              onUpdateBalance={(a) => setBalanceAccount(a)}
            />
          ))}
        </div>
      )}

      <AccountForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditAccount(null);
        }}
        onSubmit={editAccount ? handleEdit : handleCreate}
        account={editAccount}
      />

      <UpdateBalanceForm
        open={!!balanceAccount}
        onClose={() => setBalanceAccount(null)}
        onSubmit={handleUpdateBalance}
        account={balanceAccount}
      />
    </div>
  );
}
