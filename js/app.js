/**
 * app.js — 고고학용 먼셀 색 판별 도구 메인 로직 (munsell-kit 연동)
 */

// ─── State ────────────────────────────────────────────────────────────
const state = {
  image: null,
  currentResult: null,
  samplingMode: 1,  // 1=1px, 2=3×3, 3=5×5, 4=7×7
  lightingK: 6504,  // D65 default
  correctedDataCache: null,
  layers: [],
  theme: localStorage.getItem('munsell-theme') || 'dark',
};

// ─── Preset Lighting Descriptions ─────────────────────────────────────
const LIGHTING_PRESETS = {
  5500: { K: 5500, label: '맑은 날 직사광', icon: '☀️', desc: '직사광선 (5500K)' },
  6500: { K: 6500, label: '흐린 날',         icon: '🌤️', desc: '엷은 구름 (6500K)' },
  7500: { K: 7500, label: '흐린 날씨/구름',   icon: '☁️', desc: '흐린 날 (7500K)' },
  9000: { K: 9000, label: '그늘',             icon: '🌿', desc: '나무 그늘 (9000K)' },
  4000: { K: 4000, label: '실내 LED',        icon: '🔆', desc: 'LED (4000K)' },
  3200: { K: 3200, label: '실내 인공조명',   icon: '💡', desc: '텅스텐 (3200K)' },
  6504: { K: 6504, label: '표준 기준 (D65)', icon: '⚖️', desc: '보정 없음 (6504K)' },
};

// ─── Modules ──────────────────────────────────────────────────────────
const chipsDB = ChipDatabase.build();
const converter = new MunsellConvert(chipsDB);
let picker = null;

// ─── DOM refs ─────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── Init ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(state.theme);
  setupImageUpload();
  setupLightingControls();
  setupSamplingControls();
  setupLayerUI();
  setupExport();
  setupMiscControls();
  setupPasteSupport();
  renderSoilReference();
  renderLayerList();
});

// ─── Theme ────────────────────────────────────────────────────────────
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('munsell-theme', theme);
  const btn = $('#theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function setupMiscControls() {
  $('#theme-toggle')?.addEventListener('click', () => {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  });

  window.addEventListener('resize', () => picker?.resize());

  // EyeDropper API fallback button (Chrome/Edge only)
  const eyedropperBtn = $('#eyedropper-btn');
  if ('EyeDropper' in window && eyedropperBtn) {
    eyedropperBtn.style.display = '';
    eyedropperBtn.addEventListener('click', async () => {
      try {
        const ed = new EyeDropper();
        const { sRGBHex } = await ed.open();
        const r = parseInt(sRGBHex.slice(1,3), 16);
        const g = parseInt(sRGBHex.slice(3,5), 16);
        const b = parseInt(sRGBHex.slice(5,7), 16);
        handleColorPick({ r, g, b });
      } catch {}
    });
  }
}

// ─── Image Upload ─────────────────────────────────────────────────────
function setupImageUpload() {
  const zone    = $('#upload-zone');
  const input   = $('#file-input');
  const canvas  = $('#main-canvas');
  const magnifier = $('#magnifier');
  const magCanvas = $('#magnifier-canvas');

  // Init picker (ChromAdapt is used as the temperature corrector)
  picker = new ColorPicker(canvas, magnifier, magCanvas, handleColorPick);

  // Click on zone
  zone?.addEventListener('click', () => input?.click());

  input?.addEventListener('change', (e) => {
    if (e.target.files[0]) loadImageFile(e.target.files[0]);
  });

  // Drag & Drop
  zone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone?.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone?.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadImageFile(file);
  });

  $('#clear-image-btn')?.addEventListener('click', clearImage);
}

function setupPasteSupport() {
  document.addEventListener('paste', (e) => {
    const item = [...e.clipboardData.items].find(i => i.type.startsWith('image/'));
    if (item) {
      const blob = item.getAsFile();
      loadImageFile(blob);
      toast('클립보드에서 이미지를 붙여넣었습니다', 'info');
    }
  });
}

function loadImageFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.image = img;
    state.correctedDataCache = null;
    showCanvas();
    picker.setImage(img, state.lightingK, ChromAdapt);

    // Show image info
    const info = $('#image-info');
    if (info) info.textContent = `${img.naturalWidth} × ${img.naturalHeight}px`;
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function showCanvas() {
  const zone = $('#upload-zone');
  const wrap = $('#canvas-wrapper');
  if (zone) zone.style.display = 'none';
  if (wrap) wrap.style.display = 'flex';
  const clearBtn = $('#clear-image-btn');
  if (clearBtn) clearBtn.style.display = '';
}

function clearImage() {
  state.image = null;
  state.correctedDataCache = null;
  const zone = $('#upload-zone');
  const wrap = $('#canvas-wrapper');
  if (zone) zone.style.display = '';
  if (wrap) wrap.style.display = 'none';
  const clearBtn = $('#clear-image-btn');
  if (clearBtn) clearBtn.style.display = 'none';
  const imgInfo = $('#image-info');
  if (imgInfo) imgInfo.textContent = '';
}

// ─── Lighting / Color Temperature ─────────────────────────────────────
function setupLightingControls() {
  // Preset buttons
  $$('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const K = parseInt(btn.dataset.k);
      setLighting(K);
      $$('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Custom slider
  const slider = $('#kelvin-slider');
  const label  = $('#kelvin-label');
  slider?.addEventListener('input', () => {
    const K = parseInt(slider.value);
    setLighting(K);
    if (label) label.textContent = `${K}K`;
    $$('.preset-btn').forEach(b => b.classList.remove('active'));
  });

  // Init
  setLighting(6504);
  const d65Btn = document.querySelector('.preset-btn[data-k="6504"]');
  if (d65Btn) d65Btn.classList.add('active');
}

function setLighting(K) {
  state.lightingK = K;
  state.correctedDataCache = null;

  // Update picker with new correction (ChromAdapt used directly)
  if (state.image && picker) {
    picker.setLightingK(K, ChromAdapt);
  }

  // Update display
  const desc = $('#lighting-desc');
  if (desc) {
    const preset = LIGHTING_PRESETS[K] || Object.values(LIGHTING_PRESETS)
      .reduce((a, b) => Math.abs(b.K - K) < Math.abs(a.K - K) ? b : a);
    desc.textContent = preset ? preset.desc : `${K}K`;
  }
}

// ─── Sampling Mode ────────────────────────────────────────────────────
function setupSamplingControls() {
  $$('.sample-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.samplingMode = parseInt(chip.dataset.mode);
      picker?.setSampleRadius(state.samplingMode);
      $$('.sample-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });
}

// ─── Color Pick Handler ───────────────────────────────────────────────
function handleColorPick({ r, g, b }) {
  // Apply CAT02 chromatic adaptation from field lighting K to D65
  const corrected = ChromAdapt.correctPixelForField(r, g, b, state.lightingK);
  const { r: rc, g: gc, b: bc } = corrected;

  // Run Munsell analysis
  const result = converter.analyze(rc, gc, bc);
  result.rawRgb = { r, g, b };  // store original for display

  state.currentResult = result;
  renderResult(result);
}

// ─── Render Result ────────────────────────────────────────────────────
function renderResult(res) {
  if (!res) return;

  // Main swatch
  const swatch = $('#result-swatch');
  if (swatch) {
    swatch.style.background = res.hex;
    swatch.title = res.hex;
  }

  // Munsell chip swatch
  const chipSwatch = $('#chip-swatch');
  if (chipSwatch) chipSwatch.style.background = res.chipHex;

  // Code
  const code = $('#munsell-code');
  if (code) code.textContent = res.code;

  // Korean name
  const korName = $('#kor-name');
  if (korName) korName.textContent = res.korName;

  // Soil class
  const soilCls = $('#soil-class');
  if (soilCls) {
    soilCls.textContent = res.soilClass.label;
    soilCls.dataset.cls = res.soilClass.class;
  }

  // Breakdown (Hue / Value / Chroma)
  setEl('bd-hue',    res.hue);
  setEl('bd-value',  res.value);
  setEl('bd-chroma', res.chroma);

  // RGB values
  setEl('val-r',   res.rgb.r);
  setEl('val-g',   res.rgb.g);
  setEl('val-b',   res.rgb.b);
  setEl('val-hex', res.hex.toUpperCase());

  // Raw (uncorrected) RGB
  if (res.rawRgb && Math.abs(state.lightingK - 6504) > 100) {
    setEl('val-raw-r', res.rawRgb.r);
    setEl('val-raw-g', res.rawRgb.g);
    setEl('val-raw-b', res.rawRgb.b);
    const rawRow = $('#raw-row');
    if (rawRow && rawRow.style) rawRow.style.display = '';
  } else {
    const rawRow = $('#raw-row');
    if (rawRow && rawRow.style) rawRow.style.display = 'none';
  }

  // ΔE accuracy badge
  const badge = $('#delta-badge');
  if (badge) {
    badge.textContent = `ΔE ${res.deltaE} — ${res.accuracy.label}`;
    badge.className = `delta-e-badge ${res.accuracy.cls}`;
    badge.style.display = '';
  }

  // Candidates list
  renderCandidates(res.candidates);

  // Enable add-layer button
  const addBtn = $('#add-layer-btn');
  if (addBtn) addBtn.disabled = false;
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─── Candidates ───────────────────────────────────────────────────────
function renderCandidates(candidates) {
  const list = $('#candidates-list');
  if (!list) return;
  list.innerHTML = '';

  candidates.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = `candidate-item${c.equivalent ? ' best' : ''}`;
    div.innerHTML = `
      <div class="cand-swatch" style="background:${c.hex}"></div>
      <div class="cand-info">
        <span class="cand-code">${c.code}</span>
        <span class="cand-de ${c.equivalent ? 'good' : c.dE < NearestChip.EQUIVALENCE_THRESHOLD * 1.6 ? 'fair' : 'poor'}">
          ΔE ${c.dE.toFixed(1)} ${c.equivalent ? '(등가)' : ''}
        </span>
      </div>
    `;
    div.addEventListener('click', () => {
      if (state.currentResult) {
        state.currentResult.code    = c.code;
        state.currentResult.chipHex = c.hex;
        state.currentResult.deltaE  = c.dE;
        state.currentResult.accuracy = NearestChip.accuracy(c.dE);
        const parsed = converter._parseCode(c.code);
        Object.assign(state.currentResult, parsed);
        renderResult(state.currentResult);
        toast(`${c.code} 선택됨`, 'info');
      }
    });
    list.appendChild(div);
  });
}

// ─── Soil Reference ───────────────────────────────────────────────────
function renderSoilReference() {
  const container = $('#soil-chips');
  if (!container) return;

  // Filter YR family for standard soil color cards
  const chips = chipsDB.filter(c => c.code.includes('10YR') && c.value >= 3 && c.value <= 6);

  chips.slice(0, 24).forEach(chip => {
    const el = document.createElement('div');
    el.className = 'soil-chip';
    el.title = chip.code;
    el.innerHTML = `
      <div class="soil-chip-dot" style="background:${chip.hex}"></div>
      <span>${chip.code}</span>
    `;
    el.addEventListener('click', () => {
      // Analyze the chip color directly to preview it
      const r = parseInt(chip.hex.slice(1,3), 16);
      const g = parseInt(chip.hex.slice(3,5), 16);
      const b = parseInt(chip.hex.slice(5,7), 16);
      handleColorPick({ r, g, b });
      toast(`참조 칩 선택: ${chip.code}`, 'info');
    });
    container.appendChild(el);
  });
}

// ─── Layer Recording ──────────────────────────────────────────────────
function setupLayerUI() {
  $('#add-layer-btn')?.addEventListener('click', addLayer);
  $('#sort-asc')?.addEventListener('click',  () => sortLayers('asc'));
  $('#sort-desc')?.addEventListener('click', () => sortLayers('desc'));
  $('#clear-layers-btn')?.addEventListener('click', () => {
    if (confirm('모든 층위 기록을 삭제하시겠습니까?')) {
      state.layers = [];
      renderLayerList();
      updateComparisonStrip();
    }
  });
}

function addLayer() {
  const res = state.currentResult;
  if (!res) return;

  const numInput  = $('#layer-num');
  const descInput = $('#layer-desc');
  const memoInput = $('#layer-memo');
  const condSelect = $('#layer-condition');
  const depthTopInput = $('#layer-depth-top');
  const depthBottomInput = $('#layer-depth-bottom');

  const layer = FieldRecord.createLayer(Date.now());

  // Set layer attributes
  layer.number = numInput?.value || (state.layers.length + 1);
  layer.depth_top = depthTopInput?.value ? parseFloat(depthTopInput.value) : null;
  layer.depth_bottom = depthBottomInput?.value ? parseFloat(depthBottomInput.value) : null;
  layer.notes = memoInput?.value || '';

  // Matrix color attributes
  layer.matrix.code = res.code;
  layer.matrix.condition = condSelect?.value || 'moist';
  layer.matrix.hex = res.chipHex;
  layer.matrix.korName = res.korName;
  layer.matrix.deltaE = res.deltaE;
  layer.matrix.lightingK = state.lightingK;
  layer.matrix.rgb = res.rgb;
  layer.matrix.pipeline = res.pipeline;

  // Optional color description from user
  layer.desc = descInput?.value || '';

  state.layers.push(layer);

  // Reset/increment form
  if (numInput) numInput.value = '';
  if (descInput) descInput.value = '';
  if (memoInput) memoInput.value = '';
  if (depthTopInput) depthTopInput.value = '';
  if (depthBottomInput) depthBottomInput.value = '';

  renderLayerList();
  updateComparisonStrip();
  toast(`층위 ${layer.number} 추가됨: ${layer.matrix.code}`, 'success');

  // Auto-increment layer number
  const nextNum = parseInt(layer.number || 0) + 1;
  if (numInput && !isNaN(nextNum)) numInput.value = nextNum;
}

function removeLayer(id) {
  state.layers = state.layers.filter(l => l.id !== id);
  renderLayerList();
  updateComparisonStrip();
}

function sortLayers(dir) {
  state.layers.sort((a, b) => {
    const na = parseInt(a.number) || 0;
    const nb = parseInt(b.number) || 0;
    return dir === 'asc' ? na - nb : nb - na;
  });
  renderLayerList();
}

function renderLayerList() {
  const list  = $('#layers-list');
  const count = $('#layer-count');
  if (!list) return;

  if (count) count.textContent = `${state.layers.length}개 층위`;

  if (state.layers.length === 0) {
    list.innerHTML = `
      <div class="layers-empty">
        <div class="layers-empty-icon">🏺</div>
        <div class="layers-empty-text">스포이드로 색을 채취한 후<br>층위를 추가하세요</div>
      </div>`;
    return;
  }

  list.innerHTML = '';
  state.layers.forEach(layer => {
    const card = document.createElement('div');
    card.className = 'layer-card';

    // Format depth string
    const depthStr = (layer.depth_top !== null && layer.depth_bottom !== null)
      ? `<span class="layer-depth">${layer.depth_top} – ${layer.depth_bottom} cm</span>`
      : '';

    // Condition label
    const condLabel = FieldRecord.CONDITION_LABEL[layer.matrix.condition] || layer.matrix.condition;

    card.innerHTML = `
      <div class="layer-swatch" style="background:${layer.matrix.hex}"></div>
      <div class="layer-info">
        <div style="display:flex; justify-content:space-between; align-items:baseline">
          <div class="layer-number">층위 ${layer.number}</div>
          ${depthStr}
        </div>
        <div class="layer-munsell">${layer.matrix.code} <span style="font-size:0.7rem; color:var(--text-muted)">(${condLabel})</span></div>
        <div class="layer-desc">
          <strong>${layer.matrix.korName}</strong>${layer.desc ? ' (' + layer.desc + ')' : ''}
          ${layer.notes ? `<div class="layer-notes-memo">📝 ${layer.notes}</div>` : ''}
        </div>
        <div class="layer-meta">
          ΔE ${layer.matrix.deltaE.toFixed(1)} &nbsp;·&nbsp; ${layer.matrix.lightingK}K &nbsp;·&nbsp; ${layer.timestamp}
        </div>
      </div>
      <div class="layer-actions">
        <button class="btn btn-icon btn-danger btn-sm" onclick="removeLayer(${layer.id})" title="삭제">✕</button>
      </div>
    `;
    list.appendChild(card);
  });
}

function updateComparisonStrip() {
  const strip = $('#comparison-strip');
  if (!strip) return;
  strip.innerHTML = '';
  state.layers.forEach(l => {
    const seg = document.createElement('div');
    seg.className = 'comparison-segment';
    seg.style.background = l.matrix.hex;
    seg.dataset.label = `${l.number}: ${l.matrix.code}`;
    strip.appendChild(seg);
  });
}

// ─── Export ───────────────────────────────────────────────────────────
function setupExport() {
  $('#export-csv')?.addEventListener('click', exportCSV);
  $('#export-json')?.addEventListener('click', exportJSON);
  $('#copy-code')?.addEventListener('click', () => {
    if (state.currentResult) {
      navigator.clipboard.writeText(state.currentResult.code);
      toast(`${state.currentResult.code} 복사됨`, 'success');
    }
  });
}

function exportCSV() {
  if (state.layers.length === 0) { toast('기록된 층위가 없습니다', 'error'); return; }
  const csv = FieldRecord.toCSVRows(state.layers);
  download('munsell_layers.csv', csv, 'text/csv');
  toast('CSV 내보내기 완료', 'success');
}

function exportJSON() {
  if (state.layers.length === 0) { toast('기록된 층위가 없습니다', 'error'); return; }
  const json = FieldRecord.toJSON(state.layers, { site: '고고학 조사' });
  download('munsell_layers.json', json, 'application/json');
  toast('JSON 내보내기 완료', 'success');
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── Toast ────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  t.innerHTML = `<span>${icons[type] || ''}</span> ${msg}`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

// ─── Global copy helper ───────────────────────────────────────────────
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => toast(`복사됨: ${text}`, 'success'));
}
