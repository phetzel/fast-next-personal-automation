import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaginationControls } from "./pagination-controls";

describe("PaginationControls", () => {
  it("shows summary and calls navigation handlers", () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();

    render(
      <PaginationControls
        page={2}
        totalPages={4}
        summary="Page 2 of 4"
        onPrevious={onPrevious}
        onNext={onNext}
      />
    );

    expect(screen.getByText("Page 2 of 4")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /previous/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("hides itself when there is only one page", () => {
    const { container } = render(
      <PaginationControls
        page={1}
        totalPages={1}
        summary="Page 1 of 1"
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
