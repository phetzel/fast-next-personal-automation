"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { JobsAreaCard } from "@/components/areas";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks";
import type { HealthResponse, EmailSource } from "@/types";
import { CheckCircle, XCircle, Loader2, Layers, Mail } from "lucide-react";
import { ROUTES } from "@/lib/constants";

export default function DashboardPage() {
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState(false);
  const [emailSources, setEmailSources] = useState<EmailSource[]>([]);
  const [emailLoading, setEmailLoading] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await apiClient.get<HealthResponse>("/health");
        setHealth(data);
        setHealthError(false);
      } catch {
        setHealthError(true);
      } finally {
        setHealthLoading(false);
      }
    };

    const fetchEmailSources = async () => {
      try {
        const data = await apiClient.get<EmailSource[]>("/email/sources");
        setEmailSources(data);
      } catch {
        // Silently fail - email sources are optional
      } finally {
        setEmailLoading(false);
      }
    };

    checkHealth();
    fetchEmailSources();
  }, []);

  const hasConnectedEmail = emailSources.length > 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Welcome back{user?.name ? `, ${user.name}` : ""}!
        </p>
      </div>

      {/* Areas Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Layers className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Areas</h2>
        </div>
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <JobsAreaCard />
          {/* Future areas can be added here */}
        </div>
      </section>

      {/* System Status Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4">System Status</h2>
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">API Status</CardTitle>
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">Checking...</p>
                </div>
              ) : healthError ? (
                <div className="flex items-center gap-2">
                  <XCircle className="text-destructive h-4 w-4" />
                  <p className="text-destructive text-sm">Backend unavailable</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <p className="text-sm">
                      Status: <span className="font-medium">{health?.status}</span>
                    </p>
                  </div>
                  {health?.version && (
                    <p className="text-muted-foreground text-xs sm:text-sm pl-6">
                      Version: {health.version}
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
              {user ? (
                <div className="space-y-2">
                  <p className="text-sm break-all">
                    Email: <span className="font-medium">{user.email}</span>
                  </p>
                  {user.name && (
                    <p className="text-sm">
                      Name: <span className="font-medium">{user.name}</span>
                    </p>
                  )}
                  <div className="pt-2 border-t">
                    <Link
                      href={ROUTES.SETTINGS_EMAIL}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                      {emailLoading ? (
                        <span>Loading...</span>
                      ) : hasConnectedEmail ? (
                        <span>
                          {emailSources.length} email{emailSources.length !== 1 ? "s" : ""} connected
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
      </section>
    </div>
  );
}
