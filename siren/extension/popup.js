const API_BASE = 'http://localhost:5000';

const tabText = document.getElementById('tabText');
const tabMedia = document.getElementById('tabMedia');
const panelText = document.getElementById('panelText');
const panelMedia = document.getElementById('panelMedia');
const scanTextBtn = document.getElementById('scanTextBtn');
const scanMediaBtn = document.getElementById('scanMediaBtn');
const textStatus = document.getElementById('textStatus');
const mediaStatus = document.getElementById('mediaStatus');
const textReport = document.getElementById('textReport');
const mediaReport = document.getElementById('mediaReport');
const textVerdict = document.getElementById('textVerdict');
const textProgressBar = document.getElementById('textProgressBar');
const textScoreValue = document.getElementById('textScoreValue');
const textAnalysis = document.getElementById('textAnalysis');
const textPatterns = document.getElementById('textPatterns');
const factChecksBlock = document.getElementById('factChecksBlock');
const factChecksList = document.getElementById('factChecksList');
const mediaGauge = document.getElementById('mediaGauge');
const mediaScoreValue = document.getElementById('mediaScoreValue');
const mediaVerdict = document.getElementById('mediaVerdict');

function setTextStatus(msg, isError = false) {
  textStatus.textContent = msg;
  textStatus.classList.remove('hidden', 'error');
  if (isError) textStatus.classList.add('error');
}
function setMediaStatus(msg, isError = false) {
  mediaStatus.textContent = msg;
  mediaStatus.classList.remove('hidden', 'error');
  if (isError) mediaStatus.classList.add('error');
}

function hideTextStatus() { textStatus.classList.add('hidden'); }
function hideMediaStatus() { mediaStatus.classList.add('hidden'); }

tabText.addEventListener('click', () => {
  tabText.classList.add('active');
  tabMedia.classList.remove('active');
  panelText.classList.add('active');
  panelMedia.classList.remove('active');
});
tabMedia.addEventListener('click', () => {
  tabMedia.classList.add('active');
  tabText.classList.remove('active');
  panelMedia.classList.add('active');
  panelText.classList.remove('active');
});

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');
  return tab;
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  } catch (e) {
    throw new Error('Cannot access this page. Try a normal website.');
  }
}

async function getPageText() {
  const tab = await getCurrentTab();
  await ensureContentScript(tab.id);
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, { type: 'getText' }, (res) => {
      if (chrome.runtime.lastError) return reject(new Error('Page did not respond. Reload and try again.'));
      if (res?.error) return reject(new Error(res.error));
      resolve(res?.text ?? '');
    });
  });
}

async function captureMedia() {
  const tab = await getCurrentTab();
  await ensureContentScript(tab.id);
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, { type: 'captureMedia' }, (res) => {
      if (chrome.runtime.lastError) return reject(new Error('Page did not respond. Reload and try again.'));
      if (res?.error) return reject(new Error(res.error));
      resolve(res);
    });
  });
}

async function analyzeText(text) {
  const res = await fetch(`${API_BASE}/analyze-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server ${res.status}`);
  }
  return res.json();
}

async function analyzeMedia(formData) {
  const res = await fetch(`${API_BASE}/analyze-media`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server ${res.status}`);
  }
  return res.json();
}

function dataUrlToBlob(dataUrl) {
  const [head, data] = dataUrl.split(',');
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function renderTextReport(data) {
  const score = Math.min(100, Math.max(0, Number(data.risk_score) ?? 0));
  const verdict = (data.verdict || 'SAFE').toUpperCase();
  textVerdict.textContent = verdict;
  textVerdict.className = 'verdict ' + (verdict === 'MISINFO' ? 'danger' : verdict === 'SUSPICIOUS' ? 'warn' : 'safe');
  textProgressBar.style.width = score + '%';
  textProgressBar.className = 'progress-bar ' + (score >= 70 ? 'danger' : score >= 40 ? 'warn' : 'safe');
  textScoreValue.textContent = score;
  textAnalysis.textContent = data.analysis || '—';
  textPatterns.innerHTML = '';
  (data.detected_patterns || []).forEach((p) => {
    const tag = document.createElement('span');
    tag.className = 'pattern-tag';
    tag.textContent = p;
    textPatterns.appendChild(tag);
  });
  factChecksList.innerHTML = '';
  if (Array.isArray(data.fact_checks) && data.fact_checks.length > 0) {
    factChecksBlock.classList.remove('hidden');
    data.fact_checks.forEach((fc) => {
      const review = fc.review;
      const link = document.createElement('a');
      link.className = 'fact-check-link';
      link.href = review?.url || '#';
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = (review?.publisher || review?.title || 'Fact check') + (review?.rating ? ` (${review.rating})` : '');
      factChecksList.appendChild(link);
    });
  } else {
    factChecksBlock.classList.add('hidden');
  }
  textReport.classList.remove('hidden');
}

function renderMediaReport(data) {
  const pct = Math.min(100, Math.max(0, Math.round((data.deepfake_score ?? 0) * 100)));
  mediaGauge.style.width = pct + '%';
  mediaGauge.className = 'gauge-fill ' + (pct >= 60 ? 'danger' : 'safe');
  mediaScoreValue.textContent = pct + '%';
  const verdict = (data.verdict || '').replace(/_/g, ' ');
  mediaVerdict.textContent = verdict;
  mediaVerdict.className = 'verdict ' + (pct >= 60 ? 'danger' : 'safe');
  mediaReport.classList.remove('hidden');
}

scanTextBtn.addEventListener('click', async () => {
  textReport.classList.add('hidden');
  scanTextBtn.disabled = true;
  setTextStatus('Establishing uplink...');
  try {
    await new Promise((r) => setTimeout(r, 300));
    setTextStatus('Extracting page content...');
    const text = await getPageText();
    if (!text || text.length < 20) {
      setTextStatus('Not enough text on this page.', true);
      return;
    }
    setTextStatus('Running text analysis...');
    const result = await analyzeText(text);
    hideTextStatus();
    renderTextReport(result);
  } catch (e) {
    setTextStatus(e.message || 'Scan failed.', true);
  } finally {
    scanTextBtn.disabled = false;
  }
});

scanMediaBtn.addEventListener('click', async () => {
  mediaReport.classList.add('hidden');
  scanMediaBtn.disabled = true;
  setMediaStatus('Capturing visible media...');
  try {
    const captured = await captureMedia();
    if (!captured?.dataUrl) {
      setMediaStatus(captured?.error || 'No video or image found.', true);
      return;
    }
    setMediaStatus('Analyzing for synthetic media...');
    const blob = dataUrlToBlob(captured.dataUrl);
    const form = new FormData();
    form.append('image', blob, 'capture.jpg');
    const result = await analyzeMedia(form);
    hideMediaStatus();
    renderMediaReport(result);
  } catch (e) {
    setMediaStatus(e.message || 'Scan failed.', true);
  } finally {
    scanMediaBtn.disabled = false;
  }
});
