import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionGroups } from "./subscription-groups";

const group = {
  sender_domain: "example.com",
  representative_sender: "newsletter@example.com",
  representative_message_id: "message-1",
  total_messages: 3,
  unsubscribe_count: 2,
  archive_count: 3,
  latest_received_at: "2026-03-23T12:00:00Z",
  sample_messages: [
    {
      id: "message-1",
      subject: "Weekly roundup",
      received_at: "2026-03-23T12:00:00Z",
      source_email_address: "email@example.com",
      bucket: "newsletter" as const,
      unsubscribe_candidate: true,
      archive_recommended: true,
    },
  ],
};

describe("SubscriptionGroups", () => {
  it("calls approve and dismiss handlers", () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);
    const onDismiss = vi.fn().mockResolvedValue(undefined);

    render(
      <SubscriptionGroups
        groups={[group]}
        isLoading={false}
        onApprove={onApprove}
        onDismiss={onDismiss}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /approve cleanup/i }));
    fireEvent.click(screen.getByRole("button", { name: /always keep/i }));

    expect(onApprove).toHaveBeenCalledWith("message-1");
    expect(onDismiss).toHaveBeenCalledWith("message-1");
  });
});
