"""Page extraction utilities for job application analysis.

Provides functions to extract form fields, detect application types,
and identify common ATS system patterns.
"""

import logging
import re
from dataclasses import dataclass, field
from enum import Enum

from playwright.async_api import Page

logger = logging.getLogger(__name__)


class ApplicationType(str, Enum):
    """Type of job application."""

    EASY_APPLY = "easy_apply"  # LinkedIn Easy Apply, Indeed Easy Apply
    ATS = "ats"  # Greenhouse, Lever, Workday, etc.
    DIRECT = "direct"  # Company's own application form
    EMAIL = "email"  # Email-based application
    UNKNOWN = "unknown"


class FieldType(str, Enum):
    """Type of form field."""

    TEXT = "text"
    EMAIL = "email"
    PHONE = "phone"
    TEXTAREA = "textarea"
    SELECT = "select"
    CHECKBOX = "checkbox"
    RADIO = "radio"
    FILE = "file"
    DATE = "date"
    URL = "url"
    NUMBER = "number"
    UNKNOWN = "unknown"


@dataclass
class FormField:
    """Represents a detected form field."""

    name: str
    field_type: FieldType
    label: str | None = None
    required: bool = False
    placeholder: str | None = None
    options: list[str] = field(default_factory=list)
    selector: str | None = None

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "name": self.name,
            "field_type": self.field_type.value,
            "label": self.label,
            "required": self.required,
            "placeholder": self.placeholder,
            "options": self.options,
            "selector": self.selector,
        }


@dataclass
class ScreeningQuestion:
    """Represents a detected screening question."""

    question: str
    field_type: FieldType
    required: bool = False
    options: list[str] = field(default_factory=list)
    selector: str | None = None

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "question": self.question,
            "field_type": self.field_type.value,
            "required": self.required,
            "options": self.options,
            "selector": self.selector,
        }


@dataclass
class ApplicationAnalysis:
    """Complete analysis of a job application page."""

    application_type: ApplicationType
    application_url: str
    requires_cover_letter: bool = False
    requires_resume: bool = True  # Most applications require resume
    fields: list[FormField] = field(default_factory=list)
    screening_questions: list[ScreeningQuestion] = field(default_factory=list)
    estimated_time_minutes: int = 5

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "application_type": self.application_type.value,
            "application_url": self.application_url,
            "requires_cover_letter": self.requires_cover_letter,
            "requires_resume": self.requires_resume,
            "fields": [f.to_dict() for f in self.fields],
            "screening_questions": [q.to_dict() for q in self.screening_questions],
            "estimated_time_minutes": self.estimated_time_minutes,
        }


# ATS detection patterns
ATS_PATTERNS = {
    "greenhouse": [
        r"boards\.greenhouse\.io",
        r"greenhouse\.io",
        r"id=\"grnhse",
    ],
    "lever": [
        r"jobs\.lever\.co",
        r"lever\.co/apply",
    ],
    "workday": [
        r"myworkdayjobs\.com",
        r"workday\.com",
        r"wd\d+\.myworkday",
    ],
    "icims": [
        r"icims\.com",
        r"careers-.*\.icims",
    ],
    "smartrecruiters": [
        r"smartrecruiters\.com",
        r"jobs\.smartrecruiters",
    ],
    "ashby": [
        r"ashbyhq\.com",
        r"jobs\.ashby",
    ],
    "bamboohr": [
        r"bamboohr\.com",
    ],
}


async def detect_application_type(page: Page) -> ApplicationType:
    """Detect the type of job application based on page content.

    Args:
        page: Playwright page object

    Returns:
        ApplicationType enum value
    """
    url = page.url.lower()
    content = await page.content()
    content_lower = content.lower()

    # Check for Easy Apply patterns
    if "linkedin.com" in url:
        easy_apply = await page.query_selector('[data-control-name="easy-apply-button"]')
        if easy_apply or "easy apply" in content_lower:
            return ApplicationType.EASY_APPLY

    if "indeed.com" in url:
        easy_apply = await page.query_selector('[data-testid="indeedApply-button"]')
        if easy_apply or "apply now" in content_lower:
            return ApplicationType.EASY_APPLY

    # Check for known ATS patterns
    for ats_name, patterns in ATS_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, url) or re.search(pattern, content_lower):
                logger.info(f"Detected ATS: {ats_name}")
                return ApplicationType.ATS

    # Check for email application
    email_patterns = [
        r"mailto:",
        r"send.*resume.*email",
        r"email.*resume",
        r"apply.*via.*email",
    ]
    for pattern in email_patterns:
        if re.search(pattern, content_lower):
            return ApplicationType.EMAIL

    # Check for direct application form
    form_element = await page.query_selector("form")
    if form_element:
        return ApplicationType.DIRECT

    return ApplicationType.UNKNOWN


async def detect_cover_letter_requirement(page: Page) -> bool:
    """Check if the application requires a cover letter.

    Args:
        page: Playwright page object

    Returns:
        True if cover letter appears to be required
    """
    content = await page.content()
    content_lower = content.lower()

    # Patterns indicating cover letter is required
    required_patterns = [
        r"cover letter.*required",
        r"required.*cover letter",
        r"please.*include.*cover letter",
        r"must.*submit.*cover letter",
    ]

    for pattern in required_patterns:
        if re.search(pattern, content_lower):
            return True

    # Check for cover letter file upload field
    file_inputs = await page.query_selector_all('input[type="file"]')
    for input_el in file_inputs:
        # Check label or nearby text
        label = await input_el.evaluate(
            """el => {
            const label = document.querySelector(`label[for="${el.id}"]`);
            return label ? label.textContent : '';
        }"""
        )
        if label and "cover" in label.lower():
            # Check if it's marked as required
            required = await input_el.get_attribute("required")
            aria_required = await input_el.get_attribute("aria-required")
            if required or aria_required == "true":
                return True

    return False


async def extract_form_fields(page: Page) -> list[FormField]:
    """Extract all form fields from the page.

    Args:
        page: Playwright page object

    Returns:
        List of FormField objects
    """
    fields: list[FormField] = []

    # Extract input fields
    field_data = await page.evaluate(
        """() => {
        const fields = [];
        const inputs = document.querySelectorAll('input, textarea, select');

        inputs.forEach(input => {
            // Skip hidden fields
            if (input.type === 'hidden') return;

            // Get label
            let label = '';
            if (input.id) {
                const labelEl = document.querySelector(`label[for="${input.id}"]`);
                if (labelEl) label = labelEl.textContent.trim();
            }
            if (!label && input.closest('label')) {
                label = input.closest('label').textContent.trim();
            }
            if (!label) {
                label = input.placeholder || input.name || '';
            }

            // Get options for select elements
            let options = [];
            if (input.tagName === 'SELECT') {
                options = Array.from(input.options).map(opt => opt.textContent.trim());
            }

            // Build selector
            let selector = '';
            if (input.id) {
                selector = `#${input.id}`;
            } else if (input.name) {
                selector = `[name="${input.name}"]`;
            }

            fields.push({
                name: input.name || input.id || '',
                type: input.type || input.tagName.toLowerCase(),
                label: label,
                required: input.required || input.getAttribute('aria-required') === 'true',
                placeholder: input.placeholder || '',
                options: options,
                selector: selector
            });
        });

        return fields;
    }"""
    )

    for fd in field_data:
        field_type = _map_field_type(fd.get("type", ""))
        fields.append(
            FormField(
                name=fd.get("name", ""),
                field_type=field_type,
                label=fd.get("label"),
                required=fd.get("required", False),
                placeholder=fd.get("placeholder"),
                options=fd.get("options", []),
                selector=fd.get("selector"),
            )
        )

    return fields


async def extract_screening_questions(page: Page) -> list[ScreeningQuestion]:
    """Extract screening questions from the application page.

    Args:
        page: Playwright page object

    Returns:
        List of ScreeningQuestion objects
    """
    questions: list[ScreeningQuestion] = []

    # Common screening question patterns
    question_data = await page.evaluate(
        """() => {
        const questions = [];

        // Look for question containers (common patterns in ATS systems)
        const questionContainers = document.querySelectorAll(
            '[class*="question"], [class*="screening"], [data-question], .application-question'
        );

        questionContainers.forEach(container => {
            // Find the question text
            const questionEl = container.querySelector('label, .question-text, h3, h4');
            if (!questionEl) return;

            const questionText = questionEl.textContent.trim();
            if (questionText.length < 10) return;  // Skip very short texts

            // Find associated input
            const input = container.querySelector('input, textarea, select');
            if (!input) return;

            let options = [];
            if (input.tagName === 'SELECT') {
                options = Array.from(input.options).map(opt => opt.textContent.trim());
            }

            // Check for radio/checkbox options
            const radioOptions = container.querySelectorAll('input[type="radio"], input[type="checkbox"]');
            if (radioOptions.length > 0) {
                radioOptions.forEach(opt => {
                    const label = opt.closest('label') || document.querySelector(`label[for="${opt.id}"]`);
                    if (label) options.push(label.textContent.trim());
                });
            }

            questions.push({
                question: questionText,
                type: input.type || input.tagName.toLowerCase(),
                required: input.required || input.getAttribute('aria-required') === 'true',
                options: options,
                selector: input.id ? `#${input.id}` : `[name="${input.name}"]`
            });
        });

        return questions;
    }"""
    )

    for qd in question_data:
        field_type = _map_field_type(qd.get("type", ""))
        questions.append(
            ScreeningQuestion(
                question=qd.get("question", ""),
                field_type=field_type,
                required=qd.get("required", False),
                options=qd.get("options", []),
                selector=qd.get("selector"),
            )
        )

    return questions


async def analyze_application_page(page: Page) -> ApplicationAnalysis:
    """Perform complete analysis of a job application page.

    Args:
        page: Playwright page object pointing to application page

    Returns:
        ApplicationAnalysis with all detected information
    """
    logger.info(f"Analyzing application page: {page.url}")

    # Detect application type
    app_type = await detect_application_type(page)
    logger.info(f"Detected application type: {app_type.value}")

    # Check cover letter requirement
    requires_cover = await detect_cover_letter_requirement(page)
    logger.info(f"Cover letter required: {requires_cover}")

    # Extract form fields
    fields = await extract_form_fields(page)
    logger.info(f"Found {len(fields)} form fields")

    # Extract screening questions
    questions = await extract_screening_questions(page)
    logger.info(f"Found {len(questions)} screening questions")

    # Estimate time to complete
    estimated_time = 5  # Base time
    estimated_time += len(fields) * 0.5  # 30 seconds per field
    estimated_time += len(questions) * 2  # 2 minutes per question
    if requires_cover:
        estimated_time += 10  # 10 minutes for cover letter

    return ApplicationAnalysis(
        application_type=app_type,
        application_url=page.url,
        requires_cover_letter=requires_cover,
        requires_resume=True,  # Assume resume is always required
        fields=fields,
        screening_questions=questions,
        estimated_time_minutes=int(estimated_time),
    )


def _map_field_type(html_type: str) -> FieldType:
    """Map HTML input type to FieldType enum."""
    type_map = {
        "text": FieldType.TEXT,
        "email": FieldType.EMAIL,
        "tel": FieldType.PHONE,
        "textarea": FieldType.TEXTAREA,
        "select": FieldType.SELECT,
        "checkbox": FieldType.CHECKBOX,
        "radio": FieldType.RADIO,
        "file": FieldType.FILE,
        "date": FieldType.DATE,
        "url": FieldType.URL,
        "number": FieldType.NUMBER,
    }
    return type_map.get(html_type.lower(), FieldType.UNKNOWN)
