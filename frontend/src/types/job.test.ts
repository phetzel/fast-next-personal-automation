import { describe, expect, it } from "vitest";
import { hasCoverLetterText, shouldGenerateReviewPdf } from "./job";

describe("job workflow helpers", () => {
  it("treats placeholder cover-letter text as missing", () => {
    expect(hasCoverLetterText("Not requested")).toBe(false);
    expect(hasCoverLetterText("  ")).toBe(false);
  });

  it("skips review PDF generation when cover letters are explicitly not required", () => {
    expect(
      shouldGenerateReviewPdf({
        cover_letter: null,
        requires_cover_letter: false,
      })
    ).toBe(false);
  });

  it("still generates a review PDF when cover-letter text exists", () => {
    expect(
      shouldGenerateReviewPdf(
        {
          cover_letter: null,
          requires_cover_letter: false,
        },
        "Tailored cover letter text"
      )
    ).toBe(true);
  });

  it("keeps PDF generation on when cover letters are required", () => {
    expect(
      shouldGenerateReviewPdf({
        cover_letter: null,
        requires_cover_letter: true,
      })
    ).toBe(true);
  });

  it("skips review PDF generation when cover-letter requirement is unknown and no text exists", () => {
    expect(
      shouldGenerateReviewPdf({
        cover_letter: null,
        requires_cover_letter: null,
      })
    ).toBe(false);
  });
});
