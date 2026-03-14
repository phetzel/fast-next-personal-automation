import { ROUTES } from "@/lib/constants";
import { useAuthStore } from "@/stores";

export function handleAuthFailure() {
  useAuthStore.getState().logout();

  if (typeof window === "undefined") {
    return;
  }

  if (window.location.pathname !== ROUTES.LOGIN) {
    window.location.assign(ROUTES.LOGIN);
  }
}
