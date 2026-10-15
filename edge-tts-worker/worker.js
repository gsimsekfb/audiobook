// Edge TTS Cloudflare Worker
// Proxies text-to-speech requests to Microsoft's Edge Read Aloud service.
// Port of the edge-tts Python library's DRM and WebSocket protocol.

// ===== Service Constants =====
const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const BASE_URL = "speech.platform.bing.com/consumer/speech/synthesize/readaloud";
const WSS_URL = `wss://${BASE_URL}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
const VOICE_LIST_URL = `https://${BASE_URL}/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}`;
const CHROMIUM_FULL_VERSION = "143.0.3650.75";
const CHROMIUM_MAJOR_VERSION = CHROMIUM_FULL_VERSION.split(".")[0];
const SEC_MS_GEC_VERSION = `2-${CHROMIUM_FULL_VERSION}`;
const WIN_EPOCH = 11644473600;
const USER_AGENT =
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36` +
  ` (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36` +
  ` Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`;

const ALLOWED_ORIGINS = [
  "https://gsimsekfb.github.io",
  "http://localhost:8000",
  "http://localhost:3000",
  "http://127.0.0.1:8000",
];

// ===== DRM Constants (from edge_tts/drm.py) =====
const SHA256_INITIAL = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];
const SHA256_STATE = [
  0xfd9fbea2, 0x91243ce7, 0xbe499094, 0xcd2e1e0a,
  0x6c006f49, 0x04bd35ab, 0xfeb0a7e4, 0x03effbd2,
];
const SHA256_SCHEDULE = [
  0xeb24bf9e, 0x1558691f, 0xa0c09ee2, 0x0cfa32ba,
  0xa622ee8c, 0xd1dd9491, 0xc0dd25a0, 0xf9e70ab6,
  0xf0c31573, 0x7058ce4e, 0x7188e606, 0x00e5ab33,
  0xd258b060, 0x72766564,
];
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const SHA256_ADJ = 0xc9dc06a7;
const SHA256_S0_ADJ = 0x059c0b80;
const SHA256_S1_ADJ = 0x000b92c0;
const SHA256_BK = [
  ...SHA256_K.slice(0, 14), SHA256_ADJ, ...SHA256_K.slice(15),
];

const CS64_COEFF = [
  [0xe82e91b1, 0xb32700d0], [0x44de24c6, 0x88dff51d],
  [0x3beb65bc, 0x29514038], [0xc89c5933, 0xb328cbdf],
  [0x8d1ec211, 0xd405b4d5], [0x314ef5d5, 0x26e55f3c],
  [0xe92491b1, 0x607801c6], [0xf0a5b9d5, 0x82b2c1fb],
  [0x06064cf3, 0xfa51a3da], [0xda79fa60, 0x207cc464],
  [0xbed20560, 0x3c3c74f3], [0x89f9c9f8, 0xd2d14b61],
  [0x35fa38c6, 0xbb04a2c1], [0xcb49e3c6, 0xc5626167],
];
const CS64_FACTOR = 0x82893933;
const CS64_ADJ0 = 0xf2f90b1a;
const CS64_ADJ1 = 0x0b1a0000;

// ===== 32-bit Helpers =====
const u = (x) => x >>> 0;
const rol16 = (x) => { x = u(x); return u((x << 16) | (x >>> 16)); };
const rotr = (x, n) => { x = u(x); return u((x >>> n) | (x << (32 - n))); };
const ssig0 = (x) => u(rotr(x, 7) ^ rotr(x, 18) ^ (u(x) >>> 3));
const ssig1 = (x) => u(rotr(x, 17) ^ rotr(x, 19) ^ (u(x) >>> 10));

// ===== SHA-256 Compression =====
function sha256Rounds(st, w, first = 0) {
  let [a, b, c, d, e, f, g, h] = st;
  const K = first === 14 ? SHA256_BK : SHA256_K;
  for (let i = first; i < 64; i++) {
    const t1 = u(h + u(rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25))
      + u(g ^ (e & (f ^ g))) + K[i] + w[i]);
    const t2 = u(u(rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22))
      + u((a & b) | (c & (a | b))));
    h = g; g = f; f = e; e = u(d + t1);
    d = c; c = b; b = a; a = u(t1 + t2);
  }
  return [a, b, c, d, e, f, g, h];
}

function expandSchedule(w, first = 16) {
  for (let i = first; i < 64; i++) {
    w.push(u(ssig1(w[i - 2]) + w[i - 7] + ssig0(w[i - 15]) + w[i - 16]));
  }
}

// ===== Custom SHA-256 Init (pre-computed first 14 rounds) =====
function sha256Init(d) {
  // d = Uint8Array, at least 7 bytes (first 7 bytes of token data)
  const w = new Array(14).fill(0);
  w.push(u((d[0] << 16) | (d[1] << 8) | d[2]));        // word 14
  w.push(u((d[3] << 24) | (d[4] << 16) | (d[5] << 8) | d[6])); // word 15

  for (let i = 16; i < 30; i++) {
    let v = SHA256_SCHEDULE[i - 16];
    if (i - 2 >= 14) {
      const s = ssig1(w[i - 2]);
      v = u(v + (i === 16 ? u(s ^ SHA256_S1_ADJ) : s));
    }
    if (i - 7 >= 14) v = u(v + w[i - 7]);
    if (i - 15 >= 14) {
      const s = ssig0(w[i - 15]);
      v = u(v + (i === 29 ? u(s ^ SHA256_S0_ADJ) : s));
    }
    w.push(v);
  }
  w.push(u(ssig1(w[28]) + w[23] + ssig0(w[15]) + w[14] + SHA256_ADJ - SHA256_K[14]));
  expandSchedule(w, 31);
  const wk = sha256Rounds(SHA256_STATE, w, 14);
  return SHA256_INITIAL.map((v, i) => u(v + wk[i]));
}

// ===== Custom SHA-256 Digest =====
function sha256Digest(data) {
  // data = Uint8Array, >= 7 bytes
  const length = 57 + data.length;
  const after7 = data.slice(7);
  const padZeros = (((-2 - data.length) % 64) + 64) % 64;
  const padLen = after7.length + 1 + padZeros + 8;
  const padded = new Uint8Array(padLen);
  padded.set(after7, 0);
  padded[after7.length] = 0x80;
  const dv = new DataView(padded.buffer);
  const lenBits = length * 8;
  dv.setUint32(padLen - 8, Math.floor(lenBits / 0x100000000), false);
  dv.setUint32(padLen - 4, lenBits >>> 0, false);

  let state = sha256Init(data.slice(0, 7));
  for (let off = 0; off < padLen; off += 64) {
    const bv = new DataView(padded.buffer, off, 64);
    const w = [];
    for (let j = 0; j < 16; j++) w.push(bv.getUint32(j * 4, false));
    expandSchedule(w);
    const wk = sha256Rounds(state, w);
    state = state.map((v, i) => u(v + wk[i]));
  }
  const result = new Uint8Array(32);
  const rv = new DataView(result.buffer);
  for (let i = 0; i < 8; i++) rv.setUint32(i * 4, state[i], false);
  return result;
}

// ===== CS64 Digest =====
function wordsLE(data) {
  const pl = (4 - (data.length % 4)) % 4;
  const p = new Uint8Array(data.length + pl);
  p.set(data);
  if (p.length === 0) return [];
  const dv = new DataView(p.buffer);
  const w = [];
  for (let i = 0; i < p.length; i += 4) w.push(dv.getUint32(i, true));
  if (w.length % 2) w.push(0);
  return w;
}

function cs64Digest(data, digest) {
  const dv = new DataView(digest.buffer, digest.byteOffset);
  const kA = dv.getUint32(0, true) | 1;
  const kB = dv.getUint32(4, true) | 1;
  const fct = [Math.imul(kA, CS64_FACTOR) >>> 0, Math.imul(kB, CS64_FACTOR) >>> 0];

  const terms = CS64_COEFF.map(([c], i) => Math.imul(c, fct[i % 2]) >>> 0);
  const offsets = CS64_COEFF.map(([, o]) => o);

  const pre = new Uint8Array(1 + data.length);
  pre.set(data, 1); // prepend 0x00
  for (const [i, word] of wordsLE(pre).entries()) {
    let t = Math.imul(word, i % 2 === 0 ? kA : kB) >>> 0;
    let o = Math.imul(rol16(word), i % 2 === 0 ? 0xef0569fb : 0xc31713db) >>> 0;
    if (i === 0) {
      t = u(t + (Math.imul(CS64_ADJ0, fct[0]) >>> 0));
      o = u(o + CS64_ADJ1);
    }
    terms.push(t);
    offsets.push(o);
  }

  let swapAcc = 0, swapLast = 0, state = 0, acc = 0;
  for (let i = 0; i < terms.length; i += 2) {
    const x = terms[i], y = terms[i + 1];
    let t = rol16(u(offsets[i] + x));
    let q = Math.imul(t, 0x76f50f34) >>> 0;
    swapAcc = u(swapAcc + u((Math.imul(rol16(q), 0xc3efea97) >>> 0) + q));
    t = rol16(u(offsets[i + 1] + y));
    q = Math.imul(t, 0x1881ce3c) >>> 0;
    swapLast = u((Math.imul(rol16(q), 0x35bd1ec9) >>> 0) + q);
    swapAcc = u(swapAcc + swapLast);

    state = u(Math.imul(state, kA) + x);
    state = Math.imul(rol16(state), 0xcf98b111) >>> 0;
    state = Math.imul(rol16(state), 0x87085b9f) >>> 0;
    state = Math.imul(rol16(state), 0x12ceb96d) >>> 0;
    state = Math.imul(rol16(state), 0x257e1d83) >>> 0;
    acc = acc + state; // intentionally > 32 bits temporarily
    t = u(Math.imul(state, kB) + y);
    t = Math.imul(rol16(t), 0xa27416f5) >>> 0;
    t = Math.imul(rol16(t), 0xd38396ff) >>> 0;
    state = Math.imul(rol16(Math.imul(rol16(t), 0x7c932b89) >>> 0), 0xbfa49f69) >>> 0;
    acc = u(acc + state);
  }
  return [u(swapLast ^ state), u(swapAcc ^ acc)];
}

// ===== Token Generation =====
function tokenHash(data) {
  const digest = sha256Digest(data);
  const [a, b] = cs64Digest(data, digest);
  const cs = new Uint8Array(8);
  const cdv = new DataView(cs.buffer);
  cdv.setUint32(0, a, true);
  cdv.setUint32(4, b, true);
  const hex = (arr) => Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return [hex(cs), hex(digest)];
}

function generateSecMsGec() {
  const sec = BigInt(Math.floor(Date.now() / 1000));
  let ticks = sec + BigInt(WIN_EPOCH);
  ticks -= ticks % 300n;
  ticks *= 10000000n;
  const str = ticks.toString() + TRUSTED_CLIENT_TOKEN;
  const data = new TextEncoder().encode(str);
  const [cs, sha] = tokenHash(data);
  return `${cs}-${sha}`;
}

function generateMuid() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}

// ===== TTS Helpers =====
function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function dateToString() {
  return new Date().toUTCString().replace("GMT", "GMT+0000 (Coordinated Universal Time)");
}

function mkSsml(voice, rate, text) {
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
    `<voice name='${voice}'>` +
    `<prosody pitch='+0Hz' rate='${rate}' volume='+0%'>${text}</prosody>` +
    `</voice></speak>`;
}

function ssmlHeaders(reqId, ts, ssml) {
  return `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}Z\r\nPath:ssml\r\n\r\n${ssml}`;
}

function concatBytes(arrays) {
  const len = arrays.reduce((s, a) => s + a.length, 0);
  const r = new Uint8Array(len);
  let off = 0;
  for (const a of arrays) { r.set(a, off); off += a.length; }
  return r;
}

// ===== WebSocket TTS =====
async function synthesize(text, voice, rate) {
  const connId = crypto.randomUUID().replace(/-/g, "");
  const gec = generateSecMsGec();
  const muid = generateMuid();

  const url = `https://${BASE_URL}/edge/v1` +
    `?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&ConnectionId=${connId}` +
    `&Sec-MS-GEC=${encodeURIComponent(gec)}` +
    `&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

  const resp = await fetch(url, {
    headers: {
      Upgrade: "websocket",
      "User-Agent": USER_AGENT,
      Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
      Pragma: "no-cache",
      "Cache-Control": "no-cache",
      Cookie: `muid=${muid};`,
    },
  });

  const ws = resp.webSocket;
  if (!ws) throw new Error("WebSocket upgrade failed");
  ws.accept();

  return new Promise((resolve, reject) => {
    const chunks = [];
    let done = false;
    const timeout = setTimeout(() => {
      if (!done) { done = true; ws.close(); reject(new Error("Timeout")); }
    }, 30000);

    ws.addEventListener("message", (ev) => {
      if (done) return;
      if (typeof ev.data === "string") {
        if (ev.data.includes("Path:turn.end")) {
          done = true; clearTimeout(timeout); ws.close();
          resolve(concatBytes(chunks));
        }
      } else {
        const buf = new Uint8Array(ev.data);
        if (buf.length < 2) return;
        const hLen = (buf[0] << 8) | buf[1];
        if (hLen + 2 > buf.length) return;
        const hdr = new TextDecoder().decode(buf.slice(2, hLen));
        if (hdr.includes("Path:audio") && hdr.includes("Content-Type:audio/mpeg")) {
          const audio = buf.slice(hLen + 2);
          if (audio.length > 0) chunks.push(audio);
        }
      }
    });

    ws.addEventListener("error", () => {
      if (!done) { done = true; clearTimeout(timeout); reject(new Error("WebSocket error")); }
    });

    ws.addEventListener("close", () => {
      if (!done) {
        done = true; clearTimeout(timeout);
        if (chunks.length > 0) resolve(concatBytes(chunks));
        else reject(new Error("Connection closed without audio"));
      }
    });

    // Send config
    const cfg =
      `X-Timestamp:${dateToString()}\r\n` +
      `Content-Type:application/json; charset=utf-8\r\n` +
      `Path:speech.config\r\n\r\n` +
      `{"context":{"synthesis":{"audio":{"metadataoptions":` +
      `{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},` +
      `"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
    ws.send(cfg);

    // Send SSML
    const escaped = escapeXml(text);
    const ssml = mkSsml(voice, rate, escaped);
    ws.send(ssmlHeaders(connId, dateToString(), ssml));
  });
}

// ===== Voice List =====
async function fetchVoices() {
  const gec = generateSecMsGec();
  const muid = generateMuid();
  const resp = await fetch(VOICE_LIST_URL, {
    headers: {
      "User-Agent": USER_AGENT,
      "Sec-MS-GEC": gec,
      "Sec-MS-GEC-Version": SEC_MS_GEC_VERSION,
      Cookie: `muid=${muid};`,
      Authority: "speech.platform.bing.com",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!resp.ok) throw new Error(`Voice list failed: ${resp.status}`);
  return resp.json();
}

// ===== CORS =====
function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) || (origin && origin.startsWith("http://localhost"));
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

// ===== Request Handler =====
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (url.pathname === "/tts" && request.method === "POST") {
        const body = await request.json();
        const text = body.text;
        const voice = body.voice || "en-US-EricNeural";
        const rate = body.rate || "+0%";
        if (!text || typeof text !== "string" || text.length === 0) {
          return new Response(JSON.stringify({ error: "text is required" }), {
            status: 400, headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        const audio = await synthesize(text, voice, rate);
        return new Response(audio, {
          headers: { ...cors, "Content-Type": "audio/mpeg" },
        });
      }

      if (url.pathname === "/voices" && request.method === "GET") {
        const voices = await fetchVoices();
        return new Response(JSON.stringify(voices), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      return new Response("Not found", { status: 404, headers: cors });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  },
};
