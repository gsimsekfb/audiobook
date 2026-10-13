
### Kokoro-82MB

```
Model: kokoro-v1.0.onnx  
Voices: voices-v1.0.bin  

Audio creation time at local: 
19KB txt -> 15mins
Surface Pro 7, 8GB
```

From file:  
```
.\.venv\Scripts\python.exe .\kokoro_tts.py --voice am_adam --file '10.2-client-diversity.txt' --write-media '10-2.mp3'
```

From text:  
```
.\.venv\Scripts\python.exe .\kokoro_tts.py --voice am_adam --text "A short paragraph." --write-media .\output.mp3
```


### edge-tts

From file:  
```
.\.venv\Scripts\edge-tts.exe --voice en-US-EricNeural --file extracted.txt --write-media audiobook.mp3
```

From text:  
```
.\.venv\Scripts\edge-tts.exe --voice en-US-EricNeural --text "A short paragraph." --write-media .\output.mp3
```

