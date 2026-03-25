"use client";

import { cn } from "@/lib/utils";
import { getOrderedScreeningAnswers, type Job } from "@/types";

interface ScreeningAnswersSectionProps {
  screeningQuestions: Job["screening_questions"] | null | undefined;
  screeningAnswers: Job["screening_answers"] | null | undefined;
  title?: string;
  className?: string;
  titleClassName?: string;
  listClassName?: string;
  itemClassName?: string;
}

export function ScreeningAnswersSection({
  screeningQuestions,
  screeningAnswers,
  title = "Screening Answers",
  className,
  titleClassName,
  listClassName,
  itemClassName,
}: ScreeningAnswersSectionProps) {
  const orderedAnswers = getOrderedScreeningAnswers({
    screening_questions: screeningQuestions ?? null,
    screening_answers: screeningAnswers ?? null,
  });

  if (orderedAnswers.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className={cn("text-sm font-medium", titleClassName)}>{title}</p>
      <div className={cn("space-y-4 text-sm", listClassName)}>
        {orderedAnswers.map(({ question, answer }) => (
          <div key={question} className={cn("space-y-1", itemClassName)}>
            <p className="font-medium">{question}</p>
            <p className="text-muted-foreground whitespace-pre-wrap">{answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
