
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

### Chatterbox Multilingual V3

Set up the isolated Python 3.11 environment using [chatterbox.md](chatterbox.md).
Manually download the model files into `.\chatterbox-model` as described there.
Set a language ID; use `conds.pt` for the built-in voice or an optional reference
audio file for voice conditioning.


```powershell
// working cmd
uv run --python 3.11 --with "chatterbox-tts @ git+https://github.com/resemble-ai/chatterbox.git" --with soundfile --with lameenc --no-project .\chatterbox-tts\chatterbox_tts.py --language en --text "The Ethereum Virtual Machine, or EVM, is a decentralized virtual environment"  --audio-prompt ".\ethereum.org foundationals\10.3-Nodes as a service.mp3" --write-media ".\chatterbox-test-audio-evm.mp3" --device cpu
```

From file:
```
.\.chatterbox-venv\Scripts\python.exe .\chatterbox_tts.py --language en --file .\chapter.txt --write-media .\chapter.mp3
```

From text:
```
.\.chatterbox-venv\Scripts\python.exe .\chatterbox_tts.py --language en --text "A short paragraph." --write-media .\output.wav
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

