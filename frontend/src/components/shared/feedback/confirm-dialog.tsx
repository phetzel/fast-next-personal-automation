"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { Button } from "@/components/ui";

interface ConfirmDialogOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type ConfirmDialogFn = (options: ConfirmDialogOptions) => Promise<boolean>;

const ConfirmDialogContext = createContext<ConfirmDialogFn | null>(null);

interface PendingConfirm {
  options: ConfirmDialogOptions;
  resolve: (value: boolean) => void;
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const close = (value: boolean) => {
    if (!pendingConfirm) {
      return;
    }
    pendingConfirm.resolve(value);
    setPendingConfirm(null);
  };

  const confirm = useMemo<ConfirmDialogFn>(
    () => (options) =>
      new Promise<boolean>((resolve) => {
        setPendingConfirm({ options, resolve });
      }),
    []
  );

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      <Dialog
        open={!!pendingConfirm}
        onOpenChange={(open) => {
          if (!open) {
            close(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex items-center gap-3">
              <div className="bg-destructive/10 text-destructive rounded-full p-2">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle>{pendingConfirm?.options.title}</DialogTitle>
                <DialogDescription>{pendingConfirm?.options.description}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => close(false)}>
              {pendingConfirm?.options.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant={pendingConfirm?.options.destructive ? "destructive" : "default"}
              onClick={() => close(true)}
            >
              {pendingConfirm?.options.confirmLabel ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error("useConfirmDialog must be used within ConfirmDialogProvider");
  }
  return context;
}
