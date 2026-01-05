"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";

// Breadcrumb configuration
const routeLabels: Record<string, string> = {
  [ROUTES.EMAIL]: "Overview",
  [ROUTES.EMAIL_SYNCS]: "Sync History",
  [ROUTES.EMAIL_MESSAGES]: "Messages",
};

interface BreadcrumbItem {
  label: string;
  href: string;
  isActive: boolean;
}

function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Email", href: ROUTES.EMAIL, isActive: pathname === ROUTES.EMAIL },
  ];

  // Add current page if not on overview
  if (pathname !== ROUTES.EMAIL && routeLabels[pathname]) {
    breadcrumbs.push({
      label: routeLabels[pathname],
      href: pathname,
      isActive: true,
    });
    // Mark Email as not active when on a sub-route
    breadcrumbs[0].isActive = false;
  }

  return breadcrumbs;
}

export default function EmailLayout({ children }: { children: React.ReactNode }) {
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
