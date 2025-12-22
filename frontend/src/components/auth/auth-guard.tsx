"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores";
import { ROUTES } from "@/lib/constants";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    async function verify() {
      await checkAuth();
      setIsChecking(false);
    }
    verify();
  }, [checkAuth]);

  useEffect(() => {
    if (!isChecking && !isLoading && !isAuthenticated) {
      router.replace(ROUTES.HOME);
    }
  }, [isChecking, isLoading, isAuthenticated, router]);

  // Show loading state while checking auth
  if (isChecking || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground flex flex-col items-center gap-2">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // Don't render children if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

