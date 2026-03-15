"use client";

import Link from "next/link";
import {
  EmailAreaCard,
  FinancesAreaCard,
  JobsAreaCard,
  useDashboardScreen,
} from "@/components/screens/dashboard/home";
import { PageHeader, SectionCard } from "@/components/shared/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { CheckCircle, XCircle, Loader2, Layers, Mail } from "lucide-react";
import { ROUTES } from "@/lib/constants";

export default function DashboardPage() {
  const screen = useDashboardScreen();

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Dashboard"
        description={`Welcome back${screen.user?.name ? `, ${screen.user.name}` : ""}!`}
      />

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Layers className="text-muted-foreground h-5 w-5" />
            Areas
          </span>
        }
        description="Jump into each product area and see the latest status at a glance."
      >
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <EmailAreaCard
            stats={screen.emailStats}
            sourcesCount={screen.emailSources.length}
            loading={screen.emailStatsLoading || screen.emailLoading}
          />
          <FinancesAreaCard stats={screen.financesStats} loading={screen.financesLoading} />
          <JobsAreaCard stats={screen.jobsStats} loading={screen.jobsLoading} />
        </div>
      </SectionCard>

      <SectionCard title="System Status" description="Core services and account connectivity.">
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">API Status</CardTitle>
            </CardHeader>
            <CardContent>
              {screen.healthLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                  <p className="text-muted-foreground text-sm">Checking...</p>
                </div>
              ) : screen.healthError ? (
                <div className="flex items-center gap-2">
                  <XCircle className="text-destructive h-4 w-4" />
                  <p className="text-destructive text-sm">Backend unavailable</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <p className="text-sm">
                      Status: <span className="font-medium">{screen.health?.status}</span>
                    </p>
                  </div>
                  {screen.health?.version && (
                    <p className="text-muted-foreground pl-6 text-xs sm:text-sm">
                      Version: {screen.health.version}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">Your Account</CardTitle>
            </CardHeader>
            <CardContent>
              {screen.user ? (
                <div className="space-y-2">
                  <p className="text-sm break-all">
                    Email: <span className="font-medium">{screen.user.email}</span>
                  </p>
                  {screen.user.name && (
                    <p className="text-sm">
                      Name: <span className="font-medium">{screen.user.name}</span>
                    </p>
                  )}
                  <div className="border-t pt-2">
                    <Link
                      href={ROUTES.SETTINGS_EMAIL}
                      className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                      {screen.emailLoading ? (
                        <span>Loading...</span>
                      ) : screen.hasConnectedEmail ? (
                        <span>
                          {screen.emailSources.length} email
                          {screen.emailSources.length !== 1 ? "s" : ""} connected
                        </span>
                      ) : (
                        <span>Connect email</span>
                      )}
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Loading...</p>
              )}
            </CardContent>
          </Card>
        </div>
      </SectionCard>
    </div>
  );
}
