import argparse
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DEFAULT_MODEL_DIR = ROOT / "chatterbox-model"
REQUIRED_MODEL_FILES = (
    "ve.pt",
    "s3gen.pt",
    "t3_mtl23ls_v3.safetensors",
    "grapheme_mtl_merged_expanded_v1.json",
)
NON_PERSISTENT_S3GEN_BUFFERS = {
    "tokenizer._mel_filters",
    "tokenizer.window",
}

LANGUAGES = (
    "ar", "da", "de", "el", "en", "es", "fi", "fr", "he", "hi", "it", "ja",
    "ko", "ms", "nl", "no", "pl", "pt", "ru", "sv", "sw", "tr", "zh",
)


def load_local_model(model_dir: Path, device: str):
    import torch
    from chatterbox.mtl_tts import (
        ChatterboxMultilingualTTS,
        Conditionals,
        MTLTokenizer,
        S3Gen,
        T3,
        T3Config,
        VoiceEncoder,
    )
    from safetensors.torch import load_file

    map_location = torch.device("cpu")

    voice_encoder = VoiceEncoder()
    voice_encoder.load_state_dict(
        torch.load(
            model_dir / "ve.pt",
            map_location=map_location,
            weights_only=True,
        )
    )
    voice_encoder.to(device).eval()

    # Avoid holding both randomly initialized T3 weights and the 2+ GB checkpoint.
    with torch.device("meta"):
        t3 = T3(T3Config.multilingual())
    t3_state = load_file(str(model_dir / "t3_mtl23ls_v3.safetensors"))
    if "model" in t3_state:
        t3_state = t3_state["model"][0]
    t3.load_state_dict(t3_state, assign=True)
    del t3_state
    rotary = t3.tfmr.rotary_emb
    if rotary.inv_freq.is_meta:
        from transformers.models.llama.modeling_llama import ROPE_INIT_FUNCTIONS

        inv_freq, rotary.attention_scaling = ROPE_INIT_FUNCTIONS[
            rotary.rope_type
        ](rotary.config, device=map_location)
        rotary.inv_freq = inv_freq
        rotary.original_inv_freq = inv_freq.clone()
    t3.to(device).eval()

    s3gen = S3Gen()
    s3gen_state = torch.load(
        model_dir / "s3gen.pt",
        map_location=map_location,
        weights_only=True,
        mmap=True,
    )
    s3gen_result = s3gen.load_state_dict(
        s3gen_state,
        assign=True,
        strict=False,
    )
    del s3gen_state
    if (
        s3gen_result.unexpected_keys
        or not set(s3gen_result.missing_keys).issubset(NON_PERSISTENT_S3GEN_BUFFERS)
    ):
        raise RuntimeError(
            "S3Gen checkpoint keys do not match the installed Chatterbox model: "
            f"missing={s3gen_result.missing_keys}, "
            f"unexpected={s3gen_result.unexpected_keys}"
        )
    s3gen.to(device).eval()

    tokenizer = MTLTokenizer(
        str(model_dir / "grapheme_mtl_merged_expanded_v1.json")
    )
    conds = None
    builtin_voice = model_dir / "conds.pt"
    if builtin_voice.is_file():
        conds = Conditionals.load(builtin_voice, map_location=map_location).to(device)

    return ChatterboxMultilingualTTS(
        t3,
        s3gen,
        voice_encoder,
        tokenizer,
        device,
        conds=conds,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate speech with Chatterbox Multilingual V3."
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--text", help="Text to synthesize.")
    source.add_argument("--file", type=Path, help="UTF-8 text file to synthesize.")
    parser.add_argument(
        "--language",
        required=True,
        choices=LANGUAGES,
        help="Language ID for the text (for example: en, tr, fr).",
    )
    parser.add_argument(
        "--audio-prompt",
        type=Path,
        help="Optional reference audio file for voice conditioning.",
    )
    parser.add_argument(
        "--model-dir",
        type=Path,
        default=DEFAULT_MODEL_DIR,
        help=f"Directory containing manually downloaded V3 files (default: {DEFAULT_MODEL_DIR}).",
    )
    parser.add_argument(
        "--device",
        choices=("auto", "cpu", "cuda"),
        default="auto",
        help="Inference device (default: CUDA when available, otherwise CPU).",
    )
    parser.add_argument("--write-media", required=True, type=Path)
    args = parser.parse_args()

    output = args.write_media
    suffix = output.suffix.lower()
    if suffix not in {".wav", ".mp3"}:
        parser.error("--write-media must use a .wav or .mp3 extension")

    if args.file is not None:
        try:
            text = args.file.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as error:
            parser.error(f"could not read input file {args.file}: {error}")
    else:
        text = args.text

    if not text.strip():
        parser.error("input text must not be empty")
    if args.audio_prompt is not None and not args.audio_prompt.is_file():
        parser.error(f"audio prompt file does not exist: {args.audio_prompt}")

    if not args.model_dir.is_dir():
        parser.error(
            f"model directory does not exist: {args.model_dir}. "
            "Download the required files listed in chatterbox.md."
        )
    missing_files = [
        filename
        for filename in REQUIRED_MODEL_FILES
        if not (args.model_dir / filename).is_file()
    ]
    if missing_files:
        parser.error(
            f"model directory {args.model_dir} is missing required files: "
            f"{', '.join(missing_files)}"
        )
    if args.audio_prompt is None and not (args.model_dir / "conds.pt").is_file():
        parser.error(
            "no built-in voice file (conds.pt) was found in the model directory; "
            "provide --audio-prompt with a reference audio file or download conds.pt."
        )

    try:
        import torch
    except ImportError as error:
        parser.error(
            "Could not import PyTorch in this Python environment. "
            "Follow the setup instructions in chatterbox.md. "
            f"Import error: {error}"
        )

    if args.device == "auto":
        device = "cuda" if torch.cuda.is_available() else "cpu"
    else:
        device = args.device
        if device == "cuda" and not torch.cuda.is_available():
            parser.error("--device cuda was requested, but CUDA is not available")

    try:
        model = load_local_model(args.model_dir, device)
    except ImportError as error:
        parser.error(
            "Could not import Chatterbox in this Python environment. "
            "Follow the setup instructions in chatterbox.md. "
            f"Import error: {error}"
        )
    wav = model.generate(
        text,
        language_id=args.language,
        audio_prompt_path=(
            str(args.audio_prompt) if args.audio_prompt is not None else None
        ),
    )

    import numpy as np
    import soundfile as sf

    samples = np.asarray(wav.detach().cpu().squeeze().numpy())
    output.parent.mkdir(parents=True, exist_ok=True)
    if suffix == ".wav":
        sf.write(str(output), samples, model.sr)
    else:
        import lameenc

        pcm = np.clip(samples * 32767, -32768, 32767).astype(np.int16)
        encoder = lameenc.Encoder()
        encoder.set_bit_rate(128)
        encoder.set_in_sample_rate(model.sr)
        encoder.set_channels(1)
        encoder.set_quality(2)
        output.write_bytes(encoder.encode(pcm.tobytes()) + encoder.flush())

    print(f"Created {output}")


if __name__ == "__main__":
    main()
