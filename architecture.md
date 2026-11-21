# Architecture

## Overview

The web app lives in `docs/` (static HTML/CSS/JS) and supports two TTS engines: **Edge TTS** (via a Cloudflare Worker proxy) and **Kokoro** (in-browser).

## Components

### 1. Frontend (`docs/`)
- `docs/index.html`, `docs/style.css`, `docs/app.js`: Static UI served via GitHub Pages (or locally via `python serve.py` with `Cache-Control: no-store`).
- Engine modules in `docs/engines/`:
  - `docs/engines/kokoro.js`: Loads `kokoro-js@1.1.0` (`Kokoro-82M`) from jsDelivr and runs inference entirely in the browser.
  - `docs/engines/edge.js`: Fetches voices and generates audio by calling the Cloudflare Worker proxy.

### 2. Edge TTS Proxy (`edge-tts-worker/worker.js`)
- Proxies voice list and synthesis requests to Microsoft's Edge Read Aloud endpoint (`speech.platform.bing.com/consumer/speech/synthesize/readaloud`).
- **Implementation note:** We do **not** import or run [`rany2/edge-tts`](https://github.com/rany2/edge-tts) directly in the web app. Instead, `edge-tts-worker/worker.js` is a standalone JavaScript port of `rany2/edge-tts`'s DRM (`edge_tts/drm.py`) and WebSocket protocol.
