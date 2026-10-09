# Audio Pause Issue Verification

The pause at the end of each apparent line came from PDF layout line breaks
being passed directly to `edge-tts`. The service produced a separate subtitle
cue for each wrapped line, which also made the voice pause at every wrap.

`prepare_text.py` removes those layout-only line breaks by joining non-empty
lines within each paragraph. It preserves blank lines as paragraph boundaries,
so genuine paragraph pauses remain.

## Reproduce and verify

From the project folder:

```powershell
python -m pip install pypdf edge-tts

$folder = 'audio pause issue'

Invoke-WebRequest -Uri 'https://www.orimi.com/pdf-test.pdf' -OutFile "$folder/one-page.pdf"

python -c "from pathlib import Path; from pypdf import PdfReader; folder=Path('audio pause issue'); pdf=folder/'one-page.pdf'; (folder/'raw.txt').write_text('\\n\\n'.join((page.extract_text() or '').strip() for page in PdfReader(str(pdf)).pages), encoding='utf-8')"

python "$folder/prepare_text.py" "$folder/raw.txt" "$folder/normalized.txt"

edge-tts --voice en-US-AriaNeural --file "$folder/normalized.txt" --write-media "$folder/normalized.mp3" --write-subtitles "$folder/normalized.srt"
```

The one-page input is `one-page.pdf`. Compare `raw.txt` with
`normalized.txt`, and inspect `normalized.srt`: wrapped source lines should no
longer become separate speech cues. To fix the existing whitepaper output:

```powershell
python "$folder/prepare_text.py" `
	'bitcoin-whitepaper-audio/bitcoin-whitepaper.txt' `
	'bitcoin-whitepaper-audio/bitcoin-whitepaper-normalized.txt'
	
edge-tts --voice en-US-AriaNeural `
	--file 'bitcoin-whitepaper-audio/bitcoin-whitepaper-normalized.txt' `
	--write-media 'bitcoin-whitepaper-audio/bitcoin-whitepaper-normalized.mp3' `
	--write-subtitles 'bitcoin-whitepaper-audio/bitcoin-whitepaper-normalized.srt'
```