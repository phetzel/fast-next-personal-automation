import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ConfirmDialogProvider, useConfirmDialog } from "./confirm-dialog";

function Harness() {
  const confirm = useConfirmDialog();
  const [result, setResult] = useState("pending");

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const confirmed = await confirm({
            title: "Delete item?",
            description: "This cannot be undone.",
            confirmLabel: "Delete",
            destructive: true,
          });
          setResult(confirmed ? "confirmed" : "cancelled");
        }}
      >
        Open Confirm
      </button>
      <span>{result}</span>
    </>
  );
}

describe("ConfirmDialog", () => {
  it("resolves true when the confirm action is clicked", async () => {
    render(
      <ConfirmDialogProvider>
        <Harness />
      </ConfirmDialogProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /open confirm/i }));

    expect(screen.getByText("Delete item?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(screen.getByText("confirmed")).toBeInTheDocument();
    });
  });
});
