/**
 * app.js — 고고학용 먼셀 색 판별 도구 메인 로직 (munsell-kit 연동)
 */

// ─── State ────────────────────────────────────────────────────────────
const state = {
  image: null,
  currentResult: null,
  samplingMode: 1,  // 1=1px, 2=3×3, 3=5×5, 4=7×7
  lightingK: 6504,  // D65 default
  wbMode: 'kelvin',        // 'kelvin' | 'graycard' (상호배타)
  wbWhitePoint: null,      // 그레이카드로 추정한 광원 화이트포인트
  wbCCT: null,             // 추정 CCT (표시/기록용)
  layers: [],
  theme: localStorage.getItem('munsell-theme') || 'dark',
};

/**
 * 현재 조명 설정에 따른 이미지 보정 함수 (null = 보정 없음)
 * 픽셀 샘플은 항상 "보정된" 이미지에서 읽으므로, 픽 결과에
 * 추가 보정을 하면 안 된다 (이중 보정 금지).
 */
function currentCorrectFn() {
  if (state.wbMode === 'graycard' && state.wbWhitePoint) {
    const wp = state.wbWhitePoint;
    return (imageData) => ChromAdapt.correctImageDataToD65(imageData, wp);
  }
  if (Math.abs(state.lightingK - 6504) < 50) return null;
  const K = state.lightingK;
  return (imageData) => ChromAdapt.correctImageDataForField(imageData, K);
}

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
let regionSelect = null;
let markers = null;

/** 층위/마커 기록용 현재 WB 스냅샷 */
function currentWbSnapshot() {
  return {
    mode: state.wbMode,
    K: state.wbMode === 'kelvin' ? state.lightingK : null,
    whitePoint: state.wbWhitePoint,
    cct: state.wbCCT,
  };
}

// ─── DOM refs ─────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── Init ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(state.theme);
  setupImageUpload();
  setupLightingControls();
  setupSamplingControls();
  setupToolControls();
  setupMarkerUI();
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
  regionSelect = new RegionSelect(picker, handleRegionResult);
  markers = new Markers(picker, { onChange: renderMarkersPanel });

  // 그레이카드 도구: 원본(미보정)에서 9×9 평균 → 광원 추정 → 전체 보정
  picker.registerTool('graycard', {
    cursor: 'crosshair',
    up: (pos, e) => {
      if (e.target !== canvas || e.button !== 0) return;
      if (!picker.view.inImage(pos.ix, pos.iy)) return;
      const raw = picker.view.sampleRawAt(pos.ix, pos.iy, 9);
      if (raw) applyGraycard(raw);
    },
  });

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

/**
 * 이미지 교체/제거 시 이전 이미지에 종속된 상태 정리
 * (마커·영역은 이미지 좌표 기반이라 다른 사진에 이월되면 잘못된 기록이 됨)
 */
function resetPerImageState() {
  markers?.clear();
  regionSelect?.clear();
  state.currentResult = null;
  const pinBtn = $('#pin-marker-btn');
  if (pinBtn) pinBtn.disabled = true;
  const addBtn = $('#add-layer-btn');
  if (addBtn) addBtn.disabled = true;
  renderSampleStats(null);
}

function loadImageFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    resetPerImageState();
    state.image = img;
    showCanvas();
    const { downscaled } = picker.setImage(img, currentCorrectFn());
    if (downscaled) {
      toast('큰 사진이라 분석용 해상도로 축소했습니다 (색 정확도에는 영향 없음)', 'info');
    }

    // Show image info
    const info = $('#image-info');
    if (info) {
      info.textContent = `${img.naturalWidth} × ${img.naturalHeight}px`
        + (downscaled ? ` → ${picker.view.imgWidth} × ${picker.view.imgHeight}px` : '');
    }
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
  resetPerImageState();
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
  // 프리셋/슬라이더 조작 시 그레이카드 모드는 해제 (상호배타)
  const wasGraycard = state.wbMode === 'graycard';
  state.wbMode = 'kelvin';
  state.wbWhitePoint = null;
  state.wbCCT = null;
  state.lightingK = K;

  // 보정본 갱신 (샘플링·표시 모두 이 보정본 기준)
  if (state.image && picker) {
    picker.setCorrection(currentCorrectFn());
  }

  if (wasGraycard) toast('그레이카드 보정 해제 — 색온도 모드로 전환', 'info');
  updateWbUI();

  // Update display
  const desc = $('#lighting-desc');
  if (desc) {
    const preset = LIGHTING_PRESETS[K] || Object.values(LIGHTING_PRESETS)
      .reduce((a, b) => Math.abs(b.K - K) < Math.abs(a.K - K) ? b : a);
    desc.textContent = preset ? preset.desc : `${K}K`;
  }
}

// ─── 그레이카드 화이트밸런스 ──────────────────────────────────────────
/**
 * @param {{r,g,b}} raw  원본(미보정) 픽셀 평균 — 무채색 가정
 */
function applyGraycard(raw) {
  const est = ChromAdapt.estimateIlluminantFromGray(raw.r, raw.g, raw.b);

  if (est.warnings.includes('clipped_high')) {
    toast('선택 지점이 과노출(클리핑)되어 기준으로 쓸 수 없습니다. 회색 부분을 클릭하세요.', 'error');
    return;
  }
  if (est.warnings.includes('clipped_low')) {
    toast('선택 지점이 너무 어두워 기준으로 쓸 수 없습니다. 회색 부분을 클릭하세요.', 'error');
    return;
  }
  if (est.warnings.includes('not_neutral')) {
    toast('선택 지점이 광원 색으로 보기 어렵습니다 — 회색 카드나 무채색 물체를 클릭하세요', 'error');
    return;
  }
  if (est.warnings.includes('suspicious_cct')) {
    toast(`주의: 추정 광원이 매우 따뜻합니다 (≈${est.cct}K) — 클릭 지점이 갈색 흙이라면 잘못된 보정입니다`, 'error');
  }

  state.wbMode = 'graycard';
  state.wbWhitePoint = est.wp;
  state.wbCCT = est.cct;

  if (state.image && picker) picker.setCorrection(currentCorrectFn());
  updateWbUI();
  toast(`🎯 그레이카드 보정 적용 (추정 광원 ≈${est.cct}K)`, 'success');
}

/** 조명 UI 상태 동기화: 배지, 슬라이더, 프리셋 활성 표시 */
function updateWbUI() {
  const badge  = $('#wb-badge');
  const slider = $('#kelvin-slider');
  const label  = $('#kelvin-label');
  const graycard = state.wbMode === 'graycard';

  if (badge) {
    badge.style.display = graycard ? '' : 'none';
    if (graycard) badge.textContent = `🎯 그레이카드 보정 적용 중 — 추정 광원 ≈${state.wbCCT}K`;
  }
  if (slider) {
    slider.disabled = graycard;
    if (graycard && state.wbCCT) {
      slider.value = Math.max(2500, Math.min(10000, state.wbCCT));
      if (label) label.textContent = `≈${state.wbCCT}K`;
    }
  }
  if (graycard) {
    $$('.preset-btn').forEach(b => b.classList.remove('active'));
    const desc = $('#lighting-desc');
    if (desc) desc.textContent = `그레이카드 (≈${state.wbCCT}K)`;
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

// ─── Tool Selection ───────────────────────────────────────────────────
function setupToolControls() {
  $$('.tool-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      picker?.setTool(chip.dataset.tool);
      $$('.tool-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });
}

// ─── Color Pick Handler ───────────────────────────────────────────────
/**
 * @param {{r,g,b, raw?}} color
 *   캔버스 픽: 이미 조명 보정된 값 + raw(보정 전) — 재보정하지 않는다.
 *   화면 스포이드/참조 칩: 화면 표시색 그대로 (촬영 조명 보정 개념 없음).
 */
function handleColorPick({ r, g, b, raw, point }) {
  const result = converter.analyze(r, g, b);
  result.rawRgb = raw || null;   // 보정 전 원본 픽셀 (표시용)
  result.sampleStats = null;     // 점 샘플 — 영역 통계 없음
  result.point = point || null;  // 이미지 좌표 (마커 고정용)
  result.wb = currentWbSnapshot();  // 채취 시점 WB — 기록 시점이 아님 (재현성)

  state.currentResult = result;
  renderResult(result);
}

/**
 * 영역 선택(사각형/올가미) 결과 처리 — regionSelect.js 콜백
 * @param {{r,g,b,stats}} avg     로버스트 평균색
 * @param {{kind, geometry}} region  선택 영역 (마커 승격용)
 */
function handleRegionResult(avg, region) {
  const result = converter.analyze(avg.r, avg.g, avg.b);
  result.rawRgb = null;
  result.sampleStats = avg.stats;
  result.region = region;
  result.wb = currentWbSnapshot();  // 채취 시점 WB

  state.currentResult = result;
  renderResult(result);

  const s = avg.stats;
  const usedPct = Math.round(s.used / s.sampled * 100);
  toast(`영역 평균: ${result.code} (픽셀 ${usedPct}% 사용)`, 'success');
}

// ─── Render Result ────────────────────────────────────────────────────
function renderResult(res) {
  if (!res) return;

  // Main swatch
  const swatch = $('#result-swatch');
  if (swatch) {
    swatch.style.background = res.hex;
    swatch.title = res.hex;
    swatch.querySelector('.swatch-empty')?.remove();
  }

  // Munsell chip swatch
  const chipSwatch = $('#chip-swatch');
  if (chipSwatch) {
    chipSwatch.style.background = res.chipHex;
    chipSwatch.querySelector('.swatch-empty')?.remove();
  }

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

  // Raw (uncorrected) RGB — 보정 전후가 다를 때만 표시
  const rawDiffers = res.rawRgb &&
    (res.rawRgb.r !== res.rgb.r || res.rawRgb.g !== res.rgb.g || res.rawRgb.b !== res.rgb.b);
  if (rawDiffers) {
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

  // 영역 평균 통계 (영역 선택일 때만)
  renderSampleStats(res.sampleStats);

  // Candidates list
  renderCandidates(res.candidates);

  // Enable add-layer / pin-marker buttons
  const addBtn = $('#add-layer-btn');
  if (addBtn) addBtn.disabled = false;
  const pinBtn = $('#pin-marker-btn');
  if (pinBtn) pinBtn.disabled = !(res.region || res.point);
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderSampleStats(stats) {
  const el = $('#sample-stats');
  if (!el) return;
  if (!stats) { el.style.display = 'none'; el.innerHTML = ''; return; }

  const pct = n => stats.sampled ? Math.round(n / stats.sampled * 1000) / 10 : 0;
  const parts = [];
  if (stats.excludedHighlight) parts.push(`하이라이트 ${pct(stats.excludedHighlight)}%`);
  if (stats.excludedShadow)    parts.push(`암부 클리핑 ${pct(stats.excludedShadow)}%`);
  if (stats.excludedLstar)     parts.push(`명암 상·하위 ${pct(stats.excludedLstar)}%`);
  if (stats.excludedChroma)    parts.push(`색도 이상 ${pct(stats.excludedChroma)}%`);

  el.innerHTML = `📐 영역 ${stats.total.toLocaleString()}px`
    + (stats.sampled < stats.total ? ` (표본 ${stats.sampled.toLocaleString()})` : '')
    + ` — <strong>${pct(stats.used)}% 사용</strong>`
    + (parts.length ? `<br>제외: ${parts.join(' · ')}` : '');
  el.style.display = '';
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
        // 코드에서 파생되는 표기들도 함께 갱신 (안 하면 CSV에 모순 기록)
        state.currentResult.korName   = converter._korName(parsed);
        state.currentResult.soilClass = converter._soilClass(parsed);
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

// ─── Markers (다중 지점 비교) ─────────────────────────────────────────
function setupMarkerUI() {
  $('#pin-marker-btn')?.addEventListener('click', () => {
    if (!state.currentResult || !markers || !picker?.hasImage) return;
    const m = markers.add(state.currentResult, state.currentResult.wb || currentWbSnapshot());
    if (m) toast(`마커 ${m.label} 고정: ${m.result.code}`, 'success');
    else   toast('사진 위에서 채취한 결과만 마커로 고정할 수 있습니다', 'error');
  });

  $('#markers-recompute')?.addEventListener('click', () => {
    if (!markers?.items.length) return;
    markers.recomputeAll((r, g, b) => converter.analyze(r, g, b), currentWbSnapshot());
    toast('모든 마커를 현재 조명 보정 기준으로 재계산했습니다', 'info');
  });

  $('#markers-clear')?.addEventListener('click', () => {
    if (markers?.items.length && confirm('마커를 모두 삭제하시겠습니까?')) markers.clear();
  });
}

function renderMarkersPanel() {
  const section = $('#markers-section');
  const list = $('#markers-list');
  if (!section || !list) return;

  if (!markers || markers.items.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';
  list.innerHTML = '';

  const kindIcon = { point: '📍', rect: '▭', lasso: '✎' };
  markers.items.forEach(m => {
    const row = document.createElement('div');
    row.className = 'marker-row' + (markers.selected.has(m.id) ? ' selected' : '');
    row.innerHTML = `
      <input type="checkbox" ${markers.selected.has(m.id) ? 'checked' : ''} title="비교 대상으로 선택 (2개까지)">
      <span class="marker-label">${m.label}</span>
      <span class="marker-swatch" style="background:${m.result.chipHex}"></span>
      <span class="marker-info">
        <span class="marker-code">${m.result.code}</span>
        <span class="marker-name">${kindIcon[m.kind] || ''} ${m.result.korName}</span>
      </span>
      <button class="btn btn-sm btn-ghost" data-act="layer" title="이 마커를 층위 기록으로 추가">층위↑</button>
      <button class="btn btn-icon btn-danger btn-sm" data-act="del" title="마커 삭제">✕</button>
    `;
    row.querySelector('input').addEventListener('change', () => markers.toggleSelect(m.id));
    row.querySelector('[data-act="layer"]').addEventListener('click', () => addLayer(m.result, m.wb));
    row.querySelector('[data-act="del"]').addEventListener('click', () => markers.remove(m.id));
    list.appendChild(row);
  });

  // 상호 비교
  const cmp = $('#markers-compare');
  if (cmp) {
    const mut = markers.mutualDeltaE();
    if (mut && mut.a.result.lab_C && mut.b.result.lab_C) {
      cmp.style.display = '';
      const verdict = mut.equivalent
        ? '<span class="cmp-same">지각적으로 동일 (등가) — 같은 층일 가능성 높음</span>'
        : mut.dE < 3.5
          ? '<span class="cmp-near">근접 — 유사한 토색</span>'
          : '<span class="cmp-diff">뚜렷이 다른 색 — 다른 층위 가능성</span>';
      cmp.innerHTML = `<strong>${mut.a.label} ↔ ${mut.b.label}</strong> &nbsp;ΔE2000 = ${mut.dE.toFixed(2)}<br>${verdict}`;
    } else if (markers.items.length >= 2) {
      cmp.style.display = '';
      cmp.innerHTML = '<span style="color:var(--text-muted)">두 마커를 체크하면 상호 색차(ΔE2000)를 비교합니다</span>';
    } else {
      cmp.style.display = 'none';
    }
  }
}

// ─── Layer Recording ──────────────────────────────────────────────────
function setupLayerUI() {
  $('#add-layer-btn')?.addEventListener('click', () => addLayer());
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

/**
 * 층위 기록 추가
 * @param {object} res  분석 결과 (기본: 현재 결과) — 마커 승격 시 마커의 result
 * @param {object} wb   WB 스냅샷 (기본: 현재 상태) — 마커 승격 시 채취 당시 값
 */
function addLayer(res = state.currentResult, wb = null) {
  if (!res) return;
  // WB는 채취 시점 스냅샷 우선 — 기록 버튼을 누른 시점의 상태가 아니라
  // 그 색이 실제로 계산된 조건을 기록해야 재현 가능하다.
  wb = wb || res.wb || currentWbSnapshot();

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
  layer.matrix.lightingK = wb.mode === 'graycard' ? wb.cct : wb.K;
  layer.matrix.wb = wb;
  layer.matrix.sampleStats = res.sampleStats || null;
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
}

function exportJSON() {
  if (state.layers.length === 0) { toast('기록된 층위가 없습니다', 'error'); return; }
  const json = FieldRecord.toJSON(state.layers, { site: '고고학 조사' });
  download('munsell_layers.json', json, 'application/json');
}

async function download(filename, content, type) {
  // 데스크톱 앱: 네이티브 저장 대화상자 (desktopBridge.js)
  if (typeof DesktopBridge !== 'undefined' && DesktopBridge.isDesktop()) {
    try {
      const res = await DesktopBridge.saveFile(filename, content, type);
      if (res?.ok)                        toast(`저장 완료: ${res.path}`, 'success');
      else if (res?.reason !== 'cancelled') toast(`저장 실패: ${res?.reason || '알 수 없는 오류'}`, 'error');
    } catch (e) {
      toast(`저장 실패: ${e.message}`, 'error');
    }
    return;
  }

  // 브라우저: Blob 다운로드
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`${filename} 내보내기 완료`, 'success');
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
