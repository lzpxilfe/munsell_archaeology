/**
 * layerOverlay.js
 * ─────────────────────────────────────────────────────────────────────
 * 층위 경계 고정 — 층위 번호를 매긴 채취 영역을 사진 위에 영구히 표시
 *
 * markers.js(임시 비교용 마커, A/B/C 라벨)와 달리, 이건 "공식 기록"인
 * state.layers를 그대로 읽어서 layer.region이 있는 항목마다 경계선과
 * 실제 층위 번호를 그린다. 여러 층을 차례로 따내면 사진 위에 토층
 * 구분선 전체가 번호와 함께 남는 스케치가 된다.
 *
 * 마커(원형 금색 배지)와 시각적으로 구분되도록 사각 초록색 배지를 쓴다.
 * ─────────────────────────────────────────────────────────────────────
 */

class LayerOverlay {
  /**
   * @param {ColorPicker} picker
   * @param {() => Array} getLayers  최신 state.layers를 반환 (캐싱 없이 매 렌더마다 조회)
   */
  constructor(picker, getLayers) {
    this.picker = picker;
    this.view = picker.view;
    this.getLayers = getLayers;
    this.visible = true;

    picker.addOverlay((ctx, view) => this._draw(ctx, view));
  }

  setVisible(v) {
    this.visible = v;
    this.view.render();
  }

  /** 배지 앵커 (이미지 좌표) — markers.js와 동일한 규칙 */
  _anchor(region) {
    const { kind, geometry } = region;
    if (kind === 'point') return geometry;
    if (kind === 'rect') {
      return { ix: (geometry.x0 + geometry.x1) / 2,
               iy: Math.min(geometry.y0, geometry.y1) };
    }
    return { ix: geometry.pts[0].ix, iy: geometry.pts[0].iy };   // lasso / polyline
  }

  _draw(ctx, view) {
    if (!this.visible) return;
    const layers = this.getLayers() || [];

    for (const layer of layers) {
      const region = layer.region;
      if (!region) continue;
      const { kind, geometry } = region;

      // 경계 외곽선
      ctx.save();
      ctx.strokeStyle = 'rgba(109,190,109,0.85)';
      ctx.lineWidth = 1.5;
      if (kind === 'rect') {
        const p0 = view.imageToCanvas(Math.min(geometry.x0, geometry.x1), Math.min(geometry.y0, geometry.y1));
        const p1 = view.imageToCanvas(Math.max(geometry.x0, geometry.x1), Math.max(geometry.y0, geometry.y1));
        ctx.strokeRect(p0.cx, p0.cy, p1.cx - p0.cx, p1.cy - p0.cy);
      } else if (geometry.pts) {
        const pts = geometry.pts;
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

      // 층위 번호 배지 (사각형 — 마커의 원형 배지와 구분)
      const a = this._anchor(region);
      const p = view.imageToCanvas(a.ix, a.iy);
      const label = String(layer.number ?? '');

      ctx.save();
      ctx.font = 'bold 12px sans-serif';
      const tw = ctx.measureText(label).width;
      const padX = 6, h = 20;
      const w = Math.max(h, tw + padX * 2);
      const bx = p.cx - w / 2, by = p.cy - h - 10;

      if (kind === 'point') {
        ctx.strokeStyle = 'rgba(109,190,109,0.9)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.cx - 5, p.cy); ctx.lineTo(p.cx + 5, p.cy);
        ctx.moveTo(p.cx, p.cy - 5); ctx.lineTo(p.cx, p.cy + 5);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.rect(bx, by, w, h);
      ctx.fillStyle = 'rgba(24,38,24,0.9)';
      ctx.fill();
      ctx.strokeStyle = '#6dbe6d';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#8fd98f';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, bx + w / 2, by + h / 2 + 0.5);
      ctx.restore();
    }
  }
}
