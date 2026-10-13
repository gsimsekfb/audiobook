import argparse
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro


ROOT = Path(__file__).resolve().parent


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate speech with Kokoro TTS.")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--text", help="Text to synthesize.")
    source.add_argument("--file", type=Path, help="UTF-8 text file to synthesize.")
    parser.add_argument("--voice", default="am_adam")
    parser.add_argument("--write-media", required=True, type=Path)
    parser.add_argument("--model", type=Path, default=ROOT / "kokoro-v1.0.onnx")
    parser.add_argument("--voices", type=Path, default=ROOT / "voices-v1.0.bin")
    args = parser.parse_args()

    output = args.write_media
    suffix = output.suffix.lower()
    if suffix not in {".wav", ".mp3"}:
        parser.error("--write-media must use a .wav or .mp3 extension")

    text = args.text if args.text is not None else args.file.read_text(encoding="utf-8")
    kokoro = Kokoro(str(args.model), str(args.voices))
    samples, sample_rate = kokoro.create(
        text,
        voice=args.voice,
        speed=1.0,
        lang="en-us",
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    if suffix == ".wav":
        sf.write(str(output), samples, sample_rate)
    else:
        import lameenc

        pcm = np.clip(np.asarray(samples) * 32767, -32768, 32767).astype(np.int16)
        encoder = lameenc.Encoder()
        encoder.set_bit_rate(128)
        encoder.set_in_sample_rate(sample_rate)
        encoder.set_channels(1)
        encoder.set_quality(2)
        output.write_bytes(encoder.encode(pcm.tobytes()) + encoder.flush())

    print(f"Created {output}")


if __name__ == "__main__":
    main()
