"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";
import { useAuthStore } from "@/stores";
import type { User } from "@/types";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
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

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(ROUTES.LOGIN);
    }
  }, [isAuthenticated, isLoading, router]);

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
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground flex flex-col items-center gap-3">
          <span>You are not signed in.</span>
          <Link href={ROUTES.LOGIN} className="text-primary underline underline-offset-4">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
