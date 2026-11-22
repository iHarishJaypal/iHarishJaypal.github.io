#!/usr/bin/env python3
"""Small standard-library quality check for the static portfolio and PHP API."""
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]

class AssetParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.styles = []
        self.scripts = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "link" and attrs.get("rel") == "stylesheet":
            self.styles.append(attrs.get("href", ""))
        if tag == "script" and attrs.get("src"):
            self.scripts.append(attrs["src"])

def main():
    html_path = ROOT / "index.html"
    html = html_path.read_text(encoding="utf-8")
    parser = AssetParser()
    parser.feed(html)
    required = ["/assets/css/portfolio.css", "/assets/js/portfolio.js"]
    for asset in required:
        if asset not in parser.styles + parser.scripts:
            raise SystemExit(f"Missing asset reference: {asset}")
        if not (ROOT / asset.lstrip("/")).is_file():
            raise SystemExit(f"Missing asset file: {asset}")
    projects = json.loads((ROOT / "data/projects.json").read_text(encoding="utf-8"))
    if not isinstance(projects, list) or not projects:
        raise SystemExit("Project data must be a non-empty JSON array")
    if not (ROOT / "api/projects.php").is_file():
        raise SystemExit("Missing PHP projects API")
    if not re.search(r"<main\b", html, re.I) or not re.search(r"<footer\b", html, re.I):
        raise SystemExit("Semantic page landmarks are missing")
    print(f"OK: HTML, {len(required)} frontend assets, {len(projects)} project records, PHP API file")

if __name__ == "__main__":
    main()
