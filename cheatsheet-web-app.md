
### Web App

```
python serve.py
```

Port 8000 is serving the project’s static docs app: runs `python serve.py` (like `python -m http.server 8000 -d docs`, but sends `Cache-Control: no-store` so edits show up on a normal reload). The page is the Text to Speech app with Kokoro and Edge TTS, from `docs/index.html`. 
