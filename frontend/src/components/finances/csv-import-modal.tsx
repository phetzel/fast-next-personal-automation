"use client";

import { useState, useRef } from "react";
import type { CSVImportResponse, FinancialAccount } from "@/types";
import { Button, Label } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, CheckCircle2, AlertCircle } from "lucide-react";

interface CSVImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: {
    csv_content: string;
    account_id?: string | null;
  }) => Promise<CSVImportResponse | null>;
  accounts?: FinancialAccount[];
}

export function CSVImportModal({ open, onClose, onImport, accounts = [] }: CSVImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [accountId, setAccountId] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [result, setResult] = useState<CSVImportResponse | null>(null);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError("");

    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvContent(ev.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvContent) return;
    setLoading(true);
    setError("");
    try {
      const res = await onImport({
        csv_content: csvContent,
        account_id: accountId || null,
      });
      if (res) {
        setResult(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFileName("");
    setCsvContent("");
    setResult(null);
    setError("");
    setAccountId("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Import transactions from a CSV file. The file should have columns for date, description,
            and amount. Common bank export formats are automatically detected.
          </p>

          {/* Account selection */}
          {accounts.length > 0 && (
            <div className="space-y-1.5">
              <Label>Link to Account (optional)</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* File upload */}
          <div
            className="border-border hover:border-primary/50 flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="text-muted-foreground h-8 w-8" />
            <div className="text-center">
              <p className="text-sm font-medium">{fileName || "Click to upload CSV"}</p>
              <p className="text-muted-foreground text-xs">CSV files from Chase, BoA, etc.</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Result */}
          {result && (
            <div className="rounded-lg bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <p className="font-medium text-emerald-700 dark:text-emerald-400">Import Complete</p>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-emerald-700 dark:text-emerald-400">
                <li>✓ {result.imported} transactions imported</li>
                {result.skipped_duplicates > 0 && (
                  <li>⊘ {result.skipped_duplicates} duplicates skipped</li>
                )}
              </ul>
              {result.errors.length > 0 && (
                <div className="mt-2 border-t border-emerald-600/20 pt-2">
                  <p className="text-xs font-medium text-amber-600">Warnings:</p>
                  {result.errors.slice(0, 3).map((e, i) => (
                    <p key={i} className="text-xs text-amber-600">
                      {e}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3">
              <AlertCircle className="text-destructive h-4 w-4 shrink-0" />
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? "Done" : "Cancel"}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={!csvContent || loading}>
              {loading ? "Importing..." : "Import"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
