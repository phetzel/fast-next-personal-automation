"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";

const routeLabels: Record<string, string> = {
  [ROUTES.FINANCES]: "Overview",
  [ROUTES.FINANCES_TRANSACTIONS]: "Transactions",
  [ROUTES.FINANCES_ACCOUNTS]: "Accounts",
  [ROUTES.FINANCES_BUDGETS]: "Budgets",
  [ROUTES.FINANCES_RECURRING]: "Recurring",
  [ROUTES.FINANCES_ASSISTANT]: "Assistant",
};

interface BreadcrumbItem {
  label: string;
  href: string;
  isActive: boolean;
}

function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Finances", href: ROUTES.FINANCES, isActive: pathname === ROUTES.FINANCES },
  ];

  if (pathname !== ROUTES.FINANCES && routeLabels[pathname]) {
    breadcrumbs.push({ label: routeLabels[pathname], href: pathname, isActive: true });
    breadcrumbs[0].isActive = false;
  }

  return breadcrumbs;
}

export default function FinancesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <div className="space-y-6">
      <nav className="flex items-center space-x-1 text-sm" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.href} className="flex items-center">
            {index > 0 && <ChevronRight className="text-muted-foreground/60 mx-1 h-4 w-4" />}
            {crumb.isActive ? (
              <span className="text-foreground font-medium">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className={cn("text-muted-foreground hover:text-foreground transition-colors")}
              >
                {crumb.label}
              </Link>
            )}
          </div>
        ))}
      </nav>
      {children}
    </div>
  );
}
