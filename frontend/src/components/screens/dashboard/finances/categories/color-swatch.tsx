"use client";

export function ColorSwatch({ color }: { color: string | null }) {
  return (
    <span
      className="inline-block h-3.5 w-3.5 flex-shrink-0 rounded-full border border-black/10"
      style={{ backgroundColor: color ?? "#94a3b8" }}
    />
  );
}
