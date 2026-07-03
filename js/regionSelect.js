/**
 * regionSelect.js
 * ─────────────────────────────────────────────────────────────────────
 * 영역 선택 (사각형/올가미) + 로버스트 평균색
 *
 * 목적:
 *   토층 사진에서 영역을 지정하면 빛(스펙큘러 하이라이트)·그림자·
 *   이물(낙엽, 자갈 등)을 자동으로 제외하고 대표 토색을 산출한다.
 *
 * 알고리즘 (입력: 조명 보정된 correctedImageData — 재보정 금지):
 *   1) 표본화: 영역 픽셀 > MAX_SAMPLES면 균등 스트라이드 다운샘플
 *   2) 클리핑 가드: max(r,g,b) ≥ 250 → 하이라이트, ≤ 8 → 암부 제거
 *   3) L*(CIE Lab) 하위/상위 TRIM_RATIO 퍼센타일 트리밍 (그림자/밝은 반사)
 *   4) (a*,b*) 중앙값 + MAD 기준 2.5σ 초과 색도 이상치 제거 (이물 혼입)
 *   5) 생존 픽셀을 linear RGB에서 평균 → sRGB로 재인코딩
 *      (감마 공간 평균은 어둡게 편향되므로 물리적으로 올바른 linear 평균 사용.
 *       이상치 "판정"은 지각 공간 Lab, "평균"은 물리 공간 linear의 하이브리드)
 *
 * 한계(v1): 영역의 절반 이상이 다른 층이면 트리밍만으로 부족 —
 *   올가미로 회피. 지배 클러스터 추출(k-means)은 v2 후보.
 * ─────────────────────────────────────────────────────────────────────
 */

const RegionStats = (() => {
  const MAX_SAMPLES = 50000;
  const CLIP_HIGH = 250;
  const CLIP_LOW = 8;
  const TRIM_RATIO = 0.10;      // L* 상·하위 10%
  const CHROMA_SIGMA = 2.5;     // MAD 기반 이상치 임계
  const MAD_TO_SIGMA = 1.4826;

  // sRGB 감마 디코딩 LUT
  let _dec = null;
  function dec() {
    if (!_dec) {
      _dec = new Float32Array(256);
      for (let i = 0; i < 256; i++) _dec[i] = Illuminant.sRGBtoLinear(i / 255);
    }
    return _dec;
  }

  function median(sorted) {
    const n = sorted.length;
    return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  }

  /**
   * 픽셀 좌표 집합의 로버스트 평균
   * @param {ImageData} imageData      조명 보정된 이미지
   * @param {() => Iterator} coordsFactory  (x,y) 좌표 이터레이터 팩토리 (2회 순회 가능해야 함)
   * @param {number} total             영역 총 픽셀 수 (스트라이드 계산용)
   * @returns {{ r,g,b, stats } | null}
   */
  function robustAverage(imageData, coordsFactory, total) {
    if (!total) return null;
    const data = imageData.data;
    const W = imageData.width;
    const stride = Math.max(1, Math.ceil(total / MAX_SAMPLES));
    const D = dec();

    // 1) 표본 수집 + 2) 클리핑 가드
    const rs = [], gs = [], bs = [];
    let excludedHighlight = 0, excludedShadow = 0;
    let k = 0;
    for (const [x, y] of coordsFactory()) {
      if (k++ % stride !== 0) continue;
      const i = (y * W + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const mx = Math.max(r, g, b);
      if (mx >= CLIP_HIGH) { excludedHighlight++; continue; }
      if (mx <= CLIP_LOW)  { excludedShadow++; continue; }
      rs.push(r); gs.push(g); bs.push(b);
    }
    const sampled = rs.length + excludedHighlight + excludedShadow;
    if (rs.length < 4) return null;   // 유효 픽셀이 너무 적음

    // Lab 계산 (D65)
    const n = rs.length;
    const Ls = new Float32Array(n), As = new Float32Array(n), Bs = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const xyz = {
        X: 0.4124564 * D[rs[i]] + 0.3575761 * D[gs[i]] + 0.1804375 * D[bs[i]],
        Y: 0.2126729 * D[rs[i]] + 0.7151522 * D[gs[i]] + 0.0721750 * D[bs[i]],
        Z: 0.0193339 * D[rs[i]] + 0.1191920 * D[gs[i]] + 0.9503041 * D[bs[i]],
      };
      const lab = Illuminant.XYZtoLab(xyz, Illuminant.WP_D65);
      Ls[i] = lab.L; As[i] = lab.a; Bs[i] = lab.b;
    }

    // 3) L* 퍼센타일 트리밍
    const sortedL = Array.from(Ls).sort((a, b) => a - b);
    const lo = sortedL[Math.floor(n * TRIM_RATIO)];
    const hi = sortedL[Math.min(n - 1, Math.ceil(n * (1 - TRIM_RATIO)) - 1)];
    let keep = [];
    for (let i = 0; i < n; i++) {
      if (Ls[i] >= lo && Ls[i] <= hi) keep.push(i);
    }
    const excludedLstar = n - keep.length;
    if (keep.length < 4) keep = [...Array(n).keys()];   // 극단 케이스: 트리밍 취소

    // 4) 색도 MAD 이상치 제거
    const aVals = keep.map(i => As[i]).sort((x, y) => x - y);
    const bVals = keep.map(i => Bs[i]).sort((x, y) => x - y);
    const medA = median(aVals), medB = median(bVals);
    const madA = median(keep.map(i => Math.abs(As[i] - medA)).sort((x, y) => x - y));
    const madB = median(keep.map(i => Math.abs(Bs[i] - medB)).sort((x, y) => x - y));
    const sigA = madA * MAD_TO_SIGMA, sigB = madB * MAD_TO_SIGMA;

    let survivors = keep;
    let excludedChroma = 0;
    if (sigA > 0.05 && sigB > 0.05) {   // 완전 균일 영역이면 생략
      survivors = keep.filter(i => {
        const da = (As[i] - medA) / sigA;
        const db = (Bs[i] - medB) / sigB;
        return Math.sqrt(da * da + db * db) <= CHROMA_SIGMA;
      });
      excludedChroma = keep.length - survivors.length;
      if (survivors.length < 4) { survivors = keep; excludedChroma = 0; }
    }

    // 5) linear RGB 평균 → sRGB
    let lr = 0, lg = 0, lb = 0;
    for (const i of survivors) { lr += D[rs[i]]; lg += D[gs[i]]; lb += D[bs[i]]; }
    const m = survivors.length;
    const toS = v => Math.round(Illuminant.linearToSRGB(v / m) * 255);

    return {
      r: toS(lr), g: toS(lg), b: toS(lb),
      stats: {
        total,                       // 영역 전체 픽셀
        sampled,                     // 표본화 후 검사한 픽셀
        used: m,                     // 평균에 실제 사용된 픽셀
        excludedHighlight,           // 클리핑(밝음)
        excludedShadow,              // 클리핑(어두움)
        excludedLstar,               // L* 트리밍 (그림자/반사)
        excludedChroma,              // 색도 이상치 (이물)
      },
    };
  }

  /** 사각형 영역 (이미지 좌표, 자동 클램프) */
  function averageRect(imageData, x0, y0, x1, y1) {
    const W = imageData.width, H = imageData.height;
    const ax = Math.max(0, Math.min(Math.floor(x0), Math.floor(x1)));
    const ay = Math.max(0, Math.min(Math.floor(y0), Math.floor(y1)));
    const bx = Math.min(W - 1, Math.max(Math.floor(x0), Math.floor(x1)));
    const by = Math.min(H - 1, Math.max(Math.floor(y0), Math.floor(y1)));
    if (bx < ax || by < ay) return null;
    const total = (bx - ax + 1) * (by - ay + 1);

    function* coords() {
      for (let y = ay; y <= by; y++)
        for (let x = ax; x <= bx; x++) yield [x, y];
    }
    return robustAverage(imageData, coords, total);
  }

  /**
   * 폴리곤(올가미) 영역 — 이미지 해상도 마스크 캔버스로 내부 픽셀 판정
   * @param {Array<{ix,iy}>} pts  이미지 좌표 폴리곤
   */
  function averagePolygon(imageData, pts) {
    if (pts.length < 3) return null;
    const W = imageData.width, H = imageData.height;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.ix); maxX = Math.max(maxX, p.ix);
      minY = Math.min(minY, p.iy); maxY = Math.max(maxY, p.iy);
    }
    const ax = Math.max(0, Math.floor(minX));
    const ay = Math.max(0, Math.floor(minY));
    const bx = Math.min(W - 1, Math.ceil(maxX));
    const by = Math.min(H - 1, Math.ceil(maxY));
    if (bx < ax || by < ay) return null;

    const mw = bx - ax + 1, mh = by - ay + 1;
    const mask = document.createElement('canvas');
    mask.width = mw; mask.height = mh;
    const mctx = mask.getContext('2d', { willReadFrequently: true });
    mctx.fillStyle = '#fff';
    mctx.beginPath();
    mctx.moveTo(pts[0].ix - ax, pts[0].iy - ay);
    for (let i = 1; i < pts.length; i++) mctx.lineTo(pts[i].ix - ax, pts[i].iy - ay);
    mctx.closePath();
    mctx.fill();
    const alpha = mctx.getImageData(0, 0, mw, mh).data;

    let total = 0;
    for (let i = 3; i < alpha.length; i += 4) if (alpha[i] > 127) total++;
    if (!total) return null;

    function* coords() {
      for (let y = 0; y < mh; y++)
        for (let x = 0; x < mw; x++)
          if (alpha[(y * mw + x) * 4 + 3] > 127) yield [x + ax, y + ay];
    }
    return robustAverage(imageData, coords, total);
  }

  return { robustAverage, averageRect, averagePolygon,
           MAX_SAMPLES, TRIM_RATIO, CHROMA_SIGMA };
})();


/**
 * 영역 선택 도구 (사각형 드래그 / 올가미 자유곡선)
 * ColorPicker의 registerTool 확장점에 끼워진다.
 */
class RegionSelect {
  /**
   * @param {ColorPicker} picker
   * @param {(avg: {r,g,b,stats}, region: {kind, geometry}) => void} onResult
   */
  constructor(picker, onResult) {
    this.picker = picker;
    this.view = picker.view;
    this.onResult = onResult;

    this._drag = null;        // 사각형 드래그 중 {x0,y0,x1,y1} (이미지 좌표)
    this._lasso = null;       // 올가미 진행 중 [{ix,iy}, ...]
    this.lastRegion = null;   // 확정된 영역 {kind, geometry} — 오버레이 유지

    picker.registerTool('rect', {
      cursor: 'crosshair',
      down: (pos) => { this._drag = { x0: pos.ix, y0: pos.iy, x1: pos.ix, y1: pos.iy }; },
      move: (pos) => {
        if (this._drag) { this._drag.x1 = pos.ix; this._drag.y1 = pos.iy; }
        this.view.render();
      },
      up: () => this._finishRect(),
      draw: (ctx, view) => this._draw(ctx, view),
      always: true,   // 확정된 영역은 도구와 무관하게 계속 표시
    });

    picker.registerTool('lasso', {
      cursor: 'crosshair',
      down: (pos) => { this._lasso = [{ ix: pos.ix, iy: pos.iy }]; },
      move: (pos) => {
        if (this._lasso) {
          const last = this._lasso[this._lasso.length - 1];
          const d = Math.hypot(pos.ix - last.ix, pos.iy - last.iy);
          if (d >= 1) this._lasso.push({ ix: pos.ix, iy: pos.iy });
        }
        this.view.render();
      },
      up: () => this._finishLasso(),
    });
  }

  clear() {
    this.lastRegion = null;
    this._drag = null;
    this._lasso = null;
    this.view.render();
  }

  _finishRect() {
    const d = this._drag;
    this._drag = null;
    if (!d) return;
    if (Math.abs(d.x1 - d.x0) < 3 || Math.abs(d.y1 - d.y0) < 3) { this.view.render(); return; }

    const avg = RegionStats.averageRect(this.view.correctedImageData, d.x0, d.y0, d.x1, d.y1);
    if (avg) {
      this.lastRegion = { kind: 'rect', geometry: { ...d } };
      this.onResult(avg, this.lastRegion);
    }
    this.view.render();
  }

  _finishLasso() {
    const pts = this._lasso;
    this._lasso = null;
    if (!pts || pts.length < 3) { this.view.render(); return; }

    const avg = RegionStats.averagePolygon(this.view.correctedImageData, pts);
    if (avg) {
      this.lastRegion = { kind: 'lasso', geometry: { pts } };
      this.onResult(avg, this.lastRegion);
    }
    this.view.render();
  }

  // ─── 오버레이 ────────────────────────────────────────────────────

  _draw(ctx, view) {
    const drawRect = (x0, y0, x1, y1, done) => {
      const p0 = view.imageToCanvas(Math.min(x0, x1), Math.min(y0, y1));
      const p1 = view.imageToCanvas(Math.max(x0, x1), Math.max(y0, y1));
      ctx.save();
      ctx.strokeStyle = done ? 'rgba(196,154,78,0.95)' : 'rgba(255,255,255,0.9)';
      ctx.fillStyle = done ? 'rgba(196,154,78,0.10)' : 'rgba(255,255,255,0.08)';
      ctx.setLineDash(done ? [] : [5, 4]);
      ctx.lineWidth = 1.5;
      ctx.fillRect(p0.cx, p0.cy, p1.cx - p0.cx, p1.cy - p0.cy);
      ctx.strokeRect(p0.cx, p0.cy, p1.cx - p0.cx, p1.cy - p0.cy);
      ctx.restore();
    };

    const drawPoly = (pts, done, close) => {
      if (pts.length < 2) return;
      ctx.save();
      ctx.strokeStyle = done ? 'rgba(196,154,78,0.95)' : 'rgba(255,255,255,0.9)';
      ctx.fillStyle = done ? 'rgba(196,154,78,0.10)' : 'rgba(255,255,255,0.08)';
      ctx.setLineDash(done ? [] : [5, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const p0 = view.imageToCanvas(pts[0].ix, pts[0].iy);
      ctx.moveTo(p0.cx, p0.cy);
      for (let i = 1; i < pts.length; i++) {
        const p = view.imageToCanvas(pts[i].ix, pts[i].iy);
        ctx.lineTo(p.cx, p.cy);
      }
      if (close) ctx.closePath();
      if (done || close) ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    // 진행 중
    if (this._drag) drawRect(this._drag.x0, this._drag.y0, this._drag.x1, this._drag.y1, false);
    if (this._lasso) drawPoly(this._lasso, false, false);

    // 확정된 영역
    const r = this.lastRegion;
    if (r?.kind === 'rect') drawRect(r.geometry.x0, r.geometry.y0, r.geometry.x1, r.geometry.y1, true);
    if (r?.kind === 'lasso') drawPoly(r.geometry.pts, true, true);
  }
}
