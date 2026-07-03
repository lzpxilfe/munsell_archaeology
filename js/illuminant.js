/**
 * illuminant.js
 * ─────────────────────────────────────────────────────────────────────
 * CIE 조명원 화이트 포인트 및 xyY ↔ XYZ 변환 기초 모듈
 *
 * 근거:
 *   - CIE 15:2004 Table 1 (2° standard observer)
 *   - Munsell Renotation: Illuminant C (NOT D65)
 *   - sRGB / 디지털 카메라: Illuminant D65
 *
 * ─────────────────────────────────────────────────────────────────────
 */

const Illuminant = (() => {

  // ─── White Points (CIE 1931 2° observer, Y=1 normalized) ──────────

  /** Illuminant C — 먼셀 Renotation 1943의 정의 기준 */
  const WP_C = Object.freeze({ X: 0.98074, Y: 1.00000, Z: 1.18232 });

  /** Illuminant D65 — sRGB / 디지털 카메라 기준 */
  const WP_D65 = Object.freeze({ X: 0.95047, Y: 1.00000, Z: 1.08883 });

  /** Illuminant D50 — 인쇄 / ICC 프로파일 기준 (참고용) */
  const WP_D50 = Object.freeze({ X: 0.96422, Y: 1.00000, Z: 0.82521 });


  // ─── xyY ↔ XYZ 변환 ───────────────────────────────────────────────

  /**
   * CIE xyY → CIE XYZ
   * @param {number} x  - 색도 x
   * @param {number} y  - 색도 y (0이면 블랙)
   * @param {number} Y  - 휘도 (0–1 정규화)
   * @returns {{ X, Y, Z }}
   */
  function xyYtoXYZ(x, y, Y) {
    if (y === 0) return { X: 0, Y: 0, Z: 0 };
    return {
      X: (x / y) * Y,
      Y: Y,
      Z: ((1 - x - y) / y) * Y,
    };
  }

  /**
   * CIE XYZ → CIE xyY
   * @param {number} X
   * @param {number} Y
   * @param {number} Z
   * @returns {{ x, y, Y }}
   */
  function XYZtoxyY(X, Y, Z) {
    const sum = X + Y + Z;
    if (sum === 0) return { x: 0, y: 0, Y: 0 };
    return { x: X / sum, y: Y / sum, Y };
  }

  // ─── XYZ ↔ CIE L*a*b* ────────────────────────────────────────────

  /**
   * CIE XYZ → CIE L*a*b*
   * @param {{ X, Y, Z }} xyz
   * @param {{ X, Y, Z }} wp  화이트 포인트 (Illuminant)
   * @returns {{ L, a, b }}
   */
  function XYZtoLab(xyz, wp) {
    const f = (t) => {
      const delta = 6 / 29;
      return t > delta ** 3
        ? Math.cbrt(t)
        : t / (3 * delta ** 2) + 4 / 29;
    };
    const fx = f(xyz.X / wp.X);
    const fy = f(xyz.Y / wp.Y);
    const fz = f(xyz.Z / wp.Z);
    return {
      L: 116 * fy - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz),
    };
  }

  /**
   * CIE L*a*b* → CIE XYZ
   * @param {{ L, a, b }} lab
   * @param {{ X, Y, Z }} wp
   * @returns {{ X, Y, Z }}
   */
  function LabtoXYZ(lab, wp) {
    const fy = (lab.L + 16) / 116;
    const fx = lab.a / 500 + fy;
    const fz = fy - lab.b / 200;
    const delta = 6 / 29;
    const f_inv = (t) => t > delta ? t ** 3 : 3 * delta ** 2 * (t - 4 / 29);
    return {
      X: f_inv(fx) * wp.X,
      Y: f_inv(fy) * wp.Y,
      Z: f_inv(fz) * wp.Z,
    };
  }

  // ─── Munsell Value ↔ Y ────────────────────────────────────────────

  /**
   * Munsell Value V → 휘도 Y (ASTM D1535 방법)
   * Wyszecki & Stiles 공식
   * @param {number} V  Munsell Value (0–10)
   * @returns {number}  Y in [0, 1]
   */
  function munsellValueToY(V) {
    // Y = V(V(V(V(V×0.001480 - 0.000241) + 0.02311) + 0.02030) + 1.1813V) + 0.0)
    // Simpler ASTM D1535-08 approximation:
    return (V / 10) * (1.2219 - 0.23111 * (V / 10) +
      0.23951 * (V / 10) ** 2 - 0.021009 * (V / 10) ** 3 +
      0.0008404 * (V / 10) ** 4);
  }

  /**
   * 휘도 Y → Munsell Value V (ASTM D1535 역함수, 근사)
   * @param {number} Y  in [0, 1]
   * @returns {number}  Munsell Value (0–10)
   */
  function yToMunsellValue(Y) {
    // Newton-Raphson iteration
    let V = Math.sqrt(Y) * 10;
    for (let i = 0; i < 5; i++) {
      const f  = munsellValueToY(V) - Y;
      const dV = 0.0001;
      const df = (munsellValueToY(V + dV) - munsellValueToY(V - dV)) / (2 * dV);
      V -= f / (df || 1e-10);
      V = Math.max(0, Math.min(10, V));
    }
    return Math.round(V * 10) / 10;
  }

  // ─── sRGB ↔ Linear RGB ────────────────────────────────────────────

  /**
   * sRGB gamma 디코딩 (IEC 61966-2-1)
   * @param {number} v  sRGB channel [0, 1]
   * @returns {number}  linear [0, 1]
   */
  function sRGBtoLinear(v) {
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  /**
   * sRGB gamma 인코딩
   * @param {number} v  linear [0, 1]
   * @returns {number}  sRGB [0, 1]
   */
  function linearToSRGB(v) {
    v = Math.max(0, Math.min(1, v));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  }

  // ─── sRGB 255 ↔ XYZ (D65) ─────────────────────────────────────────

  /**
   * sRGB [0–255] → XYZ_D65
   * 행렬: IEC 61966-2-1 / Lindbloom
   */
  function sRGB255toXYZ_D65(r, g, b) {
    const rl = sRGBtoLinear(r / 255);
    const gl = sRGBtoLinear(g / 255);
    const bl = sRGBtoLinear(b / 255);
    return {
      X: 0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl,
      Y: 0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl,
      Z: 0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl,
    };
  }

  /**
   * XYZ_D65 → sRGB [0–255]
   */
  function XYZ_D65tosRGB255(X, Y, Z) {
    const rl =  3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
    const gl = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z;
    const bl =  0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
    return {
      r: Math.round(linearToSRGB(rl) * 255),
      g: Math.round(linearToSRGB(gl) * 255),
      b: Math.round(linearToSRGB(bl) * 255),
    };
  }

  // ─── Exports ──────────────────────────────────────────────────────
  return {
    WP_C, WP_D65, WP_D50,
    xyYtoXYZ, XYZtoxyY,
    XYZtoLab, LabtoXYZ,
    munsellValueToY, yToMunsellValue,
    sRGBtoLinear, linearToSRGB,
    sRGB255toXYZ_D65, XYZ_D65tosRGB255,
  };
})();
