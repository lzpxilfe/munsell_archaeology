/**
 * imageView.js
 * ─────────────────────────────────────────────────────────────────────
 * 이미지 뷰 관리 — 풀해상도 픽셀 캐시 + 줌/팬 + 좌표 변환
 *
 * 역할:
 *   - 원본(originalImageData)과 조명 보정본(correctedImageData)을
 *     이미지 해상도 그대로 보관 → 표시 캔버스의 축소·보간과 무관하게
 *     정확한 픽셀 샘플링 제공
 *   - 뷰 변환(scale/tx/ty): 휠 줌(커서 기준), 팬
 *   - 모든 도구(스포이드/영역선택/마커)가 공유하는 좌표 변환:
 *       캔버스 좌표 ↔ 이미지 좌표
 *   - 오버레이 레이어: 이미지 위에 그리는 도구별 드로잉 콜백
 *
 * 메모리 캡:
 *   긴 변이 MAX_LONG_EDGE를 넘으면 로드 시 다운스케일한다.
 *   (48MP × RGBA × 2벌 ≈ 400MB 방지. 색 평균 목적에는 손실 무시 가능)
 * ─────────────────────────────────────────────────────────────────────
 */

class ImageView {
  static MAX_LONG_EDGE = 5000;
  static MIN_SCALE_FACTOR = 1;    // fit 배율 × 1 = 최소 줌
  static MAX_SCALE_FACTOR = 8;    // fit 배율 × 8 = 최대 줌

  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });

    this.imgWidth = 0;
    this.imgHeight = 0;
    this.wasDownscaled = false;

    this.originalImageData = null;   // 조명 보정 전 (그레이카드 추정용)
    this.correctedImageData = null;  // 조명 보정 후 (모든 샘플링의 기준)
    this._srcCanvas = null;          // 보정본을 담은 오프스크린 캔버스 (표시용)

    // 뷰 변환: 캔버스 = 이미지 × scale + (tx, ty)
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;
    this._fitScale = 1;

    // 오버레이 드로잉 콜백: (ctx, view) => void — 캔버스 좌표계에서 호출됨
    this.overlays = [];
  }

  get hasImage() { return !!this.correctedImageData; }

  // ─── 이미지 로드 ──────────────────────────────────────────────────

  /**
   * HTMLImageElement 로드. 긴 변 캡 적용 후 원본 ImageData 보관.
   * @returns {{ downscaled: boolean }}
   */
  load(img) {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const cap = ImageView.MAX_LONG_EDGE;
    const ratio = Math.min(1, cap / Math.max(iw, ih));

    this.imgWidth = Math.round(iw * ratio);
    this.imgHeight = Math.round(ih * ratio);
    this.wasDownscaled = ratio < 1;

    const off = document.createElement('canvas');
    off.width = this.imgWidth;
    off.height = this.imgHeight;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(img, 0, 0, this.imgWidth, this.imgHeight);

    this.originalImageData = octx.getImageData(0, 0, this.imgWidth, this.imgHeight);
    this._srcCanvas = off;           // 로드 직후 = 원본 그대로
    this.correctedImageData = this.originalImageData;

    this.fitToCanvas();
    return { downscaled: this.wasDownscaled };
  }

  /**
   * 조명 보정본 교체 (correctFn: imageData → imageData)
   * correctFn이 null이면 원본 그대로 사용.
   */
  applyCorrection(correctFn) {
    if (!this.originalImageData) return;
    this.correctedImageData = correctFn
      ? correctFn(this.originalImageData)
      : this.originalImageData;
    this._srcCanvas.getContext('2d').putImageData(this.correctedImageData, 0, 0);
  }

  /** 보정본이 그려진 오프스크린 캔버스 (돋보기 등 외부 drawImage 소스) */
  get sourceCanvas() { return this._srcCanvas; }

  // ─── 뷰 변환 ─────────────────────────────────────────────────────

  fitToCanvas() {
    const cw = this.canvas.width, ch = this.canvas.height;
    if (!this.imgWidth || !cw || !ch) return;
    this._fitScale = Math.min(cw / this.imgWidth, ch / this.imgHeight);
    this.scale = this._fitScale;
    this.tx = (cw - this.imgWidth * this.scale) / 2;
    this.ty = (ch - this.imgHeight * this.scale) / 2;
  }

  get zoomFactor() { return this._fitScale ? this.scale / this._fitScale : 1; }

  /**
   * 커서(캔버스 좌표) 기준 줌
   */
  zoomAt(cx, cy, factor) {
    const min = this._fitScale * ImageView.MIN_SCALE_FACTOR;
    const max = this._fitScale * ImageView.MAX_SCALE_FACTOR;
    const next = Math.min(max, Math.max(min, this.scale * factor));
    if (next === this.scale) return;

    // 커서가 가리키는 이미지 지점을 고정한 채 배율 변경
    const { ix, iy } = this.canvasToImage(cx, cy);
    this.scale = next;
    this.tx = cx - ix * next;
    this.ty = cy - iy * next;
    this._clampPan();
  }

  panBy(dx, dy) {
    this.tx += dx;
    this.ty += dy;
    this._clampPan();
  }

  _clampPan() {
    // 이미지가 캔버스 밖으로 완전히 사라지지 않도록 이동 범위 제한
    const cw = this.canvas.width, ch = this.canvas.height;
    const rw = this.imgWidth * this.scale;
    const rh = this.imgHeight * this.scale;

    if (rw <= cw) this.tx = (cw - rw) / 2;
    else this.tx = Math.min(0, Math.max(cw - rw, this.tx));

    if (rh <= ch) this.ty = (ch - rh) / 2;
    else this.ty = Math.min(0, Math.max(ch - rh, this.ty));
  }

  // ─── 좌표 변환 ───────────────────────────────────────────────────

  canvasToImage(cx, cy) {
    return { ix: (cx - this.tx) / this.scale, iy: (cy - this.ty) / this.scale };
  }

  imageToCanvas(ix, iy) {
    return { cx: ix * this.scale + this.tx, cy: iy * this.scale + this.ty };
  }

  inImage(ix, iy) {
    return ix >= 0 && iy >= 0 && ix < this.imgWidth && iy < this.imgHeight;
  }

  // ─── 렌더 ────────────────────────────────────────────────────────

  render() {
    const ctx = this.ctx;
    const cw = this.canvas.width, ch = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    if (!this.hasImage) return;

    ctx.setTransform(this.scale, 0, 0, this.scale, this.tx, this.ty);
    // 고배율에서는 픽셀 경계가 보이도록 보간 끔
    ctx.imageSmoothingEnabled = this.zoomFactor < 3;
    ctx.drawImage(this._srcCanvas, 0, 0);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const draw of this.overlays) draw(ctx, this);
  }

  /**
   * 캔버스 요소 크기를 부모에 맞추고 fit 재계산 (창 리사이즈 시)
   */
  resize() {
    const canvas = this.canvas;
    const pw = canvas.parentElement?.offsetWidth || canvas.offsetWidth;
    const ph = canvas.parentElement?.offsetHeight || canvas.offsetHeight;
    const prevZoom = this.zoomFactor;
    canvas.width = pw;
    canvas.height = ph;
    if (this.hasImage) {
      // 리사이즈 시 fit 기준을 다시 잡되 현재 줌 배율 유지
      const cw = pw, ch = ph;
      this._fitScale = Math.min(cw / this.imgWidth, ch / this.imgHeight);
      this.scale = this._fitScale * prevZoom;
      this._clampPan();
    }
    this.render();
  }

  // ─── 샘플링 (이미지 좌표, 보정본 기준) ───────────────────────────

  /**
   * (ix, iy) 주변 size×size 평균색 — 보정본에서 읽음
   * @returns {{r,g,b} | null}
   */
  sampleAt(ix, iy, size = 1, imageData = this.correctedImageData) {
    if (!imageData) return null;
    const half = Math.floor(size / 2);
    const x0 = Math.round(ix) - half;
    const y0 = Math.round(iy) - half;

    const data = imageData.data;
    const W = imageData.width, H = imageData.height;
    let r = 0, g = 0, b = 0, n = 0;

    for (let y = y0; y < y0 + size; y++) {
      if (y < 0 || y >= H) continue;
      for (let x = x0; x < x0 + size; x++) {
        if (x < 0 || x >= W) continue;
        const i = (y * W + x) * 4;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
    }
    if (!n) return null;
    return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
  }

  /** 보정 전 원본에서 같은 위치 샘플 (그레이카드/보정前 표시용) */
  sampleRawAt(ix, iy, size = 1) {
    return this.sampleAt(ix, iy, size, this.originalImageData);
  }
}
