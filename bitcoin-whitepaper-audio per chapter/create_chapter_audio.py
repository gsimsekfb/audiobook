from pathlib import Path
import argparse
import re
import subprocess
import sys
import textwrap

from pypdf import PdfReader


CHAPTER_HEADING = re.compile(r"(?im)^\s*(?:Abstract\.|\d+\.\s+[^\n]+)")


# Turn chapter text into a cleaner stream of paragraphs and sentence chunks
# that edge-tts can read aloud without awkward line breaks or oversized blocks.
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


# Find the chapter headings in the extracted PDF text and group each heading
# with the text that follows it so each chapter can be processed independently.
def split_chapters(text: str) -> list[tuple[str, str]]:
    matches = list(CHAPTER_HEADING.finditer(text))
    if not matches or matches[0].group().strip().lower().rstrip(".") != "abstract":
        raise ValueError("input does not start with an Abstract heading")

    chapters = []
    for index, match in enumerate(matches):
        title = match.group().strip().rstrip(".").strip()
        body_end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        body = text[match.end():body_end].strip()
        chapters.append((title, f"{title}.\n\n{body}"))
    return chapters


# Convert a chapter title into a filename-safe slug so output files are
# predictable, lowercase, and free of punctuation or whitespace issues.
def chapter_filename(title: str) -> str:
    name = re.sub(r"^\d+\.\s*", "", title.lower())
    name = re.sub(r"[^a-z0-9]+", "-", name).strip("-")
    return name or "chapter"


# Entry point: read the PDF, split it into chapter sections, normalize the text,
# and generate the matching text, audio files for each chapter.
def main() -> None:
    parser = argparse.ArgumentParser(description="Create one MP3  per PDF chapter.")
    parser.add_argument("pdf", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--pages", type=int, help="Only read the first N PDF pages.")
    parser.add_argument("--skip-chapters", type=int, default=0, help="Skip the first N detected chapters.")
    parser.add_argument("--max-chapters", type=int, help="Only create the first N detected chapters.")
    parser.add_argument("--voice", default="en-US-EricNeural")
    args = parser.parse_args()

    pages = PdfReader(str(args.pdf)).pages
    if args.pages is not None:
        pages = pages[:args.pages]
    source_text = "\n\n".join((page.extract_text() or "").strip() for page in pages)

    args.output.mkdir(parents=True, exist_ok=True)
    chapters = split_chapters(source_text)
    chapters = chapters[args.skip_chapters:]
    if args.max_chapters is not None:
        chapters = chapters[:args.max_chapters]

    for title, chapter_text in chapters:
        filename = chapter_filename(title)
        text_path = args.output / f"{filename}.txt"
        audio_path = args.output / f"{filename}.mp3"
        text_path.write_text(normalize_text(chapter_text), encoding="utf-8")
        subprocess.run(
            [
                sys.executable,
                "-m",
                "edge_tts",
                "--voice",
                args.voice,
                "--file",
                str(text_path),
                "--write-media",
                str(audio_path),
            ],
            check=True,
        )
        print(f"created {audio_path}")


if __name__ == "__main__":
    main()