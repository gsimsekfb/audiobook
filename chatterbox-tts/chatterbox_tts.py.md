
`chatterbox_tts.py` is a command-line tool for generating speech with Chatterbox Multilingual V3 from local model files.

- **Input:** Takes either `--text` or a UTF-8 `--file`.
- **Language and voice:** Requires a language ID such as `en`. You can optionally pass `--audio-prompt` with a reference audio clip to condition the voice; without one, it uses `conds.pt` if available.
- **Model loading:** Reads required weights and tokenizer files from `chatterbox-model` by default. It uses memory-conscious loading for the large T3 and S3Gen checkpoints and checks that their weights match the expected model.
- **Device:** `--device auto` selects CUDA if available, otherwise CPU. You can also explicitly request `cpu` or `cuda`.
- **Output:** Requires `--write-media` with a `.wav` or `.mp3` path, creates the output directory if needed, and writes mono audio. MP3 output uses `lameenc`; WAV uses `soundfile`.
- **Validation:** Reports errors for missing model files, unreadable or empty text, a missing reference clip, or an unavailable requested CUDA device.

For example, it can read text from a file, synthesize it in English using a reference clip, and save an MP3.

---------

## What happens each run

1. **`uv` prepares the Python environment.** It checks the requested Python version and dependencies, including Chatterbox from GitHub, `soundfile`, and `lameenc`.
2. **`uv` runs the script.** `--no-project` means it runs the local script without installing the audiobook repository as a Python package.
3. **The script checks the arguments and files.** It reads the text file, verifies the language, reference clip, model files, device, and output extension.
4. **It selects CPU.** Your `--device cpu` explicitly requests CPU inference.
5. **It loads the local model into memory.** The model weights and tokenizer are loaded from `chatterbox-model`; this happens on each successful run.
6. **It generates speech.** Chatterbox synthesizes the input text in English, conditioned on the reference audio clip.
7. **It writes the MP3.** The script creates the output folder if needed and saves the result to `.\output\my-test.mp3`.

## What is cached?

| Item | Cached between runs? |
|---|---|
| Python 3.11 and downloaded/built Python packages | **Yes.** `uv` caches these, so it usually reuses them rather than downloading and installing them again. |
| The Chatterbox model files in `.\chatterbox-model` | **Yes, on disk.** The script uses those local files; it does not download them each run. |
| The loaded model in memory | **No.** The script reloads model weights when started and releases them when it exits. |
| Supporting tokenizer/language resources | **Often.** Resources fetched by dependencies may be cached in your user profile after the first run. |
| Generated MP3 | **Saved on disk.** A later run using the same output path will write that path again. |

So, subsequent runs can skip most dependency downloads, but they still reload the model and perform generation each time. The script is `chatterbox_tts.py`.