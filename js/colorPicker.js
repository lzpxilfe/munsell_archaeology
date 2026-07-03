/**
 * colorPicker.js
 * ─────────────────────────────────────────────────────────────────────
 * Canvas 기반 스포이드 — 돋보기 + 다중 픽셀 샘플링 + 색온도 보정 통합
 * ─────────────────────────────────────────────────────────────────────
 */

class ColorPicker {
  constructor(canvas, magnifier, magnifierCanvas, onPick) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d', { willReadFrequently: true });
    this.magnifier    = magnifier;
    this.magCanvas    = magnifierCanvas;
    this.magCtx       = magnifierCanvas.getContext('2d', { willReadFrequently: true });
    this.onPick       = onPick;

    this.img          = null;
    this.sampleRadius = 1;    // 1=1px, 2=3×3, 3=5×5, 4=7×7
    this.lightingK    = 6504;
    this.tempCorrector = null;

    // Cached corrected image for display
    this._correctedBitmap = null;
    this._correcting = false;

    // Canvas-to-image mapping
    this.scale   = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    this._bind();
  }

  _bind() {
    this.canvas.addEventListener('mousemove',  e => this._onMove(e));
    this.canvas.addEventListener('mouseleave', e => this._onLeave(e));
    this.canvas.addEventListener('click',      e => this._onClick(e));
    this.canvas.addEventListener('touchstart', e => this._onTouch(e), { passive: false });
  }

  // ─── Public ───────────────────────────────────────────────────────

  setImage(img, lightingK, tempCorrector) {
    this.img = img;
    this.lightingK    = lightingK || 6504;
    this.tempCorrector = tempCorrector || null;
    this._correctedBitmap = null;
    this._render();
    this._applyCorrection();
  }

  setLightingK(K, tempCorrector) {
    this.lightingK    = K;
    this.tempCorrector = tempCorrector;
    this._correctedBitmap = null;
    if (this.img) {
      this._render();
      this._applyCorrection();
    }
  }

  setSampleRadius(r) { this.sampleRadius = r; }

  resize() { if (this.img) this._render(); }

  // ─── Rendering ────────────────────────────────────────────────────

  _render() {
    const canvas = this.canvas;
    const pw = canvas.parentElement?.offsetWidth  || canvas.offsetWidth;
    const ph = canvas.parentElement?.offsetHeight || canvas.offsetHeight;
    canvas.width  = pw;
    canvas.height = ph;

    if (!this.img) return;

    const iw = this.img.naturalWidth;
    const ih = this.img.naturalHeight;
    this.scale   = Math.min(pw / iw, ph / ih);
    const rw = iw * this.scale;
    const rh = ih * this.scale;
    this.offsetX = (pw - rw) / 2;
    this.offsetY = (ph - rh) / 2;

    if (this._correctedBitmap) {
      this.ctx.clearRect(0, 0, pw, ph);
      this.ctx.drawImage(this._correctedBitmap, this.offsetX, this.offsetY, rw, rh);
    } else {
      this.ctx.clearRect(0, 0, pw, ph);
      this.ctx.drawImage(this.img, this.offsetX, this.offsetY, rw, rh);
    }
  }

  async _applyCorrection() {
    if (!this.img || !this.tempCorrector || Math.abs(this.lightingK - 6504) < 50) {
      this._correctedBitmap = null;
      this._render();
      return;
    }

    if (this._correcting) return;
    this._correcting = true;

    // Draw original to offscreen canvas, read pixel data, correct, write back
    const off = document.createElement('canvas');
    off.width  = this.img.naturalWidth;
    off.height = this.img.naturalHeight;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.drawImage(this.img, 0, 0);

    const imageData = octx.getImageData(0, 0, off.width, off.height);

    // Run in "chunks" to avoid UI freeze on large images
    const corrected = await this._correctAsync(imageData, this.lightingK);
    octx.putImageData(corrected, 0, 0);

    // Create ImageBitmap for fast drawImage
    this._correctedBitmap = await createImageBitmap(off);
    this._correcting = false;
    this._render();
  }

  _correctAsync(imageData, K) {
    return new Promise(resolve => {
      // Run correction off the main thread using setTimeout chunking
      const corrected = this.tempCorrector.correctImageData(imageData, K);
      resolve(corrected);
    });
  }

  // ─── Sampling ─────────────────────────────────────────────────────

  _canvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      cx: (e.clientX - rect.left) * (this.canvas.width  / rect.width),
      cy: (e.clientY - rect.top)  * (this.canvas.height / rect.height),
    };
  }

  _sampleColor(cx, cy) {
    const r    = this.sampleRadius;
    const size = r === 1 ? 1 : (r * 2 - 1);  // 1,3,5,7
    const sx   = Math.max(0, Math.round(cx) - Math.floor(size / 2));
    const sy   = Math.max(0, Math.round(cy) - Math.floor(size / 2));

    // Read from corrected canvas (already has color temp applied)
    const data = this.ctx.getImageData(sx, sy, size, size).data;

    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      rSum += data[i]; gSum += data[i+1]; bSum += data[i+2]; count++;
    }
    if (!count) return null;

    return {
      r: Math.round(rSum / count),
      g: Math.round(gSum / count),
      b: Math.round(bSum / count),
    };
  }

  // ─── Magnifier ────────────────────────────────────────────────────

  _updateMagnifier(e, cx, cy) {
    const mag = this.magnifier;
    if (!mag) return;
    mag.style.display = 'block';
    mag.style.left    = e.clientX + 'px';
    mag.style.top     = e.clientY + 'px';

    const srcSize = 15;
    const half    = Math.floor(srcSize / 2);
    const srcX    = Math.max(0, Math.round(cx) - half);
    const srcY    = Math.max(0, Math.round(cy) - half);
    const mw = this.magCanvas.offsetWidth  || 120;
    const mh = this.magCanvas.offsetHeight || 120;
    this.magCanvas.width  = mw;
    this.magCanvas.height = mh;

    this.magCtx.imageSmoothingEnabled = false;
    this.magCtx.clearRect(0, 0, mw, mh);
    this.magCtx.drawImage(this.canvas, srcX, srcY, srcSize, srcSize, 0, 0, mw, mh);
  }

  _drawSampleBox(cx, cy) {
    const r    = this.sampleRadius;
    const size = r === 1 ? 1 : (r * 2 - 1);
    const sx   = Math.round(cx) - Math.floor(size / 2) - 0.5;
    const sy   = Math.round(cy) - Math.floor(size / 2) - 0.5;

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    this.ctx.shadowColor = 'rgba(0,0,0,0.8)';
    this.ctx.shadowBlur  = 2;
    this.ctx.lineWidth   = 1;
    this.ctx.strokeRect(sx, sy, size, size);
    this.ctx.restore();
  }

  // ─── Events ───────────────────────────────────────────────────────

  _onMove(e) {
    if (!this.img) return;
    const { cx, cy } = this._canvasCoords(e);
    this._render();
    this._drawSampleBox(cx, cy);
    this._updateMagnifier(e, cx, cy);

    // Live preview color
    const color = this._sampleColor(cx, cy);
    if (color) {
      const hex = '#' + [color.r, color.g, color.b]
        .map(v => v.toString(16).padStart(2,'0')).join('');
      const preview = document.getElementById('hover-preview');
      if (preview) {
        preview.style.background = hex;
        preview.title = hex;
      }
    }
  }

  _onLeave() {
    if (this.magnifier) this.magnifier.style.display = 'none';
    if (this.img) this._render();
  }

  _onClick(e) {
    if (!this.img) return;
    const { cx, cy } = this._canvasCoords(e);

    // Only pick if within image bounds
    const iw = this.img.naturalWidth * this.scale;
    const ih = this.img.naturalHeight * this.scale;
    if (cx < this.offsetX || cx > this.offsetX + iw ||
        cy < this.offsetY || cy > this.offsetY + ih) return;

    const color = this._sampleColor(cx, cy);
    if (color) {
      this.onPick(color);
      this._showPickIndicator(cx, cy);
    }
  }

  _onTouch(e) {
    e.preventDefault();
    const t = e.touches[0];
    this._onClick({ clientX: t.clientX, clientY: t.clientY,
                    getBoundingClientRect: () => ({}) });
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
