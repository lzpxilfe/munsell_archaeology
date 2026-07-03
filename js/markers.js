/**
 * markers.js
 * ─────────────────────────────────────────────────────────────────────
 * 다중 지점 비교 (마커)
 *
 * 한 장의 토층 사진에서 여러 지점/영역을 마커로 고정해 두고
 * 각각의 먼셀 색을 나란히 비교한다. 두 마커를 선택하면 상호
 * ΔE2000을 표시 — "두 지점이 지각적으로 같은 색인가"(dE00 < 2.15
 * 등가 기준)를 "같은 층인가"라는 고고학적 질문에 연결한다.
 *
 * 설계:
 *   - geometry는 이미지 좌표로 저장 → 줌/팬/창 리사이즈에 불변
 *   - 채취 당시 WB 스냅샷을 보존 (기록 재현성) —
 *     WB를 바꾼 뒤 "현재 WB로 재계산"으로 일괄 갱신 가능
 * ─────────────────────────────────────────────────────────────────────
 */

class Markers {
  /**
   * @param {ColorPicker} picker
   * @param {{ onChange: () => void }} opts  목록 변경 콜백 (패널 재렌더)
   */
  constructor(picker, opts = {}) {
    this.picker = picker;
    this.view = picker.view;
    this.onChange = opts.onChange || (() => {});
    this.items = [];
    this.selected = new Set();   // 비교 대상 마커 id
    this._labelSeq = 0;

    picker.addOverlay((ctx, view) => this._draw(ctx, view));
  }

  _nextLabel() {
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const n = this._labelSeq++;
    return n < 26 ? A[n] : A[Math.floor(n / 26) - 1] + A[n % 26];
  }

  /**
   * 현재 분석 결과를 마커로 고정
   * @param {object} result  converter.analyze() 결과 (+ region/point/sampleStats)
   * @param {object} wb      채취 당시 WB 스냅샷
   * @returns {object|null}  생성된 마커
   */
  add(result, wb) {
    let kind, geometry;
    if (result.region) {
      kind = result.region.kind;                    // 'rect' | 'lasso'
      geometry = result.region.geometry;
    } else if (result.point) {
      kind = 'point';
      geometry = { ...result.point };
    } else {
      return null;   // 화면 스포이드/참조 칩 — 이미지 좌표가 없어 고정 불가
    }

    const marker = {
      id: Date.now() + Math.random(),
      label: this._nextLabel(),
      kind, geometry, wb,
      sampleSize: this.picker.sampleSize,
      result: this._slim(result),
    };
    this.items.push(marker);
    this.view.render();
    this.onChange();
    return marker;
  }

  remove(id) {
    this.items = this.items.filter(m => m.id !== id);
    this.selected.delete(id);
    this.view.render();
    this.onChange();
  }

  clear() {
    this.items = [];
    this.selected.clear();
    this._labelSeq = 0;
    this.view.render();
    this.onChange();
  }

  toggleSelect(id) {
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
    this.onChange();
  }

  /** 선택된 두 마커의 상호 ΔE2000 (2개가 아닐 때 null) */
  mutualDeltaE() {
    if (this.selected.size !== 2) return null;
    const [a, b] = [...this.selected].map(id => this.items.find(m => m.id === id));
    if (!a || !b) return null;
    const dE = NearestChip.deltaE2000(a.result.lab_C, b.result.lab_C);
    return { a, b, dE, equivalent: dE < NearestChip.EQUIVALENCE_THRESHOLD };
  }

  /**
   * 저장된 geometry로 모든 마커를 현재 보정본 기준 재분석
   * @param {(r,g,b) => object} analyzeFn   converter.analyze 래퍼
   * @param {object} wb                     현재 WB 스냅샷
   */
  recomputeAll(analyzeFn, wb) {
    const imageData = this.view.correctedImageData;
    if (!imageData) return;
    for (const m of this.items) {
      let avg = null;
      if (m.kind === 'point') {
        avg = this.view.sampleAt(m.geometry.ix, m.geometry.iy, m.sampleSize);
        if (avg) avg = { ...avg, stats: null };
      } else if (m.kind === 'rect') {
        const g = m.geometry;
        avg = RegionStats.averageRect(imageData, g.x0, g.y0, g.x1, g.y1);
      } else if (m.kind === 'lasso') {
        avg = RegionStats.averagePolygon(imageData, m.geometry.pts);
      }
      if (!avg) continue;
      const res = analyzeFn(avg.r, avg.g, avg.b);
      res.sampleStats = avg.stats || null;
      m.result = this._slim(res);
      m.wb = wb;
    }
    this.view.render();
    this.onChange();
  }

  /** 마커에 보존할 결과 필드만 추림 */
  _slim(res) {
    return {
      code: res.code,
      hex: res.hex,
      chipHex: res.chipHex,
      korName: res.korName,
      soilClass: res.soilClass,
      deltaE: res.deltaE,
      accuracy: res.accuracy,
      rgb: res.rgb,
      lab_C: res.pipeline?.lab_C || null,
      pipeline: res.pipeline || null,
      sampleStats: res.sampleStats || null,
      candidates: res.candidates || null,
    };
  }

  // ─── 오버레이 ────────────────────────────────────────────────────

  /** 마커 라벨 배지의 앵커 (이미지 좌표) */
  _anchor(m) {
    if (m.kind === 'point') return m.geometry;
    if (m.kind === 'rect') {
      return { ix: (m.geometry.x0 + m.geometry.x1) / 2,
               iy: Math.min(m.geometry.y0, m.geometry.y1) };
    }
    // lasso: 첫 점
    return { ix: m.geometry.pts[0].ix, iy: m.geometry.pts[0].iy };
  }

  _draw(ctx, view) {
    for (const m of this.items) {
      // 영역 외곽선 (얇게, 항상 표시)
      ctx.save();
      ctx.strokeStyle = 'rgba(196,154,78,0.75)';
      ctx.lineWidth = 1;
      if (m.kind === 'rect') {
        const g = m.geometry;
        const p0 = view.imageToCanvas(Math.min(g.x0, g.x1), Math.min(g.y0, g.y1));
        const p1 = view.imageToCanvas(Math.max(g.x0, g.x1), Math.max(g.y0, g.y1));
        ctx.strokeRect(p0.cx, p0.cy, p1.cx - p0.cx, p1.cy - p0.cy);
      } else if (m.kind === 'lasso') {
        const pts = m.geometry.pts;
        ctx.beginPath();
        const p0 = view.imageToCanvas(pts[0].ix, pts[0].iy);
        ctx.moveTo(p0.cx, p0.cy);
        for (let i = 1; i < pts.length; i++) {
          const p = view.imageToCanvas(pts[i].ix, pts[i].iy);
          ctx.lineTo(p.cx, p.cy);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();

      // 라벨 배지
      const a = this._anchor(m);
      const p = view.imageToCanvas(a.ix, a.iy);
      const R = 9;
      ctx.save();
      // 점 마커는 위치 표시 십자
      if (m.kind === 'point') {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.cx - 5, p.cy); ctx.lineTo(p.cx + 5, p.cy);
        ctx.moveTo(p.cx, p.cy - 5); ctx.lineTo(p.cx, p.cy + 5);
        ctx.stroke();
      }
      const by = p.cy - R - 6;   // 배지는 앵커 위쪽
      ctx.beginPath();
      ctx.arc(p.cx, by, R, 0, Math.PI * 2);
      ctx.fillStyle = this.selected.has(m.id) ? '#c49a4e' : 'rgba(30,30,30,0.85)';
      ctx.fill();
      ctx.strokeStyle = '#c49a4e';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = this.selected.has(m.id) ? '#1a1a1a' : '#c49a4e';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.label, p.cx, by + 0.5);
      ctx.restore();
    }
  }
}
