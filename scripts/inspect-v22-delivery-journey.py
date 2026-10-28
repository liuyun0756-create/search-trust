"""Read actual local browser downloads; never contacts a provider or customer."""
import argparse
import json
from pathlib import Path
from pypdf import PdfReader


def read_report(path):
    reader = PdfReader(path)
    pages = [" ".join(page.extract_text().split()) for page in reader.pages]
    if any(len(text) < 45 for text in pages):
        raise SystemExit(f"Empty report page: {path.name}")
    return " ".join(pages), len(pages)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    files = {}
    for name in ("owner-approved.pdf", "shared-approved.pdf", "zero-action-approved.pdf"):
        matches = list(args.directory.rglob(name))
        if len(matches) != 1:
            raise SystemExit(f"Expected one current download: {name}, got {len(matches)}")
        files[name] = read_report(matches[0])
    owner, shared, zero = (files[name][0] for name in files)
    if owner != shared:
        raise SystemExit("Owner and pinned shared PDF text differ")
    for expected in ("客户批准摘要：先核实急诊联系页面。", "Approved material: confirm the existing contact destination before publishing.", "The saved link label is Contact us."):
        if expected not in owner:
            raise SystemExit(f"Approved content or original evidence missing: {expected}")
    if "PRIVATE DRAFT" in shared:
        raise SystemExit("Later revision leaked into the original share")
    if "No action proposed" not in zero:
        raise SystemExit("Zero-action diagnosis did not reach the PDF")
    print(json.dumps({"ok": True, "owner_shared_text_equal": True, "downloads": [
        {"name": name, "pages": pages, "characters": len(text)} for name, (text, pages) in files.items()
    ]}))


if __name__ == "__main__":
    main()
