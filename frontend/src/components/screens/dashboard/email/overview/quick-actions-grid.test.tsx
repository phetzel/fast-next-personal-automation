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
  it("includes the triage queue quick action", () => {
    render(<EmailOverviewQuickActionsGrid />);

    expect(screen.getByText("Open Triage Queue")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open triage queue/i })).toHaveAttribute(
      "href",
      "/email/triage"
    );
  });
});
