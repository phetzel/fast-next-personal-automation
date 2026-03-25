"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";

// Breadcrumb configuration
const routeLabels: Record<string, string> = {
  [ROUTES.JOBS_LIST]: "Listings",
  [ROUTES.JOBS_PROFILES]: "Profiles",
  [ROUTES.JOBS_PIPELINES]: "Pipelines",
  [ROUTES.JOBS_ASSISTANT]: "Assistant",
};

interface BreadcrumbItem {
  label: string;
  href: string;
  isActive: boolean;
}

function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const isListingsRoute = pathname === ROUTES.JOBS || pathname === ROUTES.JOBS_LIST;
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Jobs", href: ROUTES.JOBS_LIST, isActive: isListingsRoute },
  ];

  if (!isListingsRoute && routeLabels[pathname]) {
    breadcrumbs.push({
      label: routeLabels[pathname],
      href: pathname,
      isActive: true,
    });
    breadcrumbs[0].isActive = false;
  }

  return breadcrumbs;
}

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <div className="space-y-6">
      {/* Breadcrumb navigation */}
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

      {/* Page content */}
      {children}
    </div>
  );
}
