import { PageHeader } from "@/components/shared/layout";

interface FinancesOverviewHeaderProps {
  monthLabel: string;
}

export function FinancesOverviewHeader({ monthLabel }: FinancesOverviewHeaderProps) {
  return <PageHeader title="Finances Overview" description={`${monthLabel} summary`} />;
}
