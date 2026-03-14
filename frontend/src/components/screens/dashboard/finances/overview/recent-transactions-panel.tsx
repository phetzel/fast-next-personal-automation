import Link from "next/link";
import { TransactionTable } from "@/components/shared/finances";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ROUTES } from "@/lib/constants";
import type { FinancialAccount, Transaction } from "@/types";
import { ArrowRight, Receipt } from "lucide-react";

interface RecentTransactionsPanelProps {
  transactions: Transaction[];
  accounts: FinancialAccount[];
  isLoading: boolean;
  onMarkReviewed: (transactionId: string) => void;
}

export function RecentTransactionsPanel({
  transactions,
  accounts,
  isLoading,
  onMarkReviewed,
}: RecentTransactionsPanelProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-blue-500" />
          Recent Transactions
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href={ROUTES.FINANCES_TRANSACTIONS}>
            View all
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <TransactionTable
          transactions={transactions.slice(0, 10)}
          accounts={accounts}
          isLoading={isLoading}
          onMarkReviewed={onMarkReviewed}
        />
      </CardContent>
    </Card>
  );
}
