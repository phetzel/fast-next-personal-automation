"use client";

import { useEffect, useState } from "react";
import { ACCOUNT_TYPE_LABELS } from "@/types";
import type { FinancialAccount } from "@/types";
import { Button, Input, Label } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AccountFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<FinancialAccount>) => Promise<void>;
  account?: FinancialAccount | null;
}

const accountTypes = Object.entries(ACCOUNT_TYPE_LABELS) as [
  FinancialAccount["account_type"],
  string
][];

export function AccountForm({ open, onClose, onSubmit, account }: AccountFormProps) {
  const isEdit = !!account;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: account?.name ?? "",
    institution: account?.institution ?? "",
    account_type: account?.account_type ?? "checking",
    currency: account?.currency ?? "USD",
    notes: account?.notes ?? "",
  });

  useEffect(() => {
    if (open) {
      setFormData({
        name: account?.name ?? "",
        institution: account?.institution ?? "",
        account_type: account?.account_type ?? "checking",
        currency: account?.currency ?? "USD",
        notes: account?.notes ?? "",
      });
      setError(null);
    }
  }, [open, account]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        ...formData,
        institution: formData.institution || null,
        notes: formData.notes || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Account" : "Add Account"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Account Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Chase Checking"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="account_type">Account Type *</Label>
            <Select
              value={formData.account_type}
              onValueChange={(v) =>
                setFormData((p) => ({ ...p, account_type: v as FinancialAccount["account_type"] }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accountTypes.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="institution">Institution</Label>
            <Input
              id="institution"
              value={formData.institution}
              onChange={(e) => setFormData((p) => ({ ...p, institution: e.target.value }))}
              placeholder="e.g. Chase"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={formData.currency}
              onChange={(e) =>
                setFormData((p) => ({ ...p, currency: e.target.value.toUpperCase().slice(0, 3) }))
              }
              placeholder="USD"
              maxLength={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Optional notes"
            />
          </div>

          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name}>
              {loading ? "Saving..." : isEdit ? "Save Changes" : "Add Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface UpdateBalanceFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (balance: number) => Promise<void>;
  account: FinancialAccount | null;
}

export function UpdateBalanceForm({ open, onClose, onSubmit, account }: UpdateBalanceFormProps) {
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(String(account?.current_balance ?? ""));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(parseFloat(balance));
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Update Balance</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Enter the current balance for <strong>{account?.name}</strong>.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="balance">Balance ({account?.currency ?? "USD"})</Label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || balance === ""}>
              {loading ? "Saving..." : "Update Balance"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
