"""Legacy screening-question categorization helpers.

Screening answers are now generated in the main prep pass. The remaining logic
here is the lightweight question categorization used by tests and any future
routing heuristics.
"""

COMMON_QUESTION_PATTERNS = {
    "work_authorization": [
        "authorized to work",
        "legally authorized",
        "work permit",
        "visa sponsorship",
    ],
    "years_experience": [
        "years of experience",
        "how many years",
        "experience with",
    ],
    "relocation": [
        "willing to relocate",
        "open to relocation",
    ],
    "start_date": [
        "start date",
        "when can you start",
        "earliest start",
    ],
    "salary": [
        "salary expectation",
        "compensation expectation",
        "desired salary",
    ],
    "remote_work": [
        "work remotely",
        "remote work",
        "hybrid",
        "on-site",
    ],
}


def categorize_question(question: str) -> str | None:
    """Categorize a screening question by type."""
    question_lower = question.lower()

    for category, patterns in COMMON_QUESTION_PATTERNS.items():
        for pattern in patterns:
            if pattern in question_lower:
                return category

    return None
