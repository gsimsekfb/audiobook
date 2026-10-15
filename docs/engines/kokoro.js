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
  const all = ttsInstance.list_voices();
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
 * Uses kokoro-js built-in streaming to handle long text automatically.
 */
export async function generateKokoro(tts, text, voiceId, onChunkProgress) {
  // Use streaming mode: kokoro-js splits at sentence boundaries internally
  const stream = tts.generate(text, { voice: voiceId, speed: 1.0 });

  // If streaming is available (returns async iterable), collect chunks
  if (stream[Symbol.asyncIterator]) {
    const pcmChunks = [];
    let sampleRate = 24000;
    let idx = 0;
    for await (const chunk of stream) {
      sampleRate = chunk.sampling_rate || sampleRate;
      pcmChunks.push(chunk.audio);
      idx++;
      if (onChunkProgress) onChunkProgress(idx);
    }
    // Join PCM Float32Arrays
    const totalLen = pcmChunks.reduce((s, c) => s + c.length, 0);
    const joined = new Float32Array(totalLen);
    let off = 0;
    for (const c of pcmChunks) { joined.set(c, off); off += c.length; }
    return float32ToWavBlob(joined, sampleRate);
  }

  // Non-streaming fallback (single result)
  const result = await stream;
  const sr = result.sampling_rate || 24000;
  return float32ToWavBlob(result.audio, sr);
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
