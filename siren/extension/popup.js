const API_BASE = 'http://localhost:5000';
const MAX_TEXT_LENGTH = 3000;

const scanBtn = document.getElementById('scanBtn');
const statusEl = document.getElementById('status');
const reportEl = document.getElementById('report');
const verdictEl = document.getElementById('verdict');
const progressBar = document.getElementById('progressBar');
const scoreValue = document.getElementById('scoreValue');
const primaryTrigger = document.getElementById('primaryTrigger');
const aiLikelihood = document.getElementById('aiLikelihood');
const summaryEl = document.getElementById('summary');
const patternsEl = document.getElementById('patterns');

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.remove('hidden', 'error');
  if (isError) statusEl.classList.add('error');
}

function hideStatus() {
  statusEl.classList.add('hidden');
}

function setLoading(loading) {
  scanBtn.disabled = loading;
  scanBtn.textContent = loading ? 'SCANNING...' : 'INITIATE SCAN';
}

async function getPageText() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab.');
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.body?.innerText ?? '',
  });
  const full = (results?.[0]?.result ?? '').trim();
  return full.slice(0, MAX_TEXT_LENGTH);
}

async function analyze(text) {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }
  return res.json();
}

function renderReport(data) {
  const score = Math.min(100, Math.max(0, Number(data.risk_score) ?? 0));
  const verdict = (data.verdict || 'UNKNOWN').toUpperCase();
  verdictEl.textContent = verdict;
  verdictEl.className = 'verdict ' + (verdict.includes('HIGH') ? 'danger' : verdict.includes('MODERATE') ? 'warn' : 'safe');
  progressBar.style.width = score + '%';
  progressBar.className = 'progress-bar ' + (score >= 70 ? 'danger' : score >= 40 ? 'warn' : 'safe');
  scoreValue.textContent = score;
  primaryTrigger.textContent = data.primary_trigger || '—';
  aiLikelihood.textContent = data.ai_likelihood || '—';
  summaryEl.textContent = data.analysis_summary || '—';
  patternsEl.innerHTML = '';
  (data.detected_patterns || []).forEach((p) => {
    const tag = document.createElement('span');
    tag.className = 'pattern-tag';
    tag.textContent = p;
    patternsEl.appendChild(tag);
  });
  reportEl.classList.remove('hidden');
}

scanBtn.addEventListener('click', async () => {
  reportEl.classList.add('hidden');
  setLoading(true);
  setStatus('Establishing secure uplink...');

  try {
    await new Promise((r) => setTimeout(r, 400));
    setStatus('Extracting page content...');
    const text = await getPageText();
    if (!text.length) {
      setStatus('No text found on this page.', true);
      setLoading(false);
      return;
    }
    setStatus('Running forensic analysis...');
    const result = await analyze(text);
    hideStatus();
    renderReport(result);
  } catch (e) {
    setStatus(e.message || 'Scan failed.', true);
    reportEl.classList.add('hidden');
  } finally {
    setLoading(false);
  }
});
