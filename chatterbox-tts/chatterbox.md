# Chatterbox Multilingual V3

Chatterbox Multilingual V3 is a local 500M-parameter speech model supporting
23 languages. It is available alongside Kokoro through `chatterbox_tts.py`.
Like Kokoro, its model files are downloaded manually and loaded from a local
directory; the CLI does not automatically download model weights.


## Blocking issue

``` 
PS C:\code\audiobook> uv run --python 3.11 --with "chatterbox-tts @ git+https://github.com/resemble-ai/chatterbox.git" --with soundfile --with lameenc --no-project .\chatterbox_tts.py --language en --file '.\ethereum.org foundationals\data files\10.3-Nodes as a service.txt' --audio-prompt ".\ethereum.org foundationals\10.3-Nodes as a service.mp3" --write-media ".\output\my-test.mp3" --device cpu
``` 
``` 
Sampling: 100%|████████████████████████████| 1000/1000 [12:17<00:00,  1.36it/s]
Created output\my-test.mp3
``` 
===

Issue:  
- This cmd created an unknown language audio file 625 KB
- 40sec capped output

Root cause:  
- It hit Chatterbox’s 1,000-token limit while processing the whole article at once, so the output was likely truncated or garbled. The `en` language setting and input text were English.

- It’s a safety cap so generation can’t run indefinitely. Chatterbox stops earlier if it emits its end token; your log shows it hit the cap, likely cutting off the long article.


Possible Solution:  
- The current command has no option to raise the cap. We can split long text into smaller chunks, or modify Chatterbox’s hard-coded limit; chunking is the more reliable approach.

## Isolated setup on Windows

Keep Chatterbox in its own Python 3.11 environment so its PyTorch dependencies
do not change the existing Kokoro setup. Install Python 3.11 if it is not
already available through the Windows Python launcher, then run from the
repository root in PowerShell:

```powershell
py -3.11 -m venv .chatterbox-venv
.\.chatterbox-venv\Scripts\python.exe -m pip install --upgrade pip
.\.chatterbox-venv\Scripts\python.exe -m pip install "chatterbox-tts @ git+https://github.com/resemble-ai/chatterbox.git" soundfile lameenc
```

Install Chatterbox from its GitHub source: the published PyPI package currently
does not expose the multilingual V3 loader option.

The upstream project documents Python 3.11 and says it was developed and tested
on Debian 11. Windows compatibility and performance depend on the local
PyTorch build and hardware. CPU inference is supported but may be slow; `auto`
uses CUDA if PyTorch reports it available, otherwise CPU. For CUDA, install a
PyTorch build compatible with the installed NVIDIA driver using the official
[PyTorch installation selector](https://pytorch.org/get-started/locally/).

## Manually download the model files

Create `chatterbox-model` in the repository root, then download these files from
the official [Chatterbox model repository](https://huggingface.co/ResembleAI/chatterbox/tree/main)
into that folder:

- `ve.pt`
- `s3gen_v3.pt` (rename the downloaded file to `s3gen.pt`)
- `t3_mtl23ls_v3.safetensors`
- `grapheme_mtl_merged_expanded_v1.json`
- `conds.pt` (optional built-in voice)

The current model repository provides `s3gen_v3.pt` as the V3 S3Gen checkpoint.
The current [upstream loader](https://github.com/resemble-ai/chatterbox/blob/master/src/chatterbox/mtl_tts.py)
still looks for the filename `s3gen.pt`, so rename the downloaded V3 checkpoint
to `s3gen.pt` after downloading it. The CLI expects that local filename. The V3
model and tokenizer also require `ve.pt`, `t3_mtl23ls_v3.safetensors`, and
`grapheme_mtl_merged_expanded_v1.json`. `conds.pt` contains the repository's
built-in speaker conditioning and lets you synthesize without providing your
own voice prompt. Chatterbox does not have a Kokoro-style multi-voice `.bin`
file: for another voice, pass a local reference-audio clip with
`--audio-prompt`. Do not add these large downloaded files to Git; the
`chatterbox-model` folder is ignored. The V3 generator weights were added in
this [model repository commit](https://huggingface.co/ResembleAI/chatterbox/commit/5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18).

The upstream multilingual tokenizer also attempts to obtain the small
`Cangjie5_TC.json` mapping from Hugging Face for Chinese tokenization (it is
separate from the model weights). The model itself is loaded locally; on a
first run, that tokenizer mapping may still be fetched/cached by the upstream
library.

## Run with uv (optional)

`uvx` is aimed at running package-provided commands (as with `edge-tts`). Since
`chatterbox_tts.py` is a local script, use `uv run` to create/reuse an isolated
environment for it instead of installing a separate virtual environment:

```powershell
// working cmd
uv run --python 3.11 --with "chatterbox-tts @ git+https://github.com/resemble-ai/chatterbox.git" --with soundfile --with lameenc --no-project .\chatterbox-tts\chatterbox_tts.py --language en --text "The Ethereum Virtual Machine, or EVM, is a decentralized virtual environment"  --audio-prompt ".\ethereum.org foundationals\10.3-Nodes as a service.mp3" --write-media ".\chatterbox-test-audio-evm.mp3" --device cpu
```

```powershell
uv run --python 3.11 --with "chatterbox-tts @ git+https://github.com/resemble-ai/chatterbox.git" --with soundfile --with lameenc --no-project .\chatterbox_tts.py --language en --file .\chapter.txt --write-media .\chapter.mp3
```

uv downloads/resolves the Python dependencies into its cache on first use. The
manually downloaded model files remain in `.\chatterbox-model`. This does not
make model loading or inference lighter; on this Surface Pro 7, CPU inference
will still be slow.

## Usage

Specify the language ID for every request. A reference audio file is optional;
when supplied, it is used to condition the generated speaker voice.

```powershell
.\.chatterbox-venv\Scripts\python.exe .\chatterbox_tts.py --language en --text "A short paragraph." --write-media .\output.wav
.\.chatterbox-venv\Scripts\python.exe .\chatterbox_tts.py --language tr --file .\chapter.txt --audio-prompt .\reference.wav --write-media .\chapter.mp3
```

Use `--model-dir` to load a model folder stored elsewhere. Without
`--audio-prompt`, the model folder must include `conds.pt`.

Supported language IDs: `ar`, `da`, `de`, `el`, `en`, `es`, `fi`, `fr`, `he`,
`hi`, `it`, `ja`, `ko`, `ms`, `nl`, `no`, `pl`, `pt`, `ru`, `sv`, `sw`, `tr`,
and `zh`.

Use `--device cpu` or `--device cuda` to select a device explicitly. If CUDA is
requested but unavailable, the command reports an error. `--write-media` accepts
`.wav` and `.mp3`; `--file` reads UTF-8 text. The script forwards the text as
read and does not edit the input file. Chatterbox applies its own text
normalization internally during synthesis.

Reference audio is useful for speaker conditioning; use a clear clip with
permission to use that speaker's voice. Large chapters may take a long time and
are sent to the model as a single request, like Kokoro's current CLI; for
reliable narration, start with a short passage and split large books into
manageable sections.

## Upstream references

- [Chatterbox repository](https://github.com/resemble-ai/chatterbox)
- [Chatterbox model card](https://huggingface.co/ResembleAI/chatterbox)
- [Chatterbox demo samples](https://resemble-ai.github.io/chatterbox_demopage/)
