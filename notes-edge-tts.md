
... 
----------------------------------

### Cloudflare Worker
#### Cloudflare Worker Page:  
https://dash.cloudflare.com/e517a205ca27e1f107916d89a3586a61/workers/services/edit/super-lake-0964/production -> worker.js  

#### Deploy Cloudflare Worker changes:   
``` 
cd edge-tts-worker
npx wrangler deploy
```


#### Test the Worker locally:   

Then temporarily point `EDGE_PROXY_URL` in `docs/config.js` to http://localhost:8787

```
cd edge-tts-worker
npx wrangler dev
```




## Conversion Workflow: 

Short:  
The browser sends "abc" to your Cloudflare Worker, which gets MP3 audio from Microsoft's Edge TTS over a WebSocket and returns it for playback.

Steps:  
**1. Browser (`app.js`)**
- Clicking Convert runs `convert()`, which trims the text, disables the button and shows the spinner.
- It calls `generateEdge(EDGE_PROXY_URL, "abc", voice, "+0%", ...)`.

**2. Browser (`engines/edge.js`)**
- `splitText("abc")` returns `["abc"]` because it is under 3000 chars.
- It sends `POST <worker>/tts` with `{ text: "abc", voice: "en-US-EricNeural", rate: "+0%" }`.

**3. Worker - on Cloudflare, id: super-lake-0964 (`worker.js`)**
- It applies the CORS check, parses the JSON and calls `synthesize()`.
- It generates the `Sec-MS-GEC` token (time-based, 5-minute buckets), a connection ID and a `muid` cookie.
- It opens a WebSocket to `speech.platform.bing.com`.
- It sends a `speech.config` message (MP3 24kHz output), then the SSML containing `abc`.

**4. Microsoft - Edge “Read Aloud” neural TTS (speech.platform.bing.com)**
- It streams back binary frames tagged `Path:audio` (MP3 bytes).
- It ends with a `Path:turn.end` text message.

**5. Worker**
- It concatenates the audio frames and returns them as `audio/mpeg`.
- If it hits the 30 s timeout or a WebSocket error, it returns `{ error }` with status 500.

**6. Browser**
- `generateEdge` reads the response into bytes, reports progress 1/1 and merges the chunks into a `Blob` of type `audio/mpeg`.
- `convert()` creates an object URL and sets it as the `<audio>` source.
- It shows the player, sets the status to "Done in X s" and re-enables the button.
- The Download button saves it as `speech.mp3`.

