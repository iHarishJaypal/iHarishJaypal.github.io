#!/usr/bin/env python3
"""Validate the static portfolio structure and its supporting project data."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import json
import posixpath
import re

ROOT = Path(__file__).resolve().parents[1]


def normalize_asset_reference(value):
    """Normalize local HTML asset URLs for comparison with repository paths."""
    value = (value or "").strip()
    if not value:
        return ""
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc:
        return ""
    path = parsed.path
    if not path:
        return ""
    return posixpath.normpath(path.lstrip("/"))


class AssetParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.styles = []
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag.lower() == "link":
            rel_tokens = (attrs.get("rel") or "").lower().split()
            if "stylesheet" in rel_tokens:
                self.styles.append(attrs.get("href", ""))
        elif tag.lower() == "script" and attrs.get("src"):
            self.scripts.append(attrs["src"])


def main():
    html_path = ROOT / "index.html"
    if not html_path.is_file():
        raise SystemExit("Missing root index.html")

    html = html_path.read_text(encoding="utf-8")
    parser = AssetParser()
    parser.feed(html)

    references = {
        normalize_asset_reference(value)
        for value in parser.styles + parser.scripts
    }
    required = {
        "assets/css/portfolio.css": "stylesheet",
        "assets/js/portfolio.js": "JavaScript",
    }

    for asset, kind in required.items():
        if asset not in references:
            raise SystemExit(
                f"Missing {kind} reference in index.html: /{asset}"
            )
        if not (ROOT / asset).is_file():
            raise SystemExit(f"Referenced {kind} file does not exist: /{asset}")

    projects_path = ROOT / "data/projects.json"
    if not projects_path.is_file():
        raise SystemExit("Missing data/projects.json")
    projects = json.loads(projects_path.read_text(encoding="utf-8"))
    if not isinstance(projects, list) or not projects:
        raise SystemExit("Project data must be a non-empty JSON array")

    if not (ROOT / "api/projects.php").is_file():
        raise SystemExit("Missing PHP projects API")

    if not re.search(r"<main\b", html, re.I):
        raise SystemExit("Missing semantic <main> landmark")
    if not re.search(r"<footer\b", html, re.I):
        raise SystemExit("Missing semantic <footer> landmark")

    print(
        "OK: HTML landmarks, CSS/JS references and files, "
        f"{len(projects)} project records, PHP API file"
    )


if __name__ == "__main__":
    main()
