"use client";

import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { LinkedEmailContext } from "@/types/email";
import { Mail } from "lucide-react";

interface LinkedEmailCardProps {
  email: LinkedEmailContext;
}

export function LinkedEmailCard({ email }: LinkedEmailCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="h-5 w-5 text-blue-500" />
          Source Email
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {email.subject && (
          <div>
            <span className="text-muted-foreground">Subject</span>
            <p className="mt-0.5 line-clamp-2 font-medium">{email.subject}</p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">From</span>
          <span className="max-w-[200px] truncate">{email.from_address}</span>
        </div>
        {email.received_at && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Received</span>
            <span>{format(new Date(email.received_at), "MMM d, yyyy h:mm a")}</span>
          </div>
        )}
        {email.bucket && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Bucket</span>
            <span className="capitalize">{email.bucket}</span>
          </div>
        )}
        {email.summary && (
          <div className="border-t pt-2">
            <span className="text-muted-foreground">Summary</span>
            <p className="text-muted-foreground mt-0.5 line-clamp-3 text-xs">{email.summary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
