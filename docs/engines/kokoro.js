// Kokoro TTS engine — runs entirely in the visitor's browser via kokoro-js + ONNX.
// Model (~86 MB q8) is downloaded from Hugging Face on first use and cached.

let ttsInstance = null;
let voiceList = null;

/**
 * Load the Kokoro model. Calls onProgress(pct) during download.
 * Returns { tts, voices }.
 */
export async function initKokoro(onProgress) {
  if (ttsInstance && voiceList) return { tts: ttsInstance, voices: voiceList };

  const { KokoroTTS } = await import(
    "https://cdn.jsdelivr.net/npm/kokoro-js@1.1.0/+esm"
  );

  ttsInstance = await KokoroTTS.from_pretrained(
    "onnx-community/Kokoro-82M-v1.0-ONNX",
    {
      dtype: "q8",
      device: "wasm", // "webgpu" needs fp32 and is less compatible
      progress_callback: (p) => {
        if (p.status === "progress" && onProgress) {
          onProgress(Math.round(p.progress));
        }
      },
    }
  );

  // Filter to American English voices only
  const all = ttsInstance.voices;
  voiceList = Object.entries(all)
    .filter(([id]) => id.startsWith("af_") || id.startsWith("am_"))
    .map(([id, meta]) => ({
      id,
      name: meta.name ?? id,
      gender: id.startsWith("am_") ? "Male" : "Female",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { tts: ttsInstance, voices: voiceList };
}

/**
 * Generate speech from text. Returns a Blob (audio/wav).
 * Splits long text because kokoro-js generates one bounded audio tensor per call.
 */
export async function generateKokoro(tts, text, voiceId, onChunkProgress) {
  if (!text || !text.trim()) {
    throw new Error("Enter some text to convert.");
  }

  const pcmChunks = [];
  let sampleRate = 24000;
  const chunks = splitText(text);

  for (let idx = 0; idx < chunks.length; idx++) {
    const result = await tts.generate(chunks[idx], { voice: voiceId, speed: 1.0 });
    const pcm = extractAudioSamples(result);
    if (!pcm || pcm.length === 0) {
      throw new Error("Kokoro returned no audio data.");
    }
    sampleRate = Number(result?.sampling_rate ?? result?.sample_rate ?? sampleRate);
    pcmChunks.push(pcm);
    if (onChunkProgress) onChunkProgress(idx + 1);
  }

  const totalLen = pcmChunks.reduce((s, c) => s + c.length, 0);
  const joined = new Float32Array(totalLen);
  let off = 0;
  for (const c of pcmChunks) {
    joined.set(c, off);
    off += c.length;
  }
  return float32ToWavBlob(joined, sampleRate);
}

function splitText(text, maxLen = 300) {
  const chunks = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    let splitAt = -1;
    for (let i = maxLen; i > 0; i--) {
      if (".!?\n".includes(remaining[i - 1]) && (remaining[i] === " " || remaining[i] === "\n")) {
        splitAt = i;
        break;
      }
    }
    if (splitAt <= 0) {
      splitAt = remaining.lastIndexOf(" ", maxLen);
      if (splitAt <= 0) splitAt = maxLen;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

function extractAudioSamples(value) {
  if (!value) return null;

  const candidates = [
    value.audio,
    value.samples,
    value.data,
    value.wav,
    value.buffer,
  ];

  for (const candidate of candidates) {
    const samples = toFloat32Array(candidate);
    if (samples && samples.length > 0) return samples;
  }

  return toFloat32Array(value);
}

function toFloat32Array(value) {
  if (value == null) return null;

  if (value instanceof Float32Array) return value;
  if (ArrayBuffer.isView(value) || Array.isArray(value)) return Float32Array.from(value);
  if (ArrayBuffer.isView(value?.data)) {
    return Float32Array.from(value.data);
  }
  if (typeof value === "object" && typeof value.length === "number") {
    return Float32Array.from(value);
  }
  return null;
}

/** Convert Float32Array PCM to a WAV Blob. */
function float32ToWavBlob(samples, sampleRate) {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const write = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };

  write(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);       // chunk size
  view.setUint16(20, 1, true);        // PCM
  view.setUint16(22, 1, true);        // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);        // block align
  view.setUint16(34, 16, true);       // bits per sample
  write(36, "data");
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}
