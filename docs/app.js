import { EDGE_PROXY_URL } from "./config.js";
import { initKokoro, generateKokoro } from "./engines/kokoro.js";
import { fetchEdgeVoices, generateEdge } from "./engines/edge.js";

// ===== State =====
let currentEngine = "edge"; // "kokoro" | "edge"
let kokoroTts = null;
let kokoroVoices = [];
let edgeVoices = [];
let selectedVoice = "";
let isGenerating = false;
let currentAudioUrl = null;

// ===== DOM =====
const $ = (id) => document.getElementById(id);
const els = {};

document.addEventListener("DOMContentLoaded", () => {
  els.tabKokoro = $("tab-kokoro");
  els.tabEdge = $("tab-edge");
  els.voiceSelectWrap = $("voice-select-wrap");
  els.voiceTrigger = $("voice-trigger");
  els.voiceTriggerText = $("voice-trigger-text");
  els.voiceMenu = $("voice-menu");
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
  els.voiceTrigger.addEventListener("click", toggleVoiceMenu);
  document.addEventListener("click", (e) => {
    if (!els.voiceSelectWrap.contains(e.target)) closeVoiceMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeVoiceMenu();
  });
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
  closeVoiceMenu();
  els.voiceTriggerText.textContent = "Loading voices…";
  els.voiceMenu.innerHTML = "";
  els.voiceTrigger.disabled = true;

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

  els.voiceTrigger.disabled = false;
}

function populateVoices(voices, defaultId) {
  els.voiceMenu.innerHTML = "";
  selectedVoice = "";
  for (const v of voices) {
    const label = v.name + (v.gender ? ` (${v.gender})` : "");
    const li = document.createElement("li");
    li.className = "select-option";
    li.setAttribute("role", "option");
    li.dataset.value = v.id;
    li.textContent = label;
    if (v.id === defaultId || !selectedVoice) {
      selectedVoice = v.id;
      els.voiceTriggerText.textContent = label;
    }
    li.addEventListener("click", () => selectVoiceOption(v.id, label));
    els.voiceMenu.appendChild(li);
  }
  updateSelectedOptionUI();
}

function selectVoiceOption(id, label) {
  selectedVoice = id;
  els.voiceTriggerText.textContent = label;
  updateSelectedOptionUI();
  closeVoiceMenu();
}

function updateSelectedOptionUI() {
  for (const li of els.voiceMenu.children) {
    const isSel = li.dataset.value === selectedVoice;
    li.classList.toggle("selected", isSel);
    li.setAttribute("aria-selected", isSel ? "true" : "false");
  }
}

function toggleVoiceMenu() {
  const isOpen = els.voiceSelectWrap.classList.toggle("open");
  els.voiceTrigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
  if (isOpen) {
    const activeEl = els.voiceMenu.querySelector(".select-option.selected");
    if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
  }
}

function closeVoiceMenu() {
  els.voiceSelectWrap.classList.remove("open");
  els.voiceTrigger.setAttribute("aria-expanded", "false");
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

  const voice = selectedVoice;
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
