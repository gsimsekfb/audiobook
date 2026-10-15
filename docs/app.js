import { EDGE_PROXY_URL } from "./config.js";
import { initKokoro, generateKokoro } from "./engines/kokoro.js";
import { fetchEdgeVoices, generateEdge } from "./engines/edge.js";

// ===== State =====
let currentEngine = "edge"; // "kokoro" | "edge"
let kokoroTts = null;
let kokoroVoices = [];
let edgeVoices = [];
let isGenerating = false;
let currentAudioUrl = null;

// ===== DOM =====
const $ = (id) => document.getElementById(id);
const els = {};

document.addEventListener("DOMContentLoaded", () => {
  els.tabKokoro = $("tab-kokoro");
  els.tabEdge = $("tab-edge");
  els.voiceSelect = $("voice-select");
  els.textInput = $("text-input");
  els.charCount = $("char-count");
  els.convertBtn = $("convert-btn");
  els.convertText = $("convert-text");
  els.spinner = $("spinner");
  els.progress = $("progress-bar");
  els.progressFill = $("progress-fill");
  els.progressText = $("progress-text");
  els.status = $("status");
  els.playerSection = $("player-section");
  els.audioPlayer = $("audio-player");
  els.downloadBtn = $("download-btn");
  els.kokoroNote = $("kokoro-note");

  // Events
  els.tabKokoro.addEventListener("click", () => switchEngine("kokoro"));
  els.tabEdge.addEventListener("click", () => switchEngine("edge"));
  els.textInput.addEventListener("input", updateCharCount);
  els.convertBtn.addEventListener("click", convert);
  els.downloadBtn.addEventListener("click", download);

  // Init
  updateCharCount();
  switchEngine("edge");
});

// ===== Engine Switching =====
async function switchEngine(engine) {
  currentEngine = engine;
  els.tabKokoro.classList.toggle("active", engine === "kokoro");
  els.tabEdge.classList.toggle("active", engine === "edge");
  els.kokoroNote.style.display = engine === "kokoro" ? "block" : "none";
  els.voiceSelect.innerHTML = '<option value="">Loading voices…</option>';
  els.voiceSelect.disabled = true;

  try {
    if (engine === "kokoro") {
      if (!kokoroTts) {
        setStatus("Loading Kokoro model (~86 MB, first time only)…");
        showProgress(0);
        const result = await initKokoro((pct) => showProgress(pct));
        kokoroTts = result.tts;
        kokoroVoices = result.voices;
        hideProgress();
        setStatus("Model loaded.");
      }
      populateVoices(kokoroVoices, "am_adam");
    } else {
      if (edgeVoices.length === 0) {
        setStatus("Fetching Edge voices…");
        edgeVoices = await fetchEdgeVoices(EDGE_PROXY_URL);
        setStatus("");
      }
      populateVoices(edgeVoices, "en-US-EricNeural");
    }
  } catch (err) {
    setStatus(`Error: ${err.message}`, true);
    console.error(err);
  }

  els.voiceSelect.disabled = false;
}

function populateVoices(voices, defaultId) {
  els.voiceSelect.innerHTML = "";
  for (const v of voices) {
    const opt = document.createElement("option");
    opt.value = v.id;
    opt.textContent = v.name + (v.gender ? ` (${v.gender})` : "");
    if (v.id === defaultId) opt.selected = true;
    els.voiceSelect.appendChild(opt);
  }
}

// ===== Conversion =====
async function convert() {
  const text = els.textInput.value.trim();
  if (!text) { setStatus("Enter some text first.", true); return; }
  if (isGenerating) return;

  isGenerating = true;
  els.convertBtn.disabled = true;
  els.convertText.textContent = "Converting…";
  els.spinner.style.display = "inline-block";
  els.playerSection.style.display = "none";
  if (currentAudioUrl) { URL.revokeObjectURL(currentAudioUrl); currentAudioUrl = null; }
  setStatus("");

  const voice = els.voiceSelect.value;
  const start = Date.now();

  try {
    let blob;
    if (currentEngine === "kokoro") {
      showProgress(0);
      blob = await generateKokoro(kokoroTts, text, voice, (idx) => {
        setStatus(`Processing chunk ${idx}…`);
      });
      hideProgress();
    } else {
      showProgress(0);
      blob = await generateEdge(EDGE_PROXY_URL, text, voice, "+0%", (done, total) => {
        showProgress(Math.round((done / total) * 100));
        setStatus(`Chunk ${done}/${total}…`);
      });
      hideProgress();
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    currentAudioUrl = URL.createObjectURL(blob);
    els.audioPlayer.src = currentAudioUrl;
    els.playerSection.style.display = "flex";
    setStatus(`Done in ${elapsed}s.`);
  } catch (err) {
    setStatus(`Error: ${err.message}`, true);
    console.error(err);
  } finally {
    isGenerating = false;
    els.convertBtn.disabled = false;
    els.convertText.textContent = "Convert";
    els.spinner.style.display = "none";
  }
}

function download() {
  if (!currentAudioUrl) return;
  const ext = currentEngine === "kokoro" ? "wav" : "mp3";
  const a = document.createElement("a");
  a.href = currentAudioUrl;
  a.download = `speech.${ext}`;
  a.click();
}

// ===== UI Helpers =====
function updateCharCount() {
  const len = els.textInput.value.length;
  els.charCount.textContent = `${len.toLocaleString()} chars`;
}

function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.classList.toggle("error", isError);
}

function showProgress(pct) {
  els.progress.style.display = "block";
  els.progressFill.style.width = `${pct}%`;
  els.progressText.textContent = `${pct}%`;
}

function hideProgress() {
  els.progress.style.display = "none";
}
