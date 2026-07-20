/**
 * app.js — 고고학용 먼셀 색 판별 도구 메인 로직 (munsell-kit 연동)
 */

// ─── State ────────────────────────────────────────────────────────────
const state = {
  image: null,
  currentResult: null,
  samplingMode: 1,  // 1=1px, 2=3×3, 3=5×5, 4=7×7
  lightingK: 6504,  // D65 default
  wbMode: 'kelvin',        // 'kelvin' | 'graycard' | 'ccm'
  wbWhitePoint: null,      // 그레이카드로 추정한 광원 화이트포인트
  wbCCT: null,             // 추정 CCT (표시/기록용)
  ccmMatrix: null,         // 3x3 CCM 보정 행렬
  ccmTargetType: '6patch',  // '6patch' | 'macbeth' (24색 맥베스)
  ccmPoints: [],           // 캘리브레이션용 클릭 데이터
  ccmCalibrating: false,   // CCM 캘리브레이션 모드 활성화 여부
  vignetteAlpha: 0.0,      // 비네팅 보정 강도 (0.0 ~ 0.5)
  layers: [],
  showLayerBoundaries: true,  // 층위 경계 오버레이 표시 여부
  theme: localStorage.getItem('munsell-theme') || 'dark',
};

/**
 * 현재 조명 설정 및 비네팅 설정에 따른 이미지 보정 함수 (null = 보정 없음)
 * 픽셀 샘플은 항상 "보정된" 이미지에서 읽으므로, 픽 결과에
 * 추가 보정을 하면 안 된다 (이중 보정 금지).
 */
function currentCorrectFn() {
  const alpha = state.vignetteAlpha || 0;
  
  if (state.wbMode === 'ccm' && state.ccmMatrix) {
    const M = state.ccmMatrix;
    return (imageData) => CCMSolver.correctImageData(imageData, M, alpha);
  }
  
  if (state.wbMode === 'graycard' && state.wbWhitePoint) {
    const wp = state.wbWhitePoint;
    return (imageData) => {
      let img = ChromAdapt.correctImageDataToD65(imageData, wp);
      if (alpha > 0) {
        img = CCMSolver.correctImageData(img, null, alpha);
      }
      return img;
    };
  }
  
  const K = state.lightingK;
  const hasKelvinCorrection = Math.abs(K - 6504) >= 50;
  
  if (hasKelvinCorrection || alpha > 0) {
    return (imageData) => {
      let img = imageData;
      if (hasKelvinCorrection) {
        img = ChromAdapt.correctImageDataForField(imageData, K);
      }
      if (alpha > 0) {
        img = CCMSolver.correctImageData(img, null, alpha);
      }
      return img;
    };
  }
  
  return null;
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
let layerOverlay = null;

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
  setupScienceWidget();
  renderSoilReference();
  renderLayerList();
  PixelIcons.replaceInDOM(document.body);
});

// ─── Theme ────────────────────────────────────────────────────────────
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('munsell-theme', theme);
  const btn = $('#theme-toggle');
  if (btn) btn.innerHTML = PixelIcons.get(theme === 'dark' ? '☀️' : '🌙');
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

  // 📸 촬영 가이드 모달 제어
  $('#guide-btn')?.addEventListener('click', () => {
    const modal = $('#guide-modal');
    if (modal) modal.style.display = 'flex';
  });
  $('#close-guide-btn')?.addEventListener('click', () => {
    const modal = $('#guide-modal');
    if (modal) modal.style.display = 'none';
  });
  $('#guide-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.style.display = 'none';
    }
  });
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
  layerOverlay = new LayerOverlay(picker, () => state.layers);
  layerOverlay.visible = state.showLayerBoundaries;

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

  // CCM 컬러체커 캘리브레이션 도구: 순서대로 6색 패치 클릭하여 샘플링
  picker.registerTool('ccm', {
    cursor: 'cell',
    up: (pos, e) => {
      if (e.target !== canvas || e.button !== 0) return;
      if (!picker.view.inImage(pos.ix, pos.iy)) return;
      handleCcmClick(pos.ix, pos.iy);
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

  // 진행 중이던 CCM 보정 상태 초기화
  if (state.ccmCalibrating) {
    state.ccmCalibrating = false;
    state.ccmPoints = [];
    const banner = $('#ccm-banner');
    if (banner) banner.style.display = 'none';
  }

  // 층위 기록 자체는 유지하되, 이전 사진에 고정된 경계는 새 사진에 의미가
  // 없으므로 해제한다 (기록이 새 사진 것처럼 잘못 표시되는 걸 방지)
  const hadBoundaries = state.layers.some(l => l.region);
  if (hadBoundaries) {
    state.layers.forEach(l => { l.region = null; });
    toast('이전 사진의 층위 경계 표시가 해제되었습니다 (기록 자체는 유지됨)', 'info');
  }
  picker?.render();
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

  // CCM Calibrate button
  $('#ccm-calibrate-btn')?.addEventListener('click', () => {
    startCcmCalibration();
  });

  $('#ccm-cancel')?.addEventListener('click', () => {
    cancelCcmCalibration();
  });

  // Vignette slider
  const vigSlider = $('#vignette-slider');
  const vigLabel = $('#vignette-label');
  vigSlider?.addEventListener('input', () => {
    const val = parseFloat(vigSlider.value);
    const alpha = val / 100;
    if (vigLabel) vigLabel.textContent = `${val}%`;
    state.vignetteAlpha = alpha;
    if (state.image && picker) {
      picker.view.applyCorrection(currentCorrectFn());
      picker.view.render();
    }
  });

  // Init
  setLighting(6504);
  const d65Btn = document.querySelector('.preset-btn[data-k="6504"]');
  if (d65Btn) d65Btn.classList.add('active');
}

function setLighting(K) {
  // 프리셋/슬라이더 조작 시 그레이카드 및 CCM 모드는 해제 (상호배타)
  const prevMode = state.wbMode;
  state.wbMode = 'kelvin';
  state.wbWhitePoint = null;
  state.wbCCT = null;
  state.lightingK = K;

  // 보정본 갱신 (샘플링·표시 모두 이 보정본 기준)
  if (state.image && picker) {
    picker.setCorrection(currentCorrectFn());
  }

  if (prevMode === 'graycard') toast('그레이카드 보정 해제 — 색온도 모드로 전환', 'info');
  if (prevMode === 'ccm') toast('컬러체커 보정 해제 — 색온도 모드로 전환', 'info');
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

function updateWbUI() {
  const badge  = $('#wb-badge');
  const slider = $('#kelvin-slider');
  const label  = $('#kelvin-label');
  const graycard = state.wbMode === 'graycard';
  const ccm = state.wbMode === 'ccm';

  if (badge) {
    badge.style.display = (graycard || ccm) ? '' : 'none';
    if (graycard) {
      badge.innerHTML = PixelIcons.replace(`🎯 그레이카드 보정 적용 중 — 추정 광원 ≈${state.wbCCT}K`);
    } else if (ccm) {
      badge.innerHTML = PixelIcons.replace(`🎨 컬러체커 보정(CCM) 적용 중`);
    }
  }
  if (slider) {
    slider.disabled = graycard || ccm;
    if (graycard && state.wbCCT) {
      slider.value = Math.max(2500, Math.min(10000, state.wbCCT));
      if (label) label.textContent = `≈${state.wbCCT}K`;
    }
  }
  if (graycard || ccm) {
    $$('.preset-btn').forEach(b => b.classList.remove('active'));
    const desc = $('#lighting-desc');
    if (desc) desc.textContent = graycard ? `그레이카드 (≈${state.wbCCT}K)` : `컬러체커 보정 (CCM)`;
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

  // 토양 수분 추정 결과 표시
  renderMoistureEstimator(res);

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

  el.innerHTML = PixelIcons.replace(`📐 영역 ${stats.total.toLocaleString()}px`)
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

  const kindIcon = { 
    point: PixelIcons.get('📍'), 
    rect: PixelIcons.get('▭'), 
    lasso: PixelIcons.get('✎'), 
    polyline: PixelIcons.get('📐') 
  };
  markers.items.forEach(m => {
    const row = document.createElement('div');
    row.className = 'marker-row' + (markers.selected.has(m.id) ? ' selected' : '');
    row.innerHTML = PixelIcons.replace(`
      <input type="checkbox" ${markers.selected.has(m.id) ? 'checked' : ''} title="비교 대상으로 선택 (2개까지)">
      <span class="marker-label">${m.label}</span>
      <span class="marker-swatch" style="background:${m.result.chipHex}"></span>
      <span class="marker-info">
        <span class="marker-code">${m.result.code}</span>
        <span class="marker-name">${kindIcon[m.kind] || ''} ${m.result.korName}</span>
      </span>
      <button class="btn btn-sm btn-ghost" data-act="layer" title="이 마커를 층위 기록으로 추가">층위↑</button>
      <button class="btn btn-icon btn-danger btn-sm" data-act="del" title="마커 삭제">✕</button>
    `);
    row.querySelector('input').addEventListener('change', () => markers.toggleSelect(m.id));
    row.querySelector('[data-act="layer"]').addEventListener('click', () =>
      addLayer(m.result, m.wb, { kind: m.kind, geometry: m.geometry }));
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
      picker?.render();
    }
  });

  $('#layer-boundaries-toggle')?.addEventListener('click', (e) => {
    state.showLayerBoundaries = !state.showLayerBoundaries;
    layerOverlay?.setVisible(state.showLayerBoundaries);
    e.currentTarget.classList.toggle('active', state.showLayerBoundaries);
    e.currentTarget.title = state.showLayerBoundaries ? '경계 표시 끄기' : '경계 표시 켜기';
  });

  // 토양 수분 상태 변경 시 즉각 예측 결과 갱신
  $('#layer-condition')?.addEventListener('change', () => {
    if (state.currentResult) {
      renderMoistureEstimator(state.currentResult);
    }
  });
}

/**
 * 층위 기록 추가
 * @param {object} res      분석 결과 (기본: 현재 결과) — 마커 승격 시 마커의 result
 * @param {object} wb       WB 스냅샷 (기본: 현재 상태) — 마커 승격 시 채취 당시 값
 * @param {object} region   {kind, geometry} — 사진 위 경계 고정용. 기본은
 *                          res.region(영역 선택) 또는 res.point(점 채취).
 *                          마커 승격 시 마커 자신의 geometry를 명시적으로 넘겨야 함
 *                          (마커의 result에는 geometry가 없으므로).
 */
function addLayer(res = state.currentResult, wb = null, region = undefined) {
  if (!res) return;
  // WB는 채취 시점 스냅샷 우선 — 기록 버튼을 누른 시점의 상태가 아니라
  // 그 색이 실제로 계산된 조건을 기록해야 재현 가능하다.
  wb = wb || res.wb || currentWbSnapshot();
  if (region === undefined) {
    region = res.region || (res.point ? { kind: 'point', geometry: res.point } : null);
  }

  const numInput  = $('#layer-num');
  const descInput = $('#layer-desc');
  const memoInput = $('#layer-memo');
  const condSelect = $('#layer-condition');
  const depthTopInput = $('#layer-depth-top');
  const depthBottomInput = $('#layer-depth-bottom');
  const normCheckbox = $('#layer-normalize-moisture');

  const layer = FieldRecord.createLayer(Date.now());

  // Set layer attributes
  layer.number = numInput?.value || (state.layers.length + 1);
  layer.depth_top = depthTopInput?.value ? parseFloat(depthTopInput.value) : null;
  layer.depth_bottom = depthBottomInput?.value ? parseFloat(depthBottomInput.value) : null;
  layer.region = region || null;   // 사진 위 경계 고정 (층위 번호 배지로 상시 표시)

  const measuredCondition = condSelect?.value || 'moist';
  let finalCode = res.code;
  let finalHex = res.chipHex;
  let finalKorName = res.korName;
  let finalCondition = measuredCondition;
  let notes = memoInput?.value || '';

  // 건조 상태 토양 측정 시 습윤 상태로 정규화 기록 지원
  if (normCheckbox?.checked && measuredCondition === 'dry') {
    const pred = getMoisturePrediction(res);
    if (pred) {
      finalCode = pred.code;
      finalHex = pred.hex;
      finalKorName = pred.korName;
      finalCondition = 'moist';
      notes = (notes ? notes + ' ' : '') + '[건조 측정 ➡️ 습윤 정규화]';
    }
  }

  layer.notes = notes;

  // Matrix color attributes
  layer.matrix.code = finalCode;
  layer.matrix.condition = finalCondition;
  layer.matrix.hex = finalHex;
  layer.matrix.korName = finalKorName;
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
  picker?.render();
  toast(`층위 ${layer.number} 추가됨: ${layer.matrix.code}`
    + (layer.region ? ' (경계 고정됨)' : ''), 'success');

  // Auto-increment layer number
  const nextNum = parseInt(layer.number || 0) + 1;
  if (numInput && !isNaN(nextNum)) numInput.value = nextNum;
}

function removeLayer(id) {
  state.layers = state.layers.filter(l => l.id !== id);
  renderLayerList();
  updateComparisonStrip();
  picker?.render();
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
    list.innerHTML = PixelIcons.replace(`
      <div class="layers-empty">
        <div class="layers-empty-icon">🏺</div>
        <div class="layers-empty-text">스포이드로 색을 채취한 후<br>층위를 추가하세요</div>
      </div>`);
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

    card.innerHTML = PixelIcons.replace(`
      <div class="layer-swatch" style="background:${layer.matrix.hex}"></div>
      <div class="layer-info">
        <div style="display:flex; justify-content:space-between; align-items:baseline">
          <div class="layer-number">층위 ${layer.number}${layer.region ? ' 📐' : ''}</div>
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
    `);
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
  const iconHtml = PixelIcons.get(icons[type] || '');
  t.innerHTML = `<span>${iconHtml}</span> ${PixelIcons.replace(msg)}`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

// ─── Global copy helper ───────────────────────────────────────────────
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => toast(`복사됨: ${text}`, 'success'));
}

// ─── CCM Calibration (컬러체커 보정) ──────────────────────────────────
function startCcmCalibration() {
  if (!state.image) {
    toast('컬러체커 보정을 수행하려면 먼저 사진을 로드해 주세요.', 'error');
    return;
  }
  
  // 타겟 타입 결정
  state.ccmTargetType = $('#ccm-target-type')?.value || '6patch';
  state.ccmCalibrating = true;
  state.ccmPoints = [];

  const banner = $('#ccm-banner');
  if (banner) banner.style.display = 'block';

  // 스텝 가이드 도트 갱신 (6색은 6개 노출, 24색은 4개 노출)
  const dots = $$('.calibration-step-dot');
  if (state.ccmTargetType === 'macbeth') {
    dots.forEach((dot, idx) => {
      dot.style.display = idx < 4 ? '' : 'none';
      dot.className = 'calibration-step-dot' + (idx === 0 ? ' active' : '');
    });
  } else {
    dots.forEach((dot, idx) => {
      dot.style.display = '';
      dot.className = 'calibration-step-dot' + (idx === 0 ? ' active' : '');
    });
  }

  const guide = $('#ccm-guide-text');
  if (guide) {
    guide.textContent = state.ccmTargetType === 'macbeth'
      ? '24색 맥베스의 [좌측 상단] 모퉁이(Dark Skin) 패치를 클릭하세요 (1/4)'
      : '사진 속 컬러 카드의 [흰색] 패치를 클릭하세요 (1/6)';
  }

  // 도구 전환
  picker?.setTool('ccm');

  // 오버레이 등록
  if (picker?.view && !picker.view.overlays.includes(drawCcmCalibrationMarkers)) {
    picker.view.overlays.push(drawCcmCalibrationMarkers);
  }

  picker?.view.render();
  toast(`🎨 컬러체커 보정 모드 진입 (${state.ccmTargetType === 'macbeth' ? '24색 맥베스' : '6색 컬러 바'})`, 'info');
}

function cancelCcmCalibration() {
  state.ccmCalibrating = false;
  state.ccmPoints = [];

  const banner = $('#ccm-banner');
  if (banner) banner.style.display = 'none';

  // 기본 도구 복귀
  picker?.setTool('pick');
  $$('.tool-chip').forEach(c => c.classList.remove('active'));
  const pickBtn = document.querySelector('.tool-chip[data-tool="pick"]');
  if (pickBtn) pickBtn.classList.add('active');

  picker?.view.render();
  toast('컬러체커 보정이 취소되었습니다.', 'info');
}

function endCcmCalibration() {
  state.ccmCalibrating = false;

  const banner = $('#ccm-banner');
  if (banner) banner.style.display = 'none';

  // 기본 도구 복귀
  picker?.setTool('pick');
  $$('.tool-chip').forEach(c => c.classList.remove('active'));
  const pickBtn = document.querySelector('.tool-chip[data-tool="pick"]');
  if (pickBtn) pickBtn.classList.add('active');

  picker?.view.render();
}

function handleCcmClick(ix, iy) {
  const radius = state.samplingMode === 1 ? 1 : (state.samplingMode === 2 ? 3 : (state.samplingMode === 3 ? 5 : 7));
  const isMacbeth = state.ccmTargetType === 'macbeth';
  
  if (isMacbeth) {
    // 24색 맥베스 보정 모드: 4개 모퉁이 좌표 기록
    state.ccmPoints.push({ ix, iy });
    
    const idx = state.ccmPoints.length - 1;
    const dots = $$('.calibration-step-dot');
    if (dots[idx]) {
      dots[idx].classList.remove('active');
      dots[idx].classList.add('completed');
    }
    if (dots[idx + 1]) {
      dots[idx + 1].classList.add('active');
    }

    picker?.view.render();

    const cornerNames = ['좌측 상단(Dark Skin)', '우측 상단(Bluish Green)', '우측 하단(Black)', '좌측 하단(Blue)'];
    if (state.ccmPoints.length < 4) {
      const nextCorner = cornerNames[state.ccmPoints.length];
      const guide = $('#ccm-guide-text');
      if (guide) guide.textContent = `24색 맥베스의 [${nextCorner}] 패치를 클릭하세요 (${state.ccmPoints.length + 1}/4)`;
    } else {
      // 4개 모퉁이 픽 완료 -> 그리드 선형보간을 통한 24색 샘플링 및 연산
      const C1 = state.ccmPoints[0];
      const C2 = state.ccmPoints[1];
      const C3 = state.ccmPoints[2];
      const C4 = state.ccmPoints[3];
      
      const patchRGBs = [];
      
      // 4행 x 6열 그리드 상의 각 패치 중심 좌표 샘플링
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 6; c++) {
          const u = (c + 0.5) / 6;
          const v = (r + 0.5) / 4;
          
          // bilinear 보간
          const px = Math.round((1 - u) * (1 - v) * C1.ix + u * (1 - v) * C2.ix + u * v * C3.ix + (1 - u) * v * C4.ix);
          const py = Math.round((1 - u) * (1 - v) * C1.iy + u * (1 - v) * C2.iy + u * v * C3.iy + (1 - u) * v * C4.iy);
          
          const sample = picker.view.sampleRawAt(px, py, radius);
          if (sample) {
            patchRGBs.push([sample.r, sample.g, sample.b]);
          } else {
            patchRGBs.push([128, 128, 128]); // 샘플링 예외 시 중간값 폴백
          }
        }
      }
      
      const M = CCMSolver.solve(patchRGBs, 'macbeth');
      if (M) {
        state.ccmMatrix = M;
        state.wbMode = 'ccm';

        if (state.image && picker) {
          picker.view.applyCorrection(currentCorrectFn());
        }

        if (picker.currentPixel) {
          const p = picker.currentPixel;
          const corrected = picker.view.sampleAt(p.ix, p.iy, radius);
          if (corrected) {
            handleColorPick({
              r: corrected.r,
              g: corrected.g,
              b: corrected.b,
              raw: picker.view.sampleRawAt(p.ix, p.iy, radius),
              point: p
            });
          }
        }

        updateWbUI();
        toast('🏁 24색 맥베스 정밀 보정 행렬(CCM)이 생성 및 적용되었습니다!', 'success');
        endCcmCalibration();
      } else {
        toast('보정 행렬 연산 실패: 4개 모퉁이 그리드 상의 픽셀 값에 특이성이 발견되었습니다.', 'error');
        cancelCcmCalibration();
      }
    }
  } else {
    // 기존 6색 컬러 바 보정 모드
    const rawRGB = picker.view.sampleRawAt(ix, iy, radius);
    if (!rawRGB) return;

    state.ccmPoints.push({ ix, iy, rgb: [rawRGB.r, rawRGB.g, rawRGB.b] });

    const idx = state.ccmPoints.length - 1;
    const dots = $$('.calibration-step-dot');
    if (dots[idx]) {
      dots[idx].classList.remove('active');
      dots[idx].classList.add('completed');
    }
    if (dots[idx + 1]) {
      dots[idx + 1].classList.add('active');
    }

    picker?.view.render();

    const names = ['흰색', '회색', '검은색', '빨간색', '초록색', '파란색'];
    if (state.ccmPoints.length < 6) {
      const nextName = names[state.ccmPoints.length];
      const guide = $('#ccm-guide-text');
      if (guide) guide.textContent = `사진 속 컬러 카드의 [${nextName}] 패치를 클릭하세요 (${state.ccmPoints.length + 1}/6)`;
    } else {
      const M = CCMSolver.solve(state.ccmPoints.map(p => p.rgb), '6patch');
      if (M) {
        state.ccmMatrix = M;
        state.wbMode = 'ccm';

        if (state.image && picker) {
          picker.view.applyCorrection(currentCorrectFn());
        }

        if (picker.currentPixel) {
          const p = picker.currentPixel;
          const corrected = picker.view.sampleAt(p.ix, p.iy, radius);
          if (corrected) {
            handleColorPick({
              r: corrected.r,
              g: corrected.g,
              b: corrected.b,
              raw: picker.view.sampleRawAt(p.ix, p.iy, radius),
              point: p
            });
          }
        }

        updateWbUI();
        toast('🎨 6색 컬러체커 보정 행렬(CCM)이 적용되었습니다!', 'success');
        endCcmCalibration();
      } else {
        toast('보정 행렬 연산 실패: 픽셀 값에 수학적 특이성(Singularity)이 감지되었습니다.', 'error');
        cancelCcmCalibration();
      }
    }
  }
}

function drawCcmCalibrationMarkers(ctx, view) {
  if (!state.ccmCalibrating) return;
  const isMacbeth = state.ccmTargetType === 'macbeth';
  
  if (isMacbeth) {
    const cornerNames = ['TL', 'TR', 'BR', 'BL'];
    state.ccmPoints.forEach((p, idx) => {
      const { cx, cy } = view.imageToCanvas(p.ix, p.iy);
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, 2 * Math.PI);
      ctx.fillStyle = '#e74c3c';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cornerNames[idx], cx, cy);
    });

    // 클릭 지점 연결선 및 그리드 가이드라인 그리기
    if (state.ccmPoints.length >= 2) {
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(231, 76, 60, 0.5)';
      const pts = state.ccmPoints.map(p => view.imageToCanvas(p.ix, p.iy));
      ctx.moveTo(pts[0].cx, pts[0].cy);
      ctx.lineTo(pts[1].cx, pts[1].cy);
      if (pts[2]) ctx.lineTo(pts[2].cx, pts[2].cy);
      if (pts[3]) {
        ctx.lineTo(pts[3].cx, pts[3].cy);
        ctx.closePath();
      }
      ctx.stroke();
    }
  } else {
    const names = ['W', 'G', 'K', 'R', 'G', 'B'];
    const colors = ['#ffffff', '#888888', '#1a1714', '#e74c3c', '#2ecc71', '#3498db'];
    state.ccmPoints.forEach((p, index) => {
      const { cx, cy } = view.imageToCanvas(p.ix, p.iy);
      
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, 2 * Math.PI);
      ctx.fillStyle = colors[index];
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = index === 0 ? '#1a1714' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(names[index], cx, cy);
    });
  }
}

// ─── Soil Moisture Estimator (토양 수분 예측 계산) ─────────────────────
function getMoisturePrediction(res) {
  if (!res || !converter) return null;

  const cond = $('#layer-condition')?.value || 'moist';
  let sourceStateLabel = '';
  let targetStateLabel = '';
  let predictedValue, predictedChroma;

  // 건조 <-> 습윤 전환 수학적 추정 모델
  if (cond === 'moist' || cond === 'wet') {
    // 습윤 -> 건조: 명도(Value) 증가 (+1.5~2), 채도(Chroma) 감소 (-0.5~1)
    sourceStateLabel = '습윤 (Moist)';
    targetStateLabel = '건조 (Dry)';
    predictedValue = res.value + 1.7;
    predictedChroma = res.chroma - 0.7;
  } else {
    // 건조 -> 습윤: 명도(Value) 감소 (-1.5~2), 채도(Chroma) 증가 (+0.5~1)
    sourceStateLabel = '건조 (Dry)';
    targetStateLabel = '습윤 (Moist)';
    predictedValue = res.value - 1.7;
    predictedChroma = res.chroma + 0.7;
  }

  // 예측값이 색상 공간 밖으로 나가지 않도록 바인딩
  predictedValue = Math.min(8.0, Math.max(1.0, predictedValue));
  predictedChroma = Math.min(8.0, Math.max(1.0, predictedChroma));

  // 예측값과 동일한 Hue 그룹 내에서 가장 가까운 실물 토색첩 칩(Chip)을 검색
  const targetHue = res.hue;
  const sameHueChips = converter.chips.filter(c => c.hue === targetHue);
  
  let bestChip = null;
  let minDist = Infinity;
  for (const chip of sameHueChips) {
    const dist = Math.pow(chip.value - predictedValue, 2) + Math.pow(chip.chroma - predictedChroma, 2);
    if (dist < minDist) {
      minDist = dist;
      bestChip = chip;
    }
  }

  // 만약 동일 Hue에 매칭되는 칩이 없으면 전체 칩에서 탐색 (Neutral인 경우 포함)
  if (!bestChip && converter.chips.length > 0) {
    for (const chip of converter.chips) {
      const dist = Math.pow(chip.value - predictedValue, 2) + Math.pow(chip.chroma - predictedChroma, 2);
      if (dist < minDist) {
        minDist = dist;
        bestChip = chip;
      }
    }
  }

  const predictedCode = bestChip ? bestChip.code : `${res.hue} ${Math.round(predictedValue)}/${Math.round(predictedChroma)}`;
  const predictedHex = bestChip ? bestChip.hex : '#808080';
  const parsed = converter._parseCode(predictedCode);
  const predictedKorName = converter._korName(parsed);

  return {
    sourceStateLabel,
    targetStateLabel,
    code: predictedCode,
    hex: predictedHex,
    korName: predictedKorName
  };
}

function renderMoistureEstimator(res) {
  const section = $('#moisture-estimator-section');
  const body = $('#moisture-estimator-body');
  if (!section || !body) return;

  // 결과가 없거나 무채색(Neutral)인 경우 수분 추정 생략
  if (!res || res.code === '–' || res.isNeutral) {
    section.style.display = 'none';
    body.innerHTML = '';
    return;
  }

  const pred = getMoisturePrediction(res);
  if (!pred) {
    section.style.display = 'none';
    return;
  }

  body.innerHTML = PixelIcons.replace(`
    <div class="moisture-box">
      <div class="moisture-box-title">현재 상태: ${pred.sourceStateLabel}</div>
      <div class="moisture-swatch-container">
        <div class="moisture-swatch" style="background:${res.chipHex}"></div>
        <div class="moisture-info">
          <div class="moisture-code">${res.code}</div>
          <div class="moisture-name">${res.korName}</div>
        </div>
      </div>
    </div>
    <div class="moisture-box" style="border-color:var(--accent-gold)">
      <div class="moisture-box-title" style="color:var(--accent-gold)">예상 상태: ${pred.targetStateLabel}</div>
      <div class="moisture-swatch-container">
        <div class="moisture-swatch" style="background:${pred.hex}"></div>
        <div class="moisture-info">
          <div class="moisture-code">${pred.code}</div>
          <div class="moisture-name">${pred.korName}</div>
        </div>
      </div>
    </div>
  `);
  section.style.display = '';
}

function setupScienceWidget() {
  const widget = $('#science-guide-widget');
  const toggleBtn = $('#widget-toggle-btn');
  const minimizeBtn = $('#widget-minimize-btn');
  
  if (toggleBtn && widget) {
    toggleBtn.addEventListener('click', () => {
      widget.classList.remove('collapsed');
      picker?.view.render(); // Redraw canvas on layout adjustment
    });
  }
  
  if (minimizeBtn && widget) {
    minimizeBtn.addEventListener('click', () => {
      widget.classList.add('collapsed');
      picker?.view.render();
    });
  }
  
  // Tab switching
  const tabs = $$('.widget-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const targetId = tab.dataset.tab;
      const contents = $$('.widget-tab-content');
      contents.forEach(content => {
        if (content.id === targetId) {
          content.classList.add('active');
        } else {
          content.classList.remove('active');
        }
      });
    });
  });
}

