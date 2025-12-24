"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";

// Breadcrumb configuration
const routeLabels: Record<string, string> = {
  [ROUTES.JOBS]: "Overview",
  [ROUTES.JOBS_LIST]: "Listings",
  [ROUTES.JOBS_PROFILES]: "Profiles",
  [ROUTES.JOBS_SEARCH]: "Search",
};

interface BreadcrumbItem {
  label: string;
  href: string;
  isActive: boolean;
}

function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Jobs", href: ROUTES.JOBS, isActive: pathname === ROUTES.JOBS },
  ];

  // Add current page if not on overview
  if (pathname !== ROUTES.JOBS && routeLabels[pathname]) {
    breadcrumbs.push({
      label: routeLabels[pathname],
      href: pathname,
      isActive: true,
    });
    // Mark Jobs as not active when on a sub-route
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
            {index > 0 && (
              <ChevronRight className="mx-1 h-4 w-4 text-muted-foreground/60" />
            )}
            {crumb.isActive ? (
              <span className="font-medium text-foreground">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className={cn(
                  "text-muted-foreground hover:text-foreground transition-colors"
                )}
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

