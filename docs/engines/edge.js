// Edge TTS engine — calls the Cloudflare Worker proxy.

/**
 * Fetch available voices from the proxy, filtered to English + Turkish.
 */
export async function fetchEdgeVoices(proxyUrl) {
  const resp = await fetch(`${proxyUrl}/voices`);
  if (!resp.ok) throw new Error(`Voice list failed: ${resp.status}`);
  const all = await resp.json();
  return all
    .filter((v) => {
      const loc = v.Locale || "";
      return loc.startsWith("en-") || loc.startsWith("tr-");
    })
    .map((v) => ({
      id: v.ShortName,
      name: `${v.FriendlyName || v.ShortName}`,
      locale: v.Locale,
      gender: v.Gender,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Split text at sentence boundaries into chunks of roughly maxLen characters.
 * Never modifies the text content itself.
 */
function splitText(text, maxLen = 3000) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let splitAt = -1;
    // Search backwards from maxLen for a sentence boundary
    for (let i = maxLen; i > 0; i--) {
      if (".!?\n".includes(remaining[i - 1]) && (i === remaining.length || remaining[i] === " " || remaining[i] === "\n")) {
        splitAt = i;
        break;
      }
    }
    if (splitAt <= 0) {
      // No boundary found; split at last space
      splitAt = remaining.lastIndexOf(" ", maxLen);
      if (splitAt <= 0) splitAt = maxLen;
    }
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

/**
 * Generate speech via the Edge TTS proxy.
 * Returns a Blob (audio/mpeg). Splits long text into chunks.
 */
export async function generateEdge(proxyUrl, text, voice, rate, onChunkProgress) {
  const chunks = splitText(text);
  const audioParts = [];

  for (let i = 0; i < chunks.length; i++) {
    const resp = await fetch(`${proxyUrl}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: chunks[i], voice, rate }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || `TTS request failed: ${resp.status}`);
    }

    audioParts.push(new Uint8Array(await resp.arrayBuffer()));
    if (onChunkProgress) onChunkProgress(i + 1, chunks.length);
  }

  // Concatenate MP3 chunks (MP3 frames are independently decodable)
  const total = audioParts.reduce((s, a) => s + a.length, 0);
  const merged = new Uint8Array(total);
  let off = 0;
  for (const p of audioParts) { merged.set(p, off); off += p.length; }
  return new Blob([merged], { type: "audio/mpeg" });
}
