#!/usr/bin/env python3
"""Validate published Jekyll posts in _posts/ against blog publishing conventions."""

from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

POST_FILENAME_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$")
FENCE_OPEN_RE = re.compile(r"^( {0,3})(?P<fence>`{3,}|~{3,})(?P<info>.*)$")
ATX_HEADING_RE = re.compile(r"^(#{1,6})[ \t]+(\S.*)$")
MERMAID_INFO_RE = re.compile(r"^\s*mermaid\b", re.IGNORECASE)
LOCAL_LINK_RE = re.compile(r"""\[[^\]]*\]\((?P<url>/assets/[^)\s"']+)\)""")
HTML_SRC_RE = re.compile(
    r"""<(?:img|source|a)\b[^>]*\b(?:src|href)\s*=\s*["'](?P<url>/assets/[^"']+)["']""",
    re.IGNORECASE,
)
SKIP_NAMES = frozenset({"STYLE_GUIDE.md", "temp.md"})

DATE_FORMATS = (
    "%Y-%m-%d %H:%M:%S %z",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d",
)


@dataclass(frozen=True)
class Finding:
    level: str
    path: Path
    line: int | None
    rule: str
    message: str


@dataclass
class Post:
    path: Path
    front_matter: dict
    body: str
    body_start_line: int
    filename_date: str
    filename_slug: str


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def published_post_paths(posts_dir: Path) -> list[Path]:
    paths = []
    for path in sorted(posts_dir.glob("*.md")):
        if path.name in SKIP_NAMES:
            continue
        if not POST_FILENAME_RE.match(path.name):
            continue
        paths.append(path)
    return paths


def parse_front_matter_block(raw: str) -> dict:
    """Parse the small YAML subset used by this corpus (scalars + one-level maps)."""
    data: dict = {}
    current_map: str | None = None
    for line in raw.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip(" "))
        stripped = line.strip()
        if indent >= 2 and current_map is not None:
            key, _, value = stripped.partition(":")
            if not _:
                continue
            nested = data.setdefault(current_map, {})
            if not isinstance(nested, dict):
                nested = {}
                data[current_map] = nested
            nested[key.strip()] = _scalar(value)
            continue
        key, _, value = stripped.partition(":")
        if not _:
            continue
        key = key.strip()
        value = value.strip()
        if value == "":
            current_map = key
            data[key] = {}
            continue
        current_map = None
        data[key] = _scalar(value)
    return data


def _scalar(raw: str):
    value = raw.strip()
    if value.startswith("#"):
        return ""
    if " #" in value and not (value.startswith('"') or value.startswith("'")):
        value = value.split(" #", 1)[0].strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    lowered = value.lower()
    if lowered == "true":
        return True
    if lowered == "false":
        return False
    return value


def split_document(text: str) -> tuple[dict, str, int]:
    if not text.startswith("---"):
        raise ValueError("missing YAML front matter")
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError("missing YAML front matter")
    end = None
    for index, line in enumerate(lines[1:], start=2):
        if line.strip() == "---":
            end = index
            break
    if end is None:
        raise ValueError("unclosed YAML front matter")
    fm_raw = "\n".join(lines[1 : end - 1])
    body = "\n".join(lines[end:])
    return parse_front_matter_block(fm_raw), body, end + 1


def load_post(path: Path) -> Post:
    match = POST_FILENAME_RE.match(path.name)
    if match is None:
        raise ValueError(f"not a dated post filename: {path.name}")
    year, month, day, slug = match.groups()
    front_matter, body, body_start = split_document(path.read_text(encoding="utf-8"))
    return Post(
        path=path,
        front_matter=front_matter,
        body=body,
        body_start_line=body_start,
        filename_date=f"{year}-{month}-{day}",
        filename_slug=slug,
    )


def iter_unfenced_lines(body: str, start_line: int):
    """Yield (lineno, line) for lines outside fenced code blocks."""
    fence = None
    for offset, line in enumerate(body.splitlines()):
        lineno = start_line + offset
        opened = FENCE_OPEN_RE.match(line)
        if fence is None:
            if opened:
                fence = opened.group("fence")[0]
                continue
            yield lineno, line
            continue
        if opened and opened.group("fence")[0] == fence and not opened.group("info").strip():
            fence = None


def mermaid_block_lines(body: str, start_line: int) -> list[int]:
    lines = []
    fence = None
    for offset, line in enumerate(body.splitlines()):
        lineno = start_line + offset
        opened = FENCE_OPEN_RE.match(line)
        if fence is None:
            if opened and MERMAID_INFO_RE.match(opened.group("info") or ""):
                lines.append(lineno)
                fence = opened.group("fence")[0]
            elif opened:
                fence = opened.group("fence")[0]
            continue
        if opened and opened.group("fence")[0] == fence and not opened.group("info").strip():
            fence = None
    return lines


def strip_inline_code(line: str) -> str:
    """Replace inline `code` spans with spaces so $ and # inside them are ignored."""
    chars = list(line)
    in_code = False
    i = 0
    while i < len(chars):
        if chars[i] == "`":
            in_code = not in_code
            chars[i] = " "
            i += 1
            continue
        if in_code:
            chars[i] = " " if chars[i] != "\t" else "\t"
        i += 1
    return "".join(chars)


def heading_findings(post: Post) -> list[Finding]:
    findings: list[Finding] = []
    headings: list[tuple[int, int]] = []
    for lineno, line in iter_unfenced_lines(post.body, post.body_start_line):
        probe = strip_inline_code(line)
        match = ATX_HEADING_RE.match(probe)
        if not match:
            continue
        level = len(match.group(1))
        headings.append((lineno, level))
        if level >= 5:
            findings.append(
                Finding(
                    "ERROR",
                    post.path,
                    lineno,
                    "heading-h5-h6",
                    f"H{level} is not part of the article heading convention",
                )
            )
        if level == 1:
            findings.append(
                Finding(
                    "ERROR",
                    post.path,
                    lineno,
                    "heading-h1",
                    "body must not contain Markdown H1; the layout supplies the title",
                )
            )
    if not headings:
        return findings
    first_line, first_level = headings[0]
    if first_level != 2:
        findings.append(
            Finding(
                "ERROR",
                post.path,
                first_line,
                "heading-first-h2",
                f"first body heading is H{first_level}, expected H2",
            )
        )
    previous = 1
    for lineno, level in headings:
        if level > previous + 1:
            findings.append(
                Finding(
                    "ERROR",
                    post.path,
                    lineno,
                    "heading-skip",
                    f"skipped heading level: H{previous} followed by H{level}",
                )
            )
        if level == 3 and previous < 2:
            findings.append(
                Finding(
                    "ERROR",
                    post.path,
                    lineno,
                    "heading-h3-context",
                    "H3 requires a preceding H2",
                )
            )
        if level == 4 and previous < 3:
            findings.append(
                Finding(
                    "ERROR",
                    post.path,
                    lineno,
                    "heading-h4-context",
                    "H4 requires a preceding H3",
                )
            )
        previous = level
    return findings


def _is_currency_span(content: str) -> bool:
    return bool(re.match(r"^~?\d[\d.,]*$", content.strip()))


def _is_math_opener(probe: str, index: int) -> bool:
    """$ followed by a digit is treated as currency, not a TeX delimiter."""
    nxt = probe[index + 1 : index + 2]
    return nxt not in {"", ".", ")", "]"} and not nxt.isdigit()


def _is_genuine_math_span(content: str) -> bool:
    text = content.strip()
    if not text or _is_currency_span(text):
        return False
    if re.search(r"\\[A-Za-z]", text):
        return True
    if any(token in text for token in ("_", "^", "{", "}")):
        return True
    if re.search(r"[=<>≤≥∈·±]|O\(|P_\{", text):
        return True
    if re.fullmatch(r"[A-Za-z](?:\([^)]*\))?", text):
        return True
    if re.fullmatch(r"[A-Za-z]=\d+(?:\.\d+)?", text):
        return True
    if re.fullmatch(r"\[[^\]]+\]", text):
        return True
    return False


def math_findings(post: Post) -> tuple[list[Finding], bool, list[Finding]]:
    """Return (errors, has_genuine_math, warnings)."""
    errors: list[Finding] = []
    warnings: list[Finding] = []
    genuine = False
    genuine_line: int | None = None
    flagged = post.front_matter.get("math") is True
    in_display = False

    for lineno, line in iter_unfenced_lines(post.body, post.body_start_line):
        probe = strip_inline_code(line).replace("\\$", "  ")
        if in_display:
            genuine = True
            genuine_line = genuine_line or lineno
            if "$$" in probe:
                in_display = False
                probe = probe.replace("$$", "  ", 1)
            else:
                continue
        while True:
            start = probe.find("$$")
            if start == -1:
                break
            rest = probe[start + 2 :]
            end = rest.find("$$")
            if end == -1:
                in_display = True
                genuine = True
                genuine_line = lineno
                probe = probe[:start]
                break
            genuine = True
            genuine_line = genuine_line or lineno
            probe = probe[:start] + " " * (end + 4) + rest[end + 2 :]

        i = 0
        while i < len(probe):
            if probe[i] != "$" or not _is_math_opener(probe, i):
                i += 1
                continue
            close = probe.find("$", i + 1)
            if close == -1:
                remainder = probe[i + 1 :].lstrip()
                placeholder = bool(re.match(r"^[A-Za-z](?:\s|$|[.,;:'\"])", remainder))
                if remainder and not remainder[:1].isdigit() and not placeholder:
                    warnings.append(
                        Finding(
                            "WARNING",
                            post.path,
                            lineno,
                            "math-unpaired-dollar",
                            "unpaired $ outside code; check for missing math delimiters",
                        )
                    )
                break
            content = probe[i + 1 : close]
            if "|" in content:
                i = close
                continue
            if _is_genuine_math_span(content):
                genuine = True
                genuine_line = genuine_line or lineno
            elif content.strip() and not _is_currency_span(content):
                warnings.append(
                    Finding(
                        "WARNING",
                        post.path,
                        lineno,
                        "math-ambiguous-dollar",
                        f"dollar span ${content}$ is not classified as TeX math",
                    )
                )
            i = close + 1

    if genuine and not flagged:
        errors.append(
            Finding(
                "ERROR",
                post.path,
                genuine_line,
                "math-flag-missing",
                "article contains TeX math but front matter does not set math: true",
            )
        )
    if flagged and not genuine:
        errors.append(
            Finding(
                "ERROR",
                post.path,
                None,
                "math-flag-unused",
                "math: true is set but no genuine TeX math was found outside code",
            )
        )
    return errors, genuine, warnings


def mermaid_enabled(front_matter: dict) -> bool:
    value = front_matter.get("mermaid")
    if isinstance(value, dict):
        return value.get("enabled") is True
    return False


def mermaid_findings(post: Post) -> tuple[list[Finding], bool]:
    blocks = mermaid_block_lines(post.body, post.body_start_line)
    enabled = mermaid_enabled(post.front_matter)
    findings: list[Finding] = []
    if blocks and not enabled:
        findings.append(
            Finding(
                "ERROR",
                post.path,
                blocks[0],
                "mermaid-flag-missing",
                "Mermaid fence present but mermaid.enabled is not true",
            )
        )
    if enabled and not blocks:
        findings.append(
            Finding(
                "ERROR",
                post.path,
                None,
                "mermaid-flag-unused",
                "mermaid.enabled is true but no ```mermaid fence was found",
            )
        )
    return findings, bool(blocks)


def asset_findings(post: Post, root: Path) -> list[Finding]:
    findings: list[Finding] = []
    seen: set[tuple[int, str]] = set()
    for lineno, line in iter_unfenced_lines(post.body, post.body_start_line):
        urls = [match.group("url") for match in LOCAL_LINK_RE.finditer(line)]
        urls.extend(match.group("url") for match in HTML_SRC_RE.finditer(line))
        for url in urls:
            key = (lineno, url)
            if key in seen:
                continue
            seen.add(key)
            if url.startswith(("http://", "https://", "{{")):
                continue
            relative = url.lstrip("/")
            target = root / relative
            if not target.is_file():
                findings.append(
                    Finding(
                        "ERROR",
                        post.path,
                        lineno,
                        "asset-missing",
                        f"local asset does not exist: {url}",
                    )
                )
    return findings


def parse_date(value: object) -> dt.datetime | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    for fmt in DATE_FORMATS:
        try:
            return dt.datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def front_matter_findings(post: Post) -> list[Finding]:
    findings: list[Finding] = []
    fm = post.front_matter
    title = fm.get("title")
    if not isinstance(title, str) or not title.strip():
        findings.append(
            Finding("ERROR", post.path, 1, "front-matter-title", "title is missing or empty")
        )
    description = fm.get("description")
    if not isinstance(description, str) or not description.strip():
        findings.append(
            Finding(
                "ERROR",
                post.path,
                1,
                "front-matter-description",
                "description is missing or empty",
            )
        )
    parsed = parse_date(fm.get("date"))
    if parsed is None:
        findings.append(
            Finding(
                "ERROR",
                post.path,
                1,
                "front-matter-date",
                "date is missing or not a Jekyll-style timestamp",
            )
        )
    if "layout" in fm:
        findings.append(
            Finding(
                "ERROR",
                post.path,
                1,
                "front-matter-layout",
                "do not set layout: on posts; _config.yml supplies layout: post",
            )
        )
    return findings


def description_warnings(post: Post) -> list[Finding]:
    description = post.front_matter.get("description")
    if not isinstance(description, str) or not description.strip():
        return []
    text = description.strip()
    words = text.split()
    findings: list[Finding] = []
    if len(words) < 10:
        findings.append(
            Finding(
                "WARNING",
                post.path,
                3,
                "description-short",
                f"description has {len(words)} words (soft minimum 10)",
            )
        )
    if len(words) > 35:
        findings.append(
            Finding(
                "WARNING",
                post.path,
                3,
                "description-long-words",
                f"description has {len(words)} words (soft maximum 35)",
            )
        )
    if len(text) > 180:
        findings.append(
            Finding(
                "WARNING",
                post.path,
                3,
                "description-long-chars",
                f"description is {len(text)} characters (soft maximum 180)",
            )
        )
    title = post.front_matter.get("title")
    if isinstance(title, str) and _normalize_phrase(title) == _normalize_phrase(text):
        findings.append(
            Finding(
                "WARNING",
                post.path,
                3,
                "description-repeats-title",
                "description is identical to title after normalization",
            )
        )
    return findings


def _normalize_phrase(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def permalink_path(post: Post) -> str:
    parsed = parse_date(post.front_matter.get("date"))
    year = parsed.year if parsed else int(post.filename_date[:4])
    slug = post.front_matter.get("slug")
    if not isinstance(slug, str) or not slug.strip():
        slug = post.filename_slug
    return f"/blog/{year}/{slug}/"


def collision_findings(posts: list[Post]) -> list[Finding]:
    by_path: dict[str, list[Post]] = defaultdict(list)
    for post in posts:
        by_path[permalink_path(post)].append(post)
    findings: list[Finding] = []
    for url, group in sorted(by_path.items()):
        if len(group) < 2:
            continue
        names = ", ".join(item.path.name for item in group)
        for post in group:
            findings.append(
                Finding(
                    "ERROR",
                    post.path,
                    None,
                    "permalink-collision",
                    f"duplicate permalink {url} also produced by {names}",
                )
            )
    return findings


def format_finding(finding: Finding, root: Path | None = None) -> str:
    path = finding.path
    if root is not None:
        try:
            path = path.relative_to(root)
        except ValueError:
            pass
    location = path.as_posix()
    if finding.line is not None:
        location = f"{location}:{finding.line}"
    return f"  {location}  {finding.rule}  {finding.message}"


def validate_posts(root: Path) -> tuple[list[Finding], dict]:
    posts_dir = root / "_posts"
    paths = published_post_paths(posts_dir)
    findings: list[Finding] = []
    posts: list[Post] = []
    math_count = 0
    mermaid_count = 0
    for path in paths:
        try:
            post = load_post(path)
        except ValueError as exc:
            findings.append(Finding("ERROR", path, 1, "front-matter-parse", str(exc)))
            continue
        posts.append(post)
        findings.extend(front_matter_findings(post))
        findings.extend(heading_findings(post))
        math_errors, has_math, math_warnings = math_findings(post)
        findings.extend(math_errors)
        findings.extend(math_warnings)
        if has_math:
            math_count += 1
        mermaid_errors, has_mermaid = mermaid_findings(post)
        findings.extend(mermaid_errors)
        if has_mermaid:
            mermaid_count += 1
        findings.extend(asset_findings(post, root))
        findings.extend(description_warnings(post))
    findings.extend(collision_findings(posts))
    stats = {
        "published": len(paths),
        "loaded": len(posts),
        "math": math_count,
        "mermaid": mermaid_count,
    }
    return findings, stats


def print_report(findings: list[Finding], stats: dict, root: Path | None = None) -> int:
    errors = [item for item in findings if item.level == "ERROR"]
    warnings = [item for item in findings if item.level == "WARNING"]
    print(f"Validated {stats['published']} published posts.")
    print()
    print(f"Errors:   {len(errors)}")
    print(f"Warnings: {len(warnings)}")
    print(f"Math posts:    {stats['math']}")
    print(f"Mermaid posts: {stats['mermaid']}")
    if errors:
        print()
        print("Errors:")
        for item in errors:
            print(format_finding(item, root))
    if warnings:
        print()
        print("Warnings:")
        for item in warnings:
            print(format_finding(item, root))
    return 1 if errors else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=repo_root(),
        help="repository root (default: parent of scripts/)",
    )
    args = parser.parse_args(argv)
    try:
        root = args.root.resolve()
        findings, stats = validate_posts(root)
    except OSError as exc:
        print(f"ERROR  io  {exc}", file=sys.stderr)
        return 2
    return print_report(findings, stats, root)


if __name__ == "__main__":
    sys.exit(main())
