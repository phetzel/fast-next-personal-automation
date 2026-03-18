import { describe, expect, it } from "vitest";
import {
  canTransitionTo,
  getScreeningQuestionText,
  hasCoverLetterText,
  shouldGenerateReviewPdf,
} from "./job";

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

  it("extracts the best screening question label from mixed payload shapes", () => {
    expect(getScreeningQuestionText({ question: "Why this company?" })).toBe("Why this company?");
    expect(getScreeningQuestionText({ label: "Years of React experience" })).toBe(
      "Years of React experience"
    );
    expect(getScreeningQuestionText({ prompt: "Work authorization status" })).toBe(
      "Work authorization status"
    );
  });

  it("allows direct move to applied from any pre-applied status", () => {
    expect(canTransitionTo("new", "applied")).toBe(true);
    expect(canTransitionTo("analyzed", "applied")).toBe(true);
    expect(canTransitionTo("prepped", "applied")).toBe(true);
    expect(canTransitionTo("reviewed", "applied")).toBe(true);
  });
});
