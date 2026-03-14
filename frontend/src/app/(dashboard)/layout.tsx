import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Header, Sidebar } from "@/components/shared/layout";
import { AuthGuard } from "@/components/shared/auth";
import { ROUTES } from "@/lib/constants";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const hasAccessToken = Boolean(cookieStore.get("access_token")?.value);
  const hasRefreshToken = Boolean(cookieStore.get("refresh_token")?.value);

  if (!hasAccessToken && !hasRefreshToken) {
    redirect(ROUTES.LOGIN);
  }

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="flex-1 overflow-auto p-3 sm:p-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
