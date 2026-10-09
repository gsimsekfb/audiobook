# PDF to Natural-Voice Audiobook Research

Date: 2026-09-25  
Machine: Surface Pro 7, 16 GB RAM, Windows 11

## Short conclusion

Do not build a custom app for the first proof of concept. The goal is already
achievable with two small command-line tools:

1. `pypdf` extracts text from a text-based PDF.
2. `edge-tts` sends the text to Microsoft Edge's online neural TTS service and
   writes an MP3.

`edge-tts` can also create an MP3 from a paragraph in one command. A PDF needs
one extraction step first. Scanned/image-only PDFs are not covered because they
need OCR.

## TTS comparison

Ratings are subjective estimates for English audiobook narration, not
benchmarks. `10/10` means close to a professional natural narrator for normal
prose.

| Option | Stack | LLM-based? | Behind it | Naturalness | Architecture | Main tradeoff |
|---|---|---|---|---:|---|---|
| **Edge TTS** | Python package/CLI; online Microsoft Edge speech endpoint; MP3 output | No. It is neural TTS, not a generative text LLM. | `rany2` maintains the open-source `edge-tts` client; Microsoft provides the speech service and voices. | **9/10** | CLI or app -> `edge-tts` -> internet -> Microsoft Edge neural voice service -> MP3/SRT | Easiest and most natural here, but requires internet and depends on an unofficial client/service interface. |
| **Kokoro-82M** | Python; PyTorch-based `kokoro` pipeline; Misaki G2P; local model; WAV output in examples | No. It is an 82M-parameter StyleTTS2-derived TTS model. | Hexgrad project; model card credits StyleTTS2 by Li et al. and training by `rzvzn`. | **8/10** | App -> text normalization/G2P -> local Kokoro model -> waveform -> WAV/optional conversion | Offline and Apache-2.0 model, but larger setup and model/runtime downloads. |
| **Piper** | C++ core with Python CLI; espeak-ng phonemization; VITS voices exported to ONNX; WAV output | No. It is a neural VITS TTS engine, not an LLM. | Current development is under the Open Home Foundation (`OHF-Voice`); the older Rhasspy repository is archived. | **7/10** | App -> espeak-ng phonemizer -> local ONNX voice -> WAV | Fast, offline, and lightweight, but usually less natural than Edge/Kokoro and each voice has its own license. |

### Recommendation

Use **Edge TTS** for the MVP. It meets the natural-voice requirement with the
least code and works on Windows 11 or WSL2. Keep the TTS call behind one small
function so Kokoro or Piper can be added later if offline processing becomes a
hard requirement.

## Existing-tool check

### Text to audio

This works directly after installing `edge-tts`:

```powershell
edge-tts --voice en-US-AriaNeural --text "A short paragraph becomes an audiobook." --write-media output.mp3
```

The CLI also supports `--list-voices`, `--rate`, `--volume`, `--pitch`, and
`--write-subtitles`.

### PDF to audio

There is no need for a new application for a basic text PDF.   
Use `pypdf` to extract text, then pass the text file to `edge-tts`:  

```powershell
python -c "from pathlib import Path; from pypdf import PdfReader; Path('extracted.txt').write_text('\n'.join((p.extract_text() or '') for p in PdfReader('book.pdf').pages), encoding='utf-8')"

edge-tts --voice en-US-AriaNeural --file extracted.txt --write-media audiobook.mp3
```

For a real audiobook, a thin wrapper would eventually add page/text cleanup,
sentence-safe chunking, progress reporting, and concatenation of multiple TTS
outputs. Those are convenience and reliability features, not prerequisites for
the MVP pass test.

### Other existing tools

- Microsoft Edge's browser Read Aloud can read pages manually, but it is not a
  reliable batch PDF-to-MP3 export workflow.
- Piper has a complete local CLI, but requires downloading a voice model and
  writes WAV by default.
- Kokoro has a Python pipeline, but requires installing the model/runtime and
  an audio writer.
- `pypdf` only extracts embedded text. OCR is needed for scanned PDFs.

## Local validation performed

The following was installed in an isolated `.venv` under this folder:

- Python 3.12.13
- `edge-tts` 7.2.8
- `pypdf` 6.19.0

Results:

| Test | Result |
|---|---|
| One paragraph -> Edge neural MP3 | Passed; `sample-edge-aria.mp3` generated, 57,024 bytes |
| PDF -> extracted text | Passed; `sample-input.pdf` produced `Dummy PDF file` |
| Extracted text -> Edge neural MP3 | Passed; `sample-pdf.mp3` generated, 14,400 bytes |

Generated samples are included in this folder for listening and inspection:

- [sample-edge-aria.mp3](sample-edge-aria.mp3)
- [sample-pdf.mp3](sample-pdf.mp3)
- [sample-edge-aria.srt](sample-edge-aria.srt)
- [sample-pdf.srt](sample-pdf.srt)

## Sources

- [edge-tts project and CLI](https://github.com/rany2/edge-tts)
- [edge-tts on PyPI](https://pypi.org/project/edge-tts/)
- [Kokoro project](https://github.com/hexgrad/kokoro)
- [Kokoro model card](https://huggingface.co/hexgrad/Kokoro-82M)
- [Current Piper project](https://github.com/OHF-Voice/piper1-gpl)
- [Piper CLI documentation](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/CLI.md)
- [pypdf project](https://github.com/py-pdf/pypdf)
- [Piper voice samples](https://rhasspy.github.io/piper-samples/)