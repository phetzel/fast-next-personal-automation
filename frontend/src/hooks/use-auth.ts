"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores";
import { apiClient, ApiError } from "@/lib/api-client";
import type { LoginRequest, LoginResponse, RegisterRequest, User } from "@/types";
import { ROUTES } from "@/lib/constants";

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout } = useAuthStore();

  const login = useCallback(
    async (credentials: LoginRequest) => {
      setLoading(true);
      try {
        const response = await apiClient.post<LoginResponse>("/auth/login", credentials);
        setUser(response.user);
        router.push(ROUTES.DASHBOARD);
        return response;
      } catch (error) {
        setLoading(false);
        throw error;
      }
    },
    [router, setUser, setLoading]
  );

  const register = useCallback(async (data: RegisterRequest) => {
    const response = await apiClient.post<{ id: string; email: string }>("/auth/register", data);
    return response;
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Ignore logout errors
    } finally {
      logout();
      router.push(ROUTES.LOGIN);
    }
  }, [logout, router]);

  const refreshToken = useCallback(async () => {
    try {
      await apiClient.post("/auth/refresh");
      const userData = await apiClient.get<User>("/auth/me");
      setUser(userData);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout();
        router.push(ROUTES.LOGIN);
      }
      return false;
    }
  }, [logout, router, setUser]);

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout: handleLogout,
    refreshToken,
  };
}
