from pathlib import Path
import re
import sys
import textwrap

# Normalize the input text by splitting it into page/paragraph blocks, merging
# wrapped lines, grouping sentences to a safe length, and wrapping long chunks
# into smaller blocks that are easier to read aloud without awkward pauses.
def normalize_text(text: str) -> str:
    pages = re.split(r"\n\s*\n", text.replace("\r\n", "\n"))
    paragraphs = []

    for page in pages:
        lines = [line.strip() for line in page.splitlines() if line.strip()]
        if lines:
            paragraph = lines[0]
            for line in lines[1:]:
                separator = "" if re.match(r"^[a-z](?:\s|$)", line) else " "
                paragraph += separator + line
            sentences = re.split(r"(?<=[.!?])\s+", paragraph)
            chunk = ""
            for sentence in sentences:
                if chunk and len(chunk) + len(sentence) + 1 > 3500:
                    paragraphs.append(chunk)
                    chunk = sentence
                else:
                    chunk = sentence if not chunk else f"{chunk} {sentence}"
            if chunk:
                paragraphs.append(chunk)

    chunks = []
    for paragraph in paragraphs:
        chunks.extend(textwrap.wrap(paragraph, width=3000, break_long_words=False, break_on_hyphens=False))

    return "\n\n".join(chunks) + "\n"


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: python prepare_text.py INPUT.txt OUTPUT.txt")

    source = Path(sys.argv[1])
    destination = Path(sys.argv[2])
    destination.write_text(normalize_text(source.read_text(encoding="utf-8")), encoding="utf-8")


if __name__ == "__main__":
    main()