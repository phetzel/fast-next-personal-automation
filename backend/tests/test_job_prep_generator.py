"""Tests for the job prep generator normalization behavior."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.pipelines.actions.job_prep.generator import RawPrepOutput, generate_prep_materials


class _FakeAgent:
    def __init__(self, output: RawPrepOutput) -> None:
        self.run = AsyncMock(return_value=SimpleNamespace(output=output))


def _generate_call():
    return generate_prep_materials(
        job_title="Backend Engineer",
        company="Acme",
        job_description="Build reliable backend systems",
        resume_text="Experienced backend engineer with automation experience",
        skip_cover_letter=True,
    )


@pytest.mark.anyio
async def test_generate_prep_materials_falls_back_when_prep_notes_missing() -> None:
    """Missing prep_notes should be normalized into a fallback markdown template."""
    fake_agent = _FakeAgent(
        RawPrepOutput(
            cover_letter="ignored because cover letter is skipped",
            screening_answers={"Why this company?": "The scope matches my background."},
        )
    )

    with patch("app.pipelines.actions.job_prep.generator.get_prep_agent", return_value=fake_agent):
        result = await _generate_call()

    assert result.cover_letter is None
    assert "Prep notes were missing from AI output" in result.prep_notes
    assert result.screening_answers == {"Why this company?": "The scope matches my background."}


@pytest.mark.anyio
async def test_generate_prep_materials_falls_back_when_prep_notes_blank() -> None:
    """Blank prep_notes should be treated the same as missing prep notes."""
    fake_agent = _FakeAgent(
        RawPrepOutput(
            cover_letter="ignored because cover letter is skipped",
            prep_notes="   ",
        )
    )

    with patch("app.pipelines.actions.job_prep.generator.get_prep_agent", return_value=fake_agent):
        result = await _generate_call()

    assert result.cover_letter is None
    assert "## Resume Highlights" in result.prep_notes
    assert "Prep notes were missing from AI output" in result.prep_notes


@pytest.mark.anyio
async def test_generate_prep_materials_defaults_missing_screening_answers() -> None:
    """Missing screening_answers should normalize to an empty dict."""
    fake_agent = _FakeAgent(
        RawPrepOutput(
            cover_letter="ignored because cover letter is skipped",
            prep_notes="# Prep Notes\n\n## Resume Highlights\n- Built APIs",
        )
    )

    with patch("app.pipelines.actions.job_prep.generator.get_prep_agent", return_value=fake_agent):
        result = await _generate_call()

    assert result.cover_letter is None
    assert result.prep_notes == "# Prep Notes\n\n## Resume Highlights\n- Built APIs"
    assert result.screening_answers == {}
