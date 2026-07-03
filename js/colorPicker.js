/**
 * colorPicker.js
 * ─────────────────────────────────────────────────────────────────────
 * Canvas 스포이드 + 도구 라우팅 (ImageView 기반)
 *
 * 변경점 (v2):
 *   - 표시 캔버스가 아닌 ImageView의 풀해상도 보정본에서 샘플링
 *     → 축소·보간에 의한 왜곡 없음, 1px/3×3 샘플이 진짜 원본 픽셀 단위
 *   - 휠 줌(커서 기준) + 팬(Space+드래그 / 휠버튼 드래그 / 팬 도구)
 *   - 도구 핸들러 등록 구조: regionSelect(사각형/올가미), 그레이카드 등
 *     외부 도구가 registerTool()로 끼어들 수 있음
 *   - onPick 콜백에 보정된 색과 보정 전(raw) 색을 함께 전달
 *     (이중 보정 버그 수정: 호출부에서 재보정 금지)
 * ─────────────────────────────────────────────────────────────────────
 */

class ColorPicker {
  constructor(canvas, magnifier, magnifierCanvas, onPick) {
    this.canvas = canvas;
    this.view   = new ImageView(canvas);
    this.magnifier = magnifier;
    this.magCanvas = magnifierCanvas;
    this.magCtx    = magnifierCanvas.getContext('2d', { willReadFrequently: true });
    this.onPick    = onPick;

    this.sampleRadius = 1;    // 1=1px, 2=3×3, 3=5×5, 4=7×7
    this.tool = 'pick';       // 'pick' | 'pan' | (외부 등록: 'rect', 'lasso', 'graycard' …)
    this._tools = {};         // name → { down, move, up, draw, cursor }

    this._panning  = false;
    this._spaceDown = false;
    this._lastPan  = null;

    this._bind();
  }

  // ─── Public ───────────────────────────────────────────────────────

  /**
   * 이미지 로드 + 보정 적용
   * @param {HTMLImageElement} img
   * @param {(imageData) => imageData | null} correctFn  조명 보정 함수
   * @returns {{ downscaled: boolean }}
   */
  setImage(img, correctFn) {
    this._syncCanvasSize();
    const info = this.view.load(img);
    this.view.applyCorrection(correctFn);
    this.view.render();
    this._updateStatus();
    return info;
  }

  /** 조명 보정 변경 (correctFn=null이면 보정 없음) */
  setCorrection(correctFn) {
    if (!this.view.hasImage) return;
    this.view.applyCorrection(correctFn);
    this.view.render();
  }

  setSampleRadius(r) { this.sampleRadius = r; }

  setTool(name) {
    this.tool = name;
    this._applyCursor();
  }

  /**
   * 외부 도구 등록
   * @param {string} name
   * @param {{ down?, move?, up?, draw?, cursor? }} handler
   *   down/move/up: (pos, e) => void — pos = { cx, cy, ix, iy }
   *   draw: (ctx, view) => void — 매 렌더 후 오버레이
   */
  registerTool(name, handler) {
    this._tools[name] = handler;
    if (handler.draw) this.view.overlays.push((ctx, view) => {
      if (this.tool === name || handler.always) handler.draw(ctx, view);
    });
  }

  /** 마커 등 상시 오버레이 등록 */
  addOverlay(draw) { this.view.overlays.push(draw); }

  resize() {
    if (!this.view.hasImage) return;
    this.view.resize();
  }

  render() { this.view.render(); }

  get hasImage() { return this.view.hasImage; }

  /** 현재 샘플 크기 (px) */
  get sampleSize() {
    const r = this.sampleRadius;
    return r === 1 ? 1 : (r * 2 - 1);   // 1,3,5,7
  }

  /** (이미지 좌표) 보정본/원본 동시 샘플 */
  samplePair(ix, iy) {
    const size = this.sampleSize;
    const color = this.view.sampleAt(ix, iy, size);
    const raw   = this.view.sampleRawAt(ix, iy, size);
    return color ? { ...color, raw } : null;
  }

  // ─── 내부: 이벤트 ─────────────────────────────────────────────────

  _bind() {
    const c = this.canvas;
    c.addEventListener('mousemove',  e => this._onMove(e));
    c.addEventListener('mouseleave', () => this._onLeave());
    c.addEventListener('mousedown',  e => this._onDown(e));
    window.addEventListener('mouseup', e => this._onUp(e));
    c.addEventListener('wheel',      e => this._onWheel(e), { passive: false });
    c.addEventListener('touchstart', e => this._onTouch(e), { passive: false });
    c.addEventListener('contextmenu', e => e.preventDefault());

    window.addEventListener('keydown', e => {
      if (e.code === 'Space' && !this._isTyping(e)) {
        this._spaceDown = true;
        this._applyCursor();
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', e => {
      if (e.code === 'Space') {
        this._spaceDown = false;
        // _panning은 여기서 풀지 않는다 — 마우스 버튼이 아직 눌려 있으면
        // 팬을 유지해야 mouseup이 색 채취로 오인되지 않는다 (_onUp에서 해제)
        this._applyCursor();
      }
    });
  }

  _isTyping(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
  }

  _pos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (this.canvas.width  / rect.width);
    const cy = (e.clientY - rect.top)  * (this.canvas.height / rect.height);
    const { ix, iy } = this.view.canvasToImage(cx, cy);
    return { cx, cy, ix, iy };
  }

  _panActive(e) {
    return this.tool === 'pan' || this._spaceDown || (e && e.button === 1);
  }

  _onDown(e) {
    if (!this.view.hasImage) return;
    // 제스처 출처 추적: 캔버스에서 시작한 드래그만 up에서 발화되도록
    // (패널의 텍스트 드래그를 캔버스 위에서 놓아도 픽/그레이카드가 발화하면 안 됨)
    this._gestureOnCanvas = true;
    const pos = this._pos(e);

    if (this._panActive(e)) {
      this._panning = true;
      this._lastPan = { x: pos.cx, y: pos.cy };
      e.preventDefault();
      return;
    }

    const handler = this._tools[this.tool];
    if (handler?.down) { handler.down(pos, e); return; }
  }

  _onMove(e) {
    if (!this.view.hasImage) return;
    const pos = this._pos(e);

    if (this._panning) {
      this.view.panBy(pos.cx - this._lastPan.x, pos.cy - this._lastPan.y);
      this._lastPan = { x: pos.cx, y: pos.cy };
      this.view.render();
      return;
    }

    const handler = this._tools[this.tool];
    if (handler?.move) {
      handler.move(pos, e);
      return;
    }

    // 기본(스포이드) 호버: 샘플 박스 + 돋보기 + 미리보기
    this.view.render();
    if (this.tool === 'pick' && this.view.inImage(pos.ix, pos.iy)) {
      this._drawSampleBox(pos);
      this._updateMagnifier(e, pos);
      this._updateHoverPreview(pos);
    } else {
      this._hideMagnifier();
    }
  }

  _onUp(e) {
    const startedOnCanvas = this._gestureOnCanvas;
    this._gestureOnCanvas = false;

    if (this._panning) { this._panning = false; return; }
    if (!this.view.hasImage || !startedOnCanvas) return;

    const handler = this._tools[this.tool];
    if (handler?.up) {
      // mouseup은 window에서 오므로 캔버스 좌표로 재계산
      handler.up(this._pos(e), e);
      return;
    }

    // 기본 스포이드: 클릭 픽
    if (this.tool === 'pick' && e.target === this.canvas && e.button === 0) {
      const pos = this._pos(e);
      if (!this.view.inImage(pos.ix, pos.iy)) return;
      const color = this.samplePair(pos.ix, pos.iy);
      if (color) {
        this.onPick({ ...color, point: { ix: pos.ix, iy: pos.iy } });
        this._showPickIndicator(pos.cx, pos.cy);
      }
    }
  }

  _onWheel(e) {
    if (!this.view.hasImage) return;
    e.preventDefault();
    const pos = this._pos(e);
    this.view.zoomAt(pos.cx, pos.cy, e.deltaY < 0 ? 1.25 : 0.8);
    this.view.render();
    this._updateStatus();
  }

  _onTouch(e) {
    e.preventDefault();
    if (!this.view.hasImage) return;
    const t = e.touches[0];
    const pos = this._pos({ clientX: t.clientX, clientY: t.clientY });
    if (this.tool === 'pick' && this.view.inImage(pos.ix, pos.iy)) {
      const color = this.samplePair(pos.ix, pos.iy);
      if (color) {
        this.onPick({ ...color, point: { ix: pos.ix, iy: pos.iy } });
        this._showPickIndicator(pos.cx, pos.cy);
      }
    }
  }

  _onLeave() {
    this._hideMagnifier();
    if (this.view.hasImage) this.view.render();
  }

  // ─── 내부: 표시 ───────────────────────────────────────────────────

  _syncCanvasSize() {
    const canvas = this.canvas;
    const pw = canvas.parentElement?.offsetWidth  || canvas.offsetWidth;
    const ph = canvas.parentElement?.offsetHeight || canvas.offsetHeight;
    canvas.width  = pw;
    canvas.height = ph;
  }

  _applyCursor() {
    const t = this._tools[this.tool];
    this.canvas.style.cursor =
      (this._spaceDown || this.tool === 'pan') ? 'grab'
      : (t?.cursor || 'crosshair');
  }

  /** 이미지 픽셀에 정렬된 샘플 박스 */
  _drawSampleBox(pos) {
    const size = this.sampleSize;
    const half = Math.floor(size / 2);
    const x0 = Math.round(pos.ix) - half;
    const y0 = Math.round(pos.iy) - half;
    const p  = this.view.imageToCanvas(x0, y0);
    const s  = size * this.view.scale;

    const ctx = this.view.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur  = 2;
    ctx.lineWidth   = 1;
    ctx.strokeRect(p.cx - 0.5, p.cy - 0.5, Math.max(s, 3), Math.max(s, 3));
    ctx.restore();
  }

  _updateMagnifier(e, pos) {
    const mag = this.magnifier;
    if (!mag) return;
    mag.style.display = 'block';
    mag.style.left    = e.clientX + 'px';
    mag.style.top     = e.clientY + 'px';

    // 이미지 좌표계에서 15×15px 창을 소스 캔버스(보정본)에서 확대
    const srcSize = 15;
    const half    = Math.floor(srcSize / 2);
    const srcX    = Math.max(0, Math.round(pos.ix) - half);
    const srcY    = Math.max(0, Math.round(pos.iy) - half);
    const mw = this.magCanvas.offsetWidth  || 120;
    const mh = this.magCanvas.offsetHeight || 120;
    this.magCanvas.width  = mw;
    this.magCanvas.height = mh;

    this.magCtx.imageSmoothingEnabled = false;
    this.magCtx.clearRect(0, 0, mw, mh);
    this.magCtx.drawImage(this.view.sourceCanvas, srcX, srcY, srcSize, srcSize, 0, 0, mw, mh);
  }

  _hideMagnifier() {
    if (this.magnifier) this.magnifier.style.display = 'none';
  }

  _updateHoverPreview(pos) {
    const color = this.view.sampleAt(pos.ix, pos.iy, this.sampleSize);
    if (!color) return;
    const hex = '#' + [color.r, color.g, color.b]
      .map(v => v.toString(16).padStart(2, '0')).join('');
    const preview = document.getElementById('hover-preview');
    if (preview) {
      preview.style.background = hex;
      preview.title = hex;
    }
  }

  _updateStatus() {
    const el = document.getElementById('canvas-status');
    if (!el) return;
    const z = Math.round(this.view.zoomFactor * 100);
    el.textContent = z > 100
      ? `줌 ${z}% — Space+드래그로 이동, 휠로 줌`
      : '클릭: 색 채취 · 휠: 줌 · Space+드래그: 이동';
  }

  _showPickIndicator(cx, cy) {
    const wrap = this.canvas.parentElement;
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'pick-indicator';
    el.style.left = (cx - 10) + 'px';
    el.style.top  = (cy - 10) + 'px';
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }
}
