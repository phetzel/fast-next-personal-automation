"use client";

import { useEffect, useState } from "react";
import { useFinances } from "@/hooks";
import { useConfirmDialog } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import { AccountCard, AccountForm, UpdateBalanceForm } from "@/components/shared/finances";
import { Button, Skeleton } from "@/components/ui";
import { Plus, Building2 } from "lucide-react";
import type { FinancialAccount } from "@/types";

export default function AccountsPage() {
  const confirmDialog = useConfirmDialog();
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
    const result = await createAccount(data);
    if (!result) throw new Error("Failed to create account");
  };

  const handleEdit = async (data: Partial<FinancialAccount>) => {
    if (!editAccount) return;
    const result = await updateAccount(editAccount.id, data);
    if (!result) throw new Error("Failed to update account");
  };

  const handleDelete = async (account: FinancialAccount) => {
    const confirmed = await confirmDialog({
      title: `Delete "${account.name}"?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete account",
      destructive: true,
    });
    if (!confirmed) return;
    await deleteAccount(account.id);
  };

  const handleSetDefault = async (account: FinancialAccount) => {
    await updateAccount(account.id, { is_default: true });
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
      <PageHeader
        title="Accounts"
        description={
          <>
            {accounts.length} account{accounts.length !== 1 ? "s" : ""} · Net balance:{" "}
            <span className={totalBalance >= 0 ? "text-emerald-600" : "text-destructive"}>
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                totalBalance
              )}
            </span>
          </>
        }
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        }
      />

      {accountsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
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
              onSetDefault={handleSetDefault}
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
