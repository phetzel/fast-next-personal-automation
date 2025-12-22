import { Header, Sidebar } from "@/components/layout";
import { AuthGuard } from "@/components/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
