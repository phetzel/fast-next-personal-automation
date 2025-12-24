"use client";

import { ChatContainer, ChatSidebarToggle } from "@/components/chat";
import { useAuthStore } from "@/stores";
import { Briefcase, AlertCircle } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

export default function JobsChatPage() {
  const { isAuthenticated } = useAuthStore();

  // Jobs chat requires authentication
  if (!isAuthenticated) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900">
          <AlertCircle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold">Authentication Required</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Please log in to use the Jobs Assistant
          </p>
        </div>
        <Link
          href={ROUTES.LOGIN}
          className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Log In
        </Link>
      </div>
    );
  }

  return (
    <div className="-m-3 flex h-full flex-col sm:-m-6">
      {/* Header with area indicator */}
      <div className="flex items-center gap-3 border-b p-3 sm:p-4">
        <div className="md:hidden">
          <ChatSidebarToggle />
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
          <Briefcase className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="font-semibold">Jobs Assistant</h1>
          <p className="text-muted-foreground text-xs">
            Specialized help for job search, profiles, and applications
          </p>
        </div>
      </div>

      {/* Chat container with jobs area */}
      <div className="min-h-0 flex-1">
        <ChatContainer area="jobs" showAreaBanner={true} />
      </div>
    </div>
  );
}

