import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SenderRulesCard } from "./sender-rules-card";

const baseRule = {
  id: "rule-1",
  user_id: "user-1",
  name: "Cleanup: example.com",
  destination_type: "cleanup",
  filter_rules: {
    sender_patterns: ["example.com"],
    subject_contains: [],
    subject_not_contains: [],
  },
  parser_name: null,
  is_active: true,
  priority: 100,
  always_keep: false,
  queue_unsubscribe: true,
  suggest_archive: true,
  bucket_override: null,
  created_at: "2026-03-23T00:00:00Z",
  updated_at: null,
};

describe("SenderRulesCard", () => {
  it("creates, edits, toggles, and deletes rules", async () => {
    const onCreateRule = vi.fn().mockResolvedValue(true);
    const onUpdateRule = vi.fn().mockResolvedValue(true);
    const onDeleteRule = vi.fn().mockResolvedValue(true);
    const onToggleRule = vi.fn().mockResolvedValue(true);

    const { rerender } = render(
      <SenderRulesCard
        senderRules={[]}
        isSaving={false}
        onCreateRule={onCreateRule}
        onUpdateRule={onUpdateRule}
        onDeleteRule={onDeleteRule}
        onToggleRule={onToggleRule}
      />
    );

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("newsletter.example.com"), {
        target: { value: "example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /create rule/i }));
    });

    expect(onCreateRule).toHaveBeenCalled();

    rerender(
      <SenderRulesCard
        senderRules={[baseRule]}
        isSaving={false}
        onCreateRule={onCreateRule}
        onUpdateRule={onUpdateRule}
        onDeleteRule={onDeleteRule}
        onToggleRule={onToggleRule}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /edit/i }));
      fireEvent.change(screen.getByPlaceholderText("newsletter.example.com"), {
        target: { value: "updated-example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /save rule/i }));
      fireEvent.click(screen.getByRole("button", { name: /pause/i }));
      fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    });

    expect(onUpdateRule).toHaveBeenCalled();
    expect(onToggleRule).toHaveBeenCalledWith(baseRule);
    expect(onDeleteRule).toHaveBeenCalledWith("rule-1");
  });
});
