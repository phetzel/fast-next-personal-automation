import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmailOverviewQuickActionsGrid } from "./quick-actions-grid";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("EmailOverviewQuickActionsGrid", () => {
  it("includes cleanup review shortcuts", () => {
    render(<EmailOverviewQuickActionsGrid />);

    expect(screen.getByText("Open Triage Queue")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open triage queue/i })).toHaveAttribute(
      "href",
      "/email/triage"
    );
    expect(screen.getByRole("link", { name: /review queue/i })).toHaveAttribute(
      "href",
      "/email/review"
    );
    expect(screen.getByRole("link", { name: /subscriptions/i })).toHaveAttribute(
      "href",
      "/email/subscriptions"
    );
    expect(screen.getByRole("link", { name: /cleanup history/i })).toHaveAttribute(
      "href",
      "/email/history"
    );
  });
});
