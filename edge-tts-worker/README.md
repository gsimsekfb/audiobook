# Edge TTS Cloudflare Worker

Proxies text-to-speech requests from the GitHub Pages frontend to Microsoft's Edge Read Aloud service.

## Deploy

### Option A: Cloudflare Dashboard (no CLI needed)

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com).
2. Go to **Workers & Pages → your worker** (`super-lake-0964`).
3. Click **Edit Code**, paste the contents of `worker.js`, and click **Deploy**.

### Option B: Wrangler CLI

```bash
npm i -g wrangler
wrangler login
cd edge-tts-worker
wrangler deploy
```

## Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/tts` | `{ "text": "...", "voice": "en-US-EricNeural", "rate": "+0%" }` | `audio/mpeg` binary |
| `GET` | `/voices` | — | JSON array of voice objects |

## CORS

Requests are allowed from `https://gsimsekfb.github.io` and `http://localhost:*`.

## Notes

- Uses Microsoft's **unofficial** Edge Read Aloud endpoint. Microsoft could change or block it.
- The DRM token (`Sec-MS-GEC`) is ported from the [edge-tts](https://github.com/rany2/edge-tts) Python library.
- Free Cloudflare Workers plan: 100k requests/day, 10ms CPU time per request.
