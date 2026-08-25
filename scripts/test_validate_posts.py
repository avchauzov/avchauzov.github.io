#!/usr/bin/env python3
"""Unit checks for scripts/validate_posts.py detectors."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from textwrap import dedent

sys.path.insert(0, str(Path(__file__).resolve().parent))
import validate_posts as vp


def _write_post(root: Path, name: str, text: str) -> Path:
    posts = root / "_posts"
    posts.mkdir(parents=True, exist_ok=True)
    path = posts / name
    path.write_text(dedent(text).lstrip(), encoding="utf-8")
    return path


def _fm(body: str, extra: str = "") -> str:
    return (
        "---\n"
        'title: "Sample title"\n'
        'description: "Ten word description used for validator unit tests here."\n'
        "date: 2025-01-01 00:00:00 +0000\n"
        f"{extra}"
        "---\n"
        f"{body}\n"
    )


class FrontMatterTests(unittest.TestCase):
    def test_requires_title_description_date(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_post(
                root,
                "2025-01-01-missing.md",
                "---\ntitle: \"x\"\ndate: 2025-01-01 00:00:00 +0000\n---\n\n## Hello\n",
            )
            findings, _ = vp.validate_posts(root)
            rules = {item.rule for item in findings if item.level == "ERROR"}
            self.assertIn("front-matter-description", rules)

    def test_rejects_explicit_layout(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_post(
                root,
                "2025-01-01-layout.md",
                _fm("## Hello\n", extra="layout: post\n"),
            )
            findings, _ = vp.validate_posts(root)
            self.assertTrue(any(item.rule == "front-matter-layout" for item in findings))


class HeadingTests(unittest.TestCase):
    def test_body_h1_is_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_post(root, "2025-01-01-h1.md", _fm("# Title\n"))
            findings, _ = vp.validate_posts(root)
            self.assertTrue(any(item.rule == "heading-h1" for item in findings))

    def test_fenced_hash_is_not_a_heading(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_post(
                root,
                "2025-01-01-fence.md",
                _fm("## Real\n\n```python\n# Alert if timeout\n```\n"),
            )
            findings, _ = vp.validate_posts(root)
            heading_errors = [
                item
                for item in findings
                if item.level == "ERROR" and item.rule.startswith("heading-")
            ]
            self.assertEqual(heading_errors, [])

    def test_skip_from_h2_to_h4_is_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_post(root, "2025-01-01-skip.md", _fm("## Real\n\n#### Too deep\n"))
            findings, _ = vp.validate_posts(root)
            rules = {item.rule for item in findings if item.level == "ERROR"}
            self.assertIn("heading-skip", rules)


class MathTests(unittest.TestCase):
    def test_tex_requires_math_flag(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_post(root, "2025-01-01-tex.md", _fm("Latency $P_{95}$ is high.\n"))
            findings, stats = vp.validate_posts(root)
            self.assertEqual(stats["math"], 1)
            self.assertTrue(any(item.rule == "math-flag-missing" for item in findings))

    def test_currency_is_not_math(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_post(root, "2025-01-01-cash.md", _fm("Cost is $0.12 per call.\n"))
            findings, stats = vp.validate_posts(root)
            self.assertEqual(stats["math"], 0)
            self.assertFalse(any(item.rule.startswith("math-flag") for item in findings))

    def test_interval_is_math(self) -> None:
        self.assertTrue(vp._is_genuine_math_span("[0, 1]"))

    def test_currency_span_not_math(self) -> None:
        self.assertFalse(vp._is_genuine_math_span("0.12"))
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_post(root, "2025-01-01-mtok.md", _fm("Judge costs \\$6/MTok (\\$0.012).\n"))
            _, stats = vp.validate_posts(root)
            self.assertEqual(stats["math"], 0)


class MermaidTests(unittest.TestCase):
    def test_mermaid_fence_requires_flag(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_post(
                root,
                "2025-01-01-diagram.md",
                _fm("## Flow\n\n```mermaid\nflowchart LR\nA-->B\n```\n"),
            )
            findings, _ = vp.validate_posts(root)
            self.assertTrue(any(item.rule == "mermaid-flag-missing" for item in findings))


class AssetTests(unittest.TestCase):
    def test_missing_local_asset_is_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_post(
                root,
                "2025-01-01-img.md",
                _fm("## Photo\n\n![x](/assets/img/missing.png)\n"),
            )
            findings, _ = vp.validate_posts(root)
            self.assertTrue(any(item.rule == "asset-missing" for item in findings))


class PermalinkTests(unittest.TestCase):
    def test_duplicate_slug_same_year_collides(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_post(root, "2025-01-01-same.md", _fm("## One\n"))
            _write_post(root, "2025-06-02-same.md", _fm("## Two\n"))
            findings, _ = vp.validate_posts(root)
            self.assertTrue(any(item.rule == "permalink-collision" for item in findings))


if __name__ == "__main__":
    unittest.main()
