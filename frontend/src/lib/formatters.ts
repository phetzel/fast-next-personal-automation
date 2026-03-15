import { format, formatDistanceToNow } from "date-fns";

export function formatCurrency(
  value: number,
  options?: Intl.NumberFormatOptions & { currency?: string }
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: options?.currency ?? "USD",
    ...options,
  }).format(value);
}

export function formatCurrencyCompact(value: number) {
  const abs = Math.abs(value);

  if (abs >= 1000) {
    return `$${(abs / 1000).toFixed(1)}k`;
  }

  return formatCurrency(value, { maximumFractionDigits: 0 });
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

export function formatDate(value: Date | string | null | undefined, pattern = "MMM d, yyyy") {
  if (!value) {
    return "—";
  }

  return format(new Date(value), pattern);
}

export function formatRelativeTime(value: Date | string | null | undefined) {
  if (!value) {
    return "—";
  }

  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

export function formatDuration(ms: number | null | undefined) {
  if (ms === null || ms === undefined) {
    return "—";
  }

  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

export function formatMonthYear(value: Date | string | null | undefined) {
  if (!value) {
    return "—";
  }

  return format(new Date(value), "MMMM yyyy");
}
