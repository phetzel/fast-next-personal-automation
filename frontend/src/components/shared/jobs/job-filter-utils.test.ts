import { describe, expect, it } from "vitest";
import { getNextSelectedStatuses } from "./job-filter-utils";

describe("getNextSelectedStatuses", () => {
  it("adds an unselected status while preserving the canonical order", () => {
    expect(getNextSelectedStatuses(["new", "prepped"], "analyzed")).toEqual([
      "new",
      "analyzed",
      "prepped",
    ]);
  });

  it("removes a selected status when others remain selected", () => {
    expect(getNextSelectedStatuses(["new", "analyzed"], "analyzed")).toEqual(["new"]);
  });

  it("keeps the current selection when toggling off the last selected status", () => {
    expect(getNextSelectedStatuses(["new"], "new")).toEqual(["new"]);
  });
});
