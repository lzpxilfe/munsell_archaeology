/**
 * app.js — 고고학용 먼셀 색 판별 도구 메인 로직
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

// ─── Modules ──────────────────────────────────────────────────────────
const converter = new MunsellConverter();
const tempCorrector = new ColorTemperatureCorrector();
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

  // Init picker
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
    picker.setImage(img, state.lightingK, tempCorrector);

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
  $('#clear-image-btn')?.style && ($('#clear-image-btn').style.display = '');
}

function clearImage() {
  state.image = null;
  state.correctedDataCache = null;
  const zone = $('#upload-zone');
  const wrap = $('#canvas-wrapper');
  if (zone) zone.style.display = '';
  if (wrap) wrap.style.display = 'none';
  $('#clear-image-btn').style.display = 'none';
  $('#image-info').textContent = '';
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
    // Highlight closest preset
    const closest = Object.values(tempCorrector.presets)
      .reduce((a, b) => Math.abs(b.K - K) < Math.abs(a.K - K) ? b : a);
    // (don't set active — custom)
  });

  // Init
  setLighting(6504);
  const d65Btn = document.querySelector('.preset-btn[data-k="6504"]');
  if (d65Btn) d65Btn.classList.add('active');
}

function setLighting(K) {
  state.lightingK = K;
  tempCorrector.setCurrentK(K);
  state.correctedDataCache = null;

  // Update picker with new correction
  if (state.image && picker) {
    picker.setLightingK(K, tempCorrector);
  }

  // Update display
  const desc = $('#lighting-desc');
  if (desc) {
    const preset = Object.values(tempCorrector.presets)
      .find(p => Math.abs(p.K - K) < 200);
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
  // Apply color temp correction
  const corrected = tempCorrector.correctPixel(r, g, b, state.lightingK);
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
  $('#bd-hue')?.   ((el) => el.textContent = res.hue);
  $('#bd-value')?.  ((el) => el.textContent = res.value);
  $('#bd-chroma')?.((el) => el.textContent = res.chroma);

  // Compact way without optional chaining issues:
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
    $('#raw-row')?.style && ($('#raw-row').style.display = '');
  } else {
    $('#raw-row')?.style && ($('#raw-row').style.display = 'none');
  }

  // ΔE accuracy badge
  const badge = $('#delta-badge');
  if (badge) {
    badge.textContent = `ΔE ${res.deltaE} — ${res.accuracy.label}`;
    badge.className = `delta-e-badge ${res.accuracy.cls}`;
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
    div.className = `candidate-item${i === 0 ? ' best' : ''}`;
    div.innerHTML = `
      <div class="cand-swatch" style="background:${c.hex}"></div>
      <div class="cand-info">
        <span class="cand-code">${c.code}</span>
        <span class="cand-de ${i===0?'good':c.dE<3?'fair':'poor'}">ΔE ${Math.round(c.dE*10)/10}</span>
      </div>
    `;
    div.addEventListener('click', () => {
      if (state.currentResult) {
        state.currentResult.code    = c.code;
        state.currentResult.chipHex = c.hex;
        state.currentResult.deltaE  = Math.round(c.dE * 10) / 10;
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

  const chips = converter.getSoilColorMap ? converter.getSoilColorMap() :
    converter.chipDB.filter(c => c.code.includes('10YR') || c.code.includes('7.5YR'));

  chips.slice(0, 20).forEach(chip => {
    const el = document.createElement('div');
    el.className = 'soil-chip';
    el.title = chip.code;
    el.innerHTML = `
      <div class="soil-chip-dot" style="background:${chip.hex}"></div>
      <span>${chip.code}</span>
    `;
    el.addEventListener('click', () => {
      toast(`참조: ${chip.code}`, 'info');
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

  const layer = {
    id:        Date.now(),
    number:    numInput?.value || (state.layers.length + 1),
    code:      res.code,
    hex:       res.chipHex,
    korName:   res.korName,
    soilClass: res.soilClass,
    deltaE:    res.deltaE,
    rgb:       res.rgb,
    desc:      descInput?.value || '',
    memo:      memoInput?.value || '',
    lightingK: state.lightingK,
    timestamp: new Date().toLocaleTimeString('ko-KR'),
  };

  state.layers.push(layer);
  if (numInput) numInput.value = '';
  if (descInput) descInput.value = '';
  if (memoInput) memoInput.value = '';

  renderLayerList();
  updateComparisonStrip();
  toast(`층위 ${layer.number} 추가됨: ${layer.code}`, 'success');

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
    card.innerHTML = `
      <div class="layer-swatch" style="background:${layer.hex}"></div>
      <div class="layer-info">
        <div class="layer-number">층위 ${layer.number}</div>
        <div class="layer-munsell">${layer.code}</div>
        <div class="layer-desc">${layer.korName}${layer.desc ? ' — ' + layer.desc : ''}</div>
        <div class="layer-meta">
          ΔE ${layer.deltaE} &nbsp;·&nbsp; ${layer.lightingK}K &nbsp;·&nbsp; ${layer.timestamp}
          ${layer.memo ? `<br><em>${layer.memo}</em>` : ''}
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
    seg.style.background = l.hex;
    seg.dataset.label = `${l.number}: ${l.code}`;
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

  const header = ['층위번호', '먼셀코드', 'Hue', 'Value', 'Chroma',
                   'R', 'G', 'B', 'HEX', '한국어명', '토색분류', '조명(K)',
                   '설명', '메모', '시간', 'ΔE'].join(',');
  const rows = state.layers.map(l => {
    const p = converter._parseCode(l.code);
    return [
      l.number, l.code, p.hue, p.value, p.chroma,
      l.rgb.r, l.rgb.g, l.rgb.b, l.hex,
      `"${l.korName}"`, `"${l.soilClass.label}"`, l.lightingK,
      `"${l.desc}"`, `"${l.memo}"`, l.timestamp, l.deltaE
    ].join(',');
  });

  download('munsell_layers.csv', [header, ...rows].join('\n'), 'text/csv');
  toast('CSV 내보내기 완료', 'success');
}

function exportJSON() {
  if (state.layers.length === 0) { toast('기록된 층위가 없습니다', 'error'); return; }
  const data = {
    exported: new Date().toISOString(),
    lightingK: state.lightingK,
    layers: state.layers,
  };
  download('munsell_layers.json', JSON.stringify(data, null, 2), 'application/json');
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
