import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { FeatureLinkCard } from "./feature-link-card";

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

describe("FeatureLinkCard", () => {
  it("renders a linked card with title and description", () => {
    render(
      <FeatureLinkCard
        href="/email/messages"
        icon={Inbox}
        title="Browse Messages"
        description="View processed emails"
        tone="green"
      />
    );

    expect(screen.getByRole("link")).toHaveAttribute("href", "/email/messages");
    expect(screen.getByText("Browse Messages")).toBeInTheDocument();
    expect(screen.getByText("View processed emails")).toBeInTheDocument();
  });
});
