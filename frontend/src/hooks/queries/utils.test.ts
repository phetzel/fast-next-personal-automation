import { describe, expect, it } from "vitest";
import { toSearchParams } from "./utils";

describe("toSearchParams", () => {
  it("serializes array values as repeated query params", () => {
    const queryString = toSearchParams({
      statuses: ["new", "analyzed"],
      search: "engineer",
      page: 2,
    });
    const params = new URLSearchParams(queryString);

    expect(params.getAll("statuses")).toEqual(["new", "analyzed"]);
    expect(params.get("search")).toBe("engineer");
    expect(params.get("page")).toBe("2");
  });
});
