# Plan: GitHub Pages MVP – Kokoro (browser) + Edge TTS (via free proxy)

## Repo state checked
- TTS code now lives in `kokoro-tts/`, `edge-tts/`, `chatterbox-tts/` (latest commit `da0790c`).
- Default voices in use: Kokoro `am_adam`, Edge `en-US-EricNeural` ([todos.md](file:///c:/code/audiobook/todos.md), [cheatsheet.md](file:///c:/code/audiobook/cheatsheet.md)).
- No `docs/` folder or web code exists yet.

## The two engines

| | Kokoro (`kokoro-js`) | Edge TTS |
|---|---|---|
| Where it runs | Visitor's browser (WebGPU, falls back to WASM) | Microsoft's servers, reached through a small proxy |
| Server needed | None | **Cloudflare Worker**: free, no card, 100k requests/day |
| First use | Downloads an ~86 MB model (`q8`), then the browser caches it | Instant |
| Speed | Depends on visitor's PC | Fast |
| Voices | Kokoro English voices; default `am_adam` | All Edge voices; default `en-US-EricNeural` |
| Download format | `.wav` | `.mp3` |

> [!WARNING]
> Browsers can't call Edge TTS directly: its connection needs special headers and a `Sec-MS-GEC` token that browser code isn't allowed to send. So the Worker proxy is required.
> Edge TTS uses Microsoft's **unofficial** endpoint, the same one the `edge-tts` Python tool uses. Microsoft could change or block it at any time.

## Files I'll create

### Frontend: `docs/` (served by GitHub Pages)
- `index.html`
  - Engine switch: **Kokoro** or **Edge**.
  - Voice dropdown (the list changes with the engine).
  - Text box with a character counter.
  - **Convert** button, progress bar, audio player and **Download** button.
- `style.css`: dark, modern theme with progress and loading states.
- `config.js`: one setting, `EDGE_PROXY_URL`, for the Worker address.
- `app.js`: the page logic. It reads the text, calls the selected engine, joins the audio chunks, plays the result and enables Download.
- `engines/kokoro.js`
  - Loads `kokoro-js` from a CDN and loads the model with `KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "webgpu" | "wasm" })`.
  - Long text is converted sentence by sentence using its built-in streaming, and the pieces are joined into one WAV.
- `engines/edge.js`
  - Splits the text into chunks of about 2,000 characters at sentence boundaries.
  - Sends each chunk to the Worker, joins the MP3 pieces and fetches the voice list from the Worker.

### Backend: `edge-tts-worker/` (Cloudflare Worker)
- `worker.js`: my own small worker, not copied from a third-party repo.
  - `POST /tts` takes `{ text, voice, rate }` and returns MP3. It opens the WebSocket to Microsoft with the headers and `Sec-MS-GEC` token that `edge-tts` uses.
  - `GET /voices` returns the voice list.
  - Cross-site access is allowed only from `https://gsimsekfb.github.io` and `http://localhost:8000`.
  - The frontend sends one chunk per request, which keeps each call within the free tier's limits.
- `wrangler.toml`: Worker settings for the Cloudflare `wrangler` command-line tool.
- `README.md`: deploy steps.

### Docs
- Add a "Web app" section to [cheatsheet.md](file:///c:/code/audiobook/cheatsheet.md) with the local-run and deploy commands.

> [!IMPORTANT]
> The input text is sent to the engines exactly as typed. It is only split at sentence boundaries, never edited.

## Your manual steps
1. **Cloudflare (no card):**
   - Sign up at dash.cloudflare.com.
   - Then either run `npx wrangler login` followed by `npx wrangler deploy` in `edge-tts-worker/`, or paste `worker.js` into **Workers & Pages → Create Worker → Edit code**.
   - Send me the `https://<name>.<you>.workers.dev` address and I'll put it in `config.js`.
2. **GitHub Pages:**
   - The repo must be **public**.
   - Go to **Settings → Pages → Deploy from a branch → `main` / `/docs` → Save**.
   - The site will be at `https://gsimsekfb.github.io/audiobook/`.

## Testing before commit
1. Run `python -m http.server 8000 -d docs` and open `http://localhost:8000`.
2. **Kokoro:** paste lines 1–3 of [8-evm.txt](file:///c:/code/audiobook/ethereum.org%20foundationals/data%20files/8-evm.txt). The first run shows model-download progress. Then Convert, play and download the `.wav`.
3. **Edge:**
   - Run `npx wrangler dev` in `edge-tts-worker/`, which serves the Worker locally at `http://localhost:8787`, and point `config.js` at it.
   - Convert the same text and download the `.mp3`.
4. **Long text:** paste the whole `8-evm.txt` into both engines to check chunking and joining.
5. **Browser check:** I'll also run it in the browser myself and report the results.
6. **Code check:** there's no build step. I'll run `node --check` on the JS files and report any errors.

## Open questions
1. **Edge voices:** show all ~400 voices, or a short list (English plus Turkish)?
2. **Kokoro English only:** OK that Kokoro offers English only (its American and British voices)?
3. **MP3 for Kokoro:** WAV is fine for the MVP, or should Kokoro also download as MP3? MP3 would add an encoder library of about 100 KB.
