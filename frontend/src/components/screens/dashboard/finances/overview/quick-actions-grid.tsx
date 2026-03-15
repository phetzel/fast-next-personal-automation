import { FeatureLinkCard } from "@/components/shared/navigation";
import { ROUTES } from "@/lib/constants";
import { Bot, Building2, PiggyBank, Receipt, RefreshCw, Workflow } from "lucide-react";

interface FinancesQuickActionsGridProps {
  activeRecurringCount: number;
}

export function FinancesQuickActionsGrid({ activeRecurringCount }: FinancesQuickActionsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <FeatureLinkCard
        href={ROUTES.FINANCES_TRANSACTIONS}
        icon={Receipt}
        title="Transactions"
        description="View & manage all transactions"
        tone="blue"
      />
      <FeatureLinkCard
        href={ROUTES.FINANCES_ACCOUNTS}
        icon={Building2}
        title="Accounts"
        description="Manage financial accounts"
        tone="purple"
      />
      <FeatureLinkCard
        href={ROUTES.FINANCES_BUDGETS}
        icon={PiggyBank}
        title="Budgets"
        description="Track spending limits"
        tone="green"
      />
      <FeatureLinkCard
        href={ROUTES.FINANCES_RECURRING}
        icon={RefreshCw}
        title="Recurring"
        description={`${activeRecurringCount} active subscriptions`}
        tone="orange"
      />
      <FeatureLinkCard
        href={ROUTES.FINANCES_ASSISTANT}
        icon={Bot}
        title="Assistant"
        description="Ask about your finances"
        tone="violet"
      />
      <FeatureLinkCard
        href={ROUTES.PIPELINES}
        icon={Workflow}
        title="Run Email Sync"
        description="Import transactions from email"
        tone="cyan"
      />
    </div>
  );
}
