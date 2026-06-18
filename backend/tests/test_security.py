"""
CarbonFactors — Security Unit Tests
Tests input sanitisation to prevent prompt injection and XSS.
Run with: pytest tests/test_security.py -v
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.llm import sanitize


class TestSanitize:
    """Tests for the LLM input sanitizer."""

    def test_strips_html_script_tag(self):
        """Script tags must be removed to prevent prompt injection."""
        result = sanitize("<script>alert('xss')</script>hello")
        assert "<script>" not in result
        assert "</script>" not in result

    def test_strips_html_img_tag(self):
        """Image tags with onerror handlers must be stripped."""
        result = sanitize("<img src=x onerror=alert(1)>")
        assert "<img" not in result
        assert "onerror" not in result

    def test_strips_null_byte(self):
        """Null bytes (\\x00) must be removed."""
        result = sanitize("hello\x00world")
        assert "\x00" not in result

    def test_strips_control_characters(self):
        """ASCII control characters (\\x01–\\x1f) must be stripped."""
        result = sanitize("hello\x01\x1fworld")
        assert "\x01" not in result
        assert "\x1f" not in result

    def test_truncates_at_max_len(self):
        """Output must not exceed max_len characters."""
        long_input = "a" * 1000
        result = sanitize(long_input, max_len=100)
        assert len(result) == 100

    def test_default_max_len_is_500(self):
        """Default max_len should be 500."""
        long_input = "x" * 1000
        result = sanitize(long_input)
        assert len(result) <= 500

    def test_normal_text_preserved(self):
        """Clean input text must pass through unchanged."""
        text = "Drove 20km to work in a petrol car"
        assert sanitize(text) == text

    def test_unicode_text_preserved(self):
        """Unicode (Indian city names etc.) must pass through."""
        text = "Chennai to Mumbai via NH48"
        result = sanitize(text)
        assert "Chennai" in result
        assert "Mumbai" in result

    def test_empty_string(self):
        """Empty string must return empty string."""
        assert sanitize("") == ""

    def test_whitespace_stripped(self):
        """Leading and trailing whitespace must be stripped."""
        result = sanitize("  hello world  ")
        assert result == "hello world"

    def test_nested_html_stripped(self):
        """Nested HTML tags must all be stripped."""
        result = sanitize("<div><p><b>inject</b></p></div>")
        assert "<" not in result
        assert ">" not in result
