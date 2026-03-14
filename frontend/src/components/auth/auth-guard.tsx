"use client";

import { useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores";
import type { User } from "@/types";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, isAuthenticated, isLoading, setLoading, setUser } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      setLoading(false);
      return;
    }

    let isActive = true;

    const bootstrapAuth = async () => {
      setLoading(true);

      try {
        const user = await apiClient.get<User>("/auth/me");
        if (isActive) {
          setUser(user);
        }
      } catch {
        if (isActive) {
          setUser(null);
        }
      }
    };

    void bootstrapAuth();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated, setLoading, setUser, user]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground flex flex-col items-center gap-2">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
