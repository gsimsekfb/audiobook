# Bitcoin Whitepaper Audio

This folder contains the 9-page Bitcoin whitepaper and an MP3 audiobook made with `pypdf` and Microsoft Edge neural TTS through `edge-tts`.

## Steps

Run these commands from the project folder:

Setup  

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install pypdf edge-tts
```

Download the PDF:

```powershell
$output = 'bitcoin-whitepaper-audio'

New-Item -ItemType Directory -Force $output | Out-Null

Invoke-WebRequest -Uri 'https://bitcoin.org/bitcoin.pdf' -OutFile (Join-Path $output 'bitcoin-whitepaper.pdf')
```

Extract the PDF text using pypdf:

```powershell
python -c "from pathlib import Path; from pypdf import PdfReader; folder=Path('bitcoin-whitepaper-audio'); pdf=folder/'bitcoin-whitepaper.pdf'; (folder/'bitcoin-whitepaper.txt').write_text('\n\n'.join((page.extract_text() or '').strip() for page in PdfReader(str(pdf)).pages), encoding='utf-8')"
```

Create the MP3 and subtitles:

```powershell
python 'audio pause issue/prepare_text.py' `
	'bitcoin-whitepaper-audio/bitcoin-whitepaper.txt' `
	'bitcoin-whitepaper-audio/bitcoin-whitepaper-normalized.txt'

edge-tts --voice en-US-AriaNeural --file 'bitcoin-whitepaper-audio/bitcoin-whitepaper-normalized.txt' --write-media 'bitcoin-whitepaper-audio/bitcoin-whitepaper-normalized.mp3' --write-subtitles 'bitcoin-whitepaper-audio/bitcoin-whitepaper-normalized.srt'
```

Check that the PDF has 9 pages:

```powershell
python -c "from pypdf import PdfReader; print(len(PdfReader('bitcoin-whitepaper-audio/bitcoin-whitepaper.pdf').pages))"
```

Note: 
The generated voice requires an internet connection because `edge-tts` uses Microsoft's online speech service.