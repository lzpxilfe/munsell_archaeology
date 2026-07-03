/**
 * colorTemp.js
 * ─────────────────────────────────────────────────────────────────────
 * 색온도 보정 (Color Temperature Correction / Chromatic Adaptation)
 *
 * 현장 조건에 따른 조명 차이를 보정하여 정확한 먼셀 색 판별에 사용.
 * 기준 조명: D65 (6504K) — 표준 주광 (Munsell 색체계 기준)
 *
 * 보정 방식: Bradford Chromatic Adaptation Transform (CAT02 기반 간소화)
 * ─────────────────────────────────────────────────────────────────────
 */

class ColorTemperatureCorrector {
  constructor() {
    // Preset lighting conditions (fieldwork scenarios)
    this.presets = {
      sunny:    { K: 5500,  label: '맑은 날 직사광',  icon: '☀️',  desc: '직사광선 (5500K)' },
      haze:     { K: 6500,  label: '흐린 날',          icon: '🌤️', desc: '엷은 구름 (6500K)' },
      overcast: { K: 7500,  label: '흐린 날씨/완전 구름',  icon: '☁️',  desc: '흐린 날 (7500K)' },
      shade:    { K: 9000,  label: '그늘',              icon: '🌿',  desc: '나무 그늘 (9000K)' },
      indoor:   { K: 3200,  label: '실내 인공조명',    icon: '💡',  desc: '텅스텐 (3200K)' },
      led:      { K: 4000,  label: '실내 LED',         icon: '🔆',  desc: 'LED (4000K)' },
      d65:      { K: 6504,  label: '표준 기준 (D65)',  icon: '⚖️',  desc: '보정 없음 (6504K)' },
    };

    this.currentK = 6504; // default: no correction (D65)
  }

  /**
   * Kelvin → linear RGB for the illuminant white point
   * Using Kang et al. (2002) approximation
   */
  kelvinToXYZ(K) {
    // CIE xy chromaticity from CCT
    let x, y;
    if (K >= 1667 && K <= 4000) {
      x = -0.2661239e9 / (K**3) - 0.2343580e6 / (K**2) + 0.8776956e3 / K + 0.179910;
    } else if (K <= 25000) {
      x = -3.0258469e9 / (K**3) + 2.1070379e6 / (K**2) + 0.2226347e3 / K + 0.240390;
    } else {
      x = 0.3;
    }

    if (K >= 1667 && K <= 2222) {
      y = -1.1063814 * x**3 - 1.34811020 * x**2 + 2.18555832 * x - 0.20219683;
    } else if (K <= 4000) {
      y = -0.9549476 * x**3 - 1.37418593 * x**2 + 2.09137015 * x - 0.16748867;
    } else {
      y = 3.0817580 * x**3 - 5.87338670 * x**2 + 3.75112997 * x - 0.37001483;
    }

    // xyY → XYZ (Y = 1)
    const X = x / y;
    const Y = 1.0;
    const Z = (1 - x - y) / y;
    return { X, Y, Z };
  }

  /**
   * Bradford chromatic adaptation matrix
   * Adapts from source (src) illuminant to D65
   */
  getBradfordMatrix(srcK) {
    const d65 = this.kelvinToXYZ(6504);
    const src  = this.kelvinToXYZ(srcK);

    // Bradford matrix M_B
    const MB = [
      [ 0.8951,  0.2664, -0.1614],
      [-0.7502,  1.7135,  0.0367],
      [ 0.0389, -0.0685,  1.0296],
    ];

    const MBinv = [
      [ 0.9869929, -0.1470543,  0.1599627],
      [ 0.4323053,  0.5183603,  0.0492912],
      [-0.0085287,  0.0400428,  0.9684867],
    ];

    // Compute LMS for both illuminants
    const lmsSrc = this._multiplyMat3Vec3(MB, [src.X, src.Y, src.Z]);
    const lmsD65 = this._multiplyMat3Vec3(MB, [d65.X, d65.Y, d65.Z]);

    // Scale matrix (diagonal)
    const scale = [
      lmsD65[0] / (lmsSrc[0] || 1),
      lmsD65[1] / (lmsSrc[1] || 1),
      lmsD65[2] / (lmsSrc[2] || 1),
    ];

    const D = [
      [scale[0], 0, 0],
      [0, scale[1], 0],
      [0, 0, scale[2]],
    ];

    // M = MB_inv * D * MB
    const temp = this._multiplyMat3(D, MB);
    const M    = this._multiplyMat3(MBinv, temp);

    return M;
  }

  /**
   * Correct a single RGB pixel from sourceK → D65
   * Input/output: r, g, b in 0–255
   */
  correctPixel(r, g, b, sourceK) {
    if (!sourceK || Math.abs(sourceK - 6504) < 100) {
      return { r, g, b };
    }

    // Linearize (gamma decode, sRGB)
    let [rl, gl, bl] = [r, g, b].map(v => {
      const n = v / 255;
      return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    });

    // sRGB → XYZ (D65)
    const M_sRGB = [
      [0.4124564, 0.3575761, 0.1804375],
      [0.2126729, 0.7151522, 0.0721750],
      [0.0193339, 0.1191920, 0.9503041],
    ];
    let [X, Y, Z] = this._multiplyMat3Vec3(M_sRGB, [rl, gl, bl]);

    // Chromatic adaptation: from sourceK to D65
    // XYZ values are already in D65 space from camera, but the scene was lit by sourceK
    // We need to find what the object color would be under D65
    const catM = this.getBradfordMatrix(sourceK);
    [X, Y, Z] = this._multiplyMat3Vec3(catM, [X, Y, Z]);

    // XYZ → sRGB (D65)
    const M_XYZ_to_sRGB = [
      [ 3.2404542, -1.5371385, -0.4985314],
      [-0.9692660,  1.8760108,  0.0415560],
      [ 0.0556434, -0.2040259,  1.0572252],
    ];
    let [rc, gc, bc] = this._multiplyMat3Vec3(M_XYZ_to_sRGB, [X, Y, Z]);

    // Gamma encode
    const gamma = v => {
      v = Math.max(0, Math.min(1, v));
      return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    };

    return {
      r: Math.round(gamma(rc) * 255),
      g: Math.round(gamma(gc) * 255),
      b: Math.round(gamma(bc) * 255),
    };
  }

  /**
   * Apply correction to a canvas ImageData
   * Returns new corrected ImageData
   */
  correctImageData(imageData, sourceK) {
    if (!sourceK || Math.abs(sourceK - 6504) < 50) return imageData;

    const data = new Uint8ClampedArray(imageData.data);
    const catM = this.getBradfordMatrix(sourceK);

    // sRGB→XYZ matrix
    const M_sRGB = [
      [0.4124564, 0.3575761, 0.1804375],
      [0.2126729, 0.7151522, 0.0721750],
      [0.0193339, 0.1191920, 0.9503041],
    ];
    const M_XYZ_sRGB = [
      [ 3.2404542, -1.5371385, -0.4985314],
      [-0.9692660,  1.8760108,  0.0415560],
      [ 0.0556434, -0.2040259,  1.0572252],
    ];

    for (let i = 0; i < data.length; i += 4) {
      // Linearize
      const lin = [data[i], data[i+1], data[i+2]].map(v => {
        const n = v / 255;
        return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
      });

      let xyz = this._multiplyMat3Vec3(M_sRGB, lin);
      xyz = this._multiplyMat3Vec3(catM, xyz);
      let rgb = this._multiplyMat3Vec3(M_XYZ_sRGB, xyz);

      const gamma = v => {
        v = Math.max(0, Math.min(1, v));
        return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
      };

      data[i]   = Math.round(gamma(rgb[0]) * 255);
      data[i+1] = Math.round(gamma(rgb[1]) * 255);
      data[i+2] = Math.round(gamma(rgb[2]) * 255);
    }

    return new ImageData(data, imageData.width, imageData.height);
  }

  _multiplyMat3Vec3(M, v) {
    return [
      M[0][0]*v[0] + M[0][1]*v[1] + M[0][2]*v[2],
      M[1][0]*v[0] + M[1][1]*v[1] + M[1][2]*v[2],
      M[2][0]*v[0] + M[2][1]*v[1] + M[2][2]*v[2],
    ];
  }

  _multiplyMat3(A, B) {
    const C = [[0,0,0],[0,0,0],[0,0,0]];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        for (let k = 0; k < 3; k++)
          C[i][j] += A[i][k] * B[k][j];
    return C;
  }

  setCurrentK(K) { this.currentK = K; }
  getCurrentK()  { return this.currentK; }
}
