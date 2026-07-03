/**
 * chromAdapt.js
 * ─────────────────────────────────────────────────────────────────────
 * CAT02 크로마틱 어댑테이션 (Chromatic Adaptation Transform)
 *
 * 역할:
 *   1. 먼셀 변환용: D65 ↔ Illuminant C (먼셀 Renotation 기준)
 *   2. 현장 보정용: 임의 조명원 ↔ D65 (색온도 보정)
 *
 * 근거:
 *   - CIE 159:2004 — CAT02 공식 표준
 *   - Lindbloom (http://www.brucelindbloom.com/Eqn_ChromAdapt.html)
 *   - colour-science/colour 구현 검증
 *
 * Bradford vs CAT02:
 *   Bradford는 photo 보정에 광범위하게 쓰이지만 CAT02가
 *   먼셀 색체계 맥락에서 더 정확합니다 (colour-science 권고).
 * ─────────────────────────────────────────────────────────────────────
 */

const ChromAdapt = (() => {

  // ─── CAT02 행렬 (CIE 159:2004) ────────────────────────────────────

  const M_CAT02 = [
    [ 0.7328,  0.4296, -0.1624],
    [-0.7036,  1.6975,  0.0061],
    [ 0.0030,  0.0136,  0.9834],
  ];

  const M_CAT02_INV = [
    [ 1.096124, -0.278869,  0.182745],
    [ 0.454369,  0.473533,  0.072098],
    [-0.009628, -0.005698,  1.015326],
  ];

  // ─── Bradford 행렬 (색온도 보정용, 현장 preview) ──────────────────

  const M_BRADFORD = [
    [ 0.8951,  0.2664, -0.1614],
    [-0.7502,  1.7135,  0.0367],
    [ 0.0389, -0.0685,  1.0296],
  ];

  const M_BRADFORD_INV = [
    [ 0.9869929, -0.1470543,  0.1599627],
    [ 0.4323053,  0.5183603,  0.0492912],
    [-0.0085287,  0.0400428,  0.9684867],
  ];

  // ─── 유틸리티 ─────────────────────────────────────────────────────

  function matVec(M, v) {
    return [
      M[0][0]*v[0] + M[0][1]*v[1] + M[0][2]*v[2],
      M[1][0]*v[0] + M[1][1]*v[1] + M[1][2]*v[2],
      M[2][0]*v[0] + M[2][1]*v[1] + M[2][2]*v[2],
    ];
  }

  function xyzToArr(xyz) { return [xyz.X, xyz.Y, xyz.Z]; }
  function arrToXyz(a)   { return { X: a[0], Y: a[1], Z: a[2] }; }

  // ─── CAT02 핵심 함수 ───────────────────────────────────────────────

  /**
   * CAT02 크로마틱 어댑테이션: src 조명원 → dst 조명원
   * @param {{ X,Y,Z }} xyz   입력 XYZ (src 조명원 하)
   * @param {{ X,Y,Z }} wpSrc 입력 화이트 포인트
   * @param {{ X,Y,Z }} wpDst 출력 화이트 포인트
   * @returns {{ X,Y,Z }}     적응된 XYZ (dst 조명원 하)
   */
  function cat02(xyz, wpSrc, wpDst) {
    // LMS 계산
    const lmsSrc  = matVec(M_CAT02, xyzToArr(wpSrc));
    const lmsDst  = matVec(M_CAT02, xyzToArr(wpDst));
    const lmsIn   = matVec(M_CAT02, xyzToArr(xyz));

    // 스케일 (폰 크리스 가설)
    const scaled = [
      lmsIn[0] * (lmsDst[0] / lmsSrc[0]),
      lmsIn[1] * (lmsDst[1] / lmsSrc[1]),
      lmsIn[2] * (lmsDst[2] / lmsSrc[2]),
    ];

    return arrToXyz(matVec(M_CAT02_INV, scaled));
  }

  /**
   * Bradford 크로마틱 어댑테이션 (사진 색온도 보정용)
   */
  function bradford(xyz, wpSrc, wpDst) {
    const lmsSrc  = matVec(M_BRADFORD, xyzToArr(wpSrc));
    const lmsDst  = matVec(M_BRADFORD, xyzToArr(wpDst));
    const lmsIn   = matVec(M_BRADFORD, xyzToArr(xyz));
    const scaled = [
      lmsIn[0] * (lmsDst[0] / lmsSrc[0]),
      lmsIn[1] * (lmsDst[1] / lmsSrc[1]),
      lmsIn[2] * (lmsDst[2] / lmsSrc[2]),
    ];
    return arrToXyz(matVec(M_BRADFORD_INV, scaled));
  }

  // ─── 편의 함수 ────────────────────────────────────────────────────

  /**
   * XYZ_D65 → XYZ_C (먼셀 변환에 필수)
   * CAT02 사용
   */
  function D65toC(xyz) {
    return cat02(xyz, Illuminant.WP_D65, Illuminant.WP_C);
  }

  /**
   * XYZ_C → XYZ_D65 (먼셀 칩 → 화면 표시)
   * CAT02 사용
   */
  function CtoD65(xyz) {
    return cat02(xyz, Illuminant.WP_C, Illuminant.WP_D65);
  }

  /**
   * 임의 색온도(K) → D65 적응 (현장 사진 보정, Bradford)
   * @param {{ X,Y,Z }} xyz   촬영된 색의 XYZ (D65 공간)
   * @param {number}    K     촬영 당시 조명 색온도 (켈빈)
   * @returns {{ X,Y,Z }}     D65로 보정된 XYZ
   */
  function fieldLightingToD65(xyz, K) {
    const wpField = kelvinToXYZ(K);
    return bradford(xyz, wpField, Illuminant.WP_D65);
  }

  // ─── 켈빈 → 화이트 포인트 ─────────────────────────────────────────
  /**
   * 색온도 K → 근사 CIE xyY 화이트 포인트
   * Kang et al. (2002) 근사식
   */
  function kelvinToXYZ(K) {
    let x, y;
    if (K >= 1667 && K <= 4000) {
      x = -0.2661239e9 / K**3 - 0.2343580e6 / K**2 + 0.8776956e3 / K + 0.179910;
    } else if (K <= 25000) {
      x = -3.0258469e9 / K**3 + 2.1070379e6 / K**2 + 0.2226347e3 / K + 0.240390;
    } else {
      x = 0.3;
    }

    if (K >= 1667 && K <= 2222) {
      y = -1.1063814*x**3 - 1.34811020*x**2 + 2.18555832*x - 0.20219683;
    } else if (K <= 4000) {
      y = -0.9549476*x**3 - 1.37418593*x**2 + 2.09137015*x - 0.16748867;
    } else {
      y = 3.0817580*x**3 - 5.87338670*x**2 + 3.75112997*x - 0.37001483;
    }

    return Illuminant.xyYtoXYZ(x, y, 1.0);
  }

  // ─── 고속 보정 경로: 결합 행렬 + 감마 LUT ────────────────────────
  //
  // 픽셀마다 sRGB→XYZ→Bradford→XYZ→sRGB를 수행하면 pow 호출이 병목이
  // 된다. 변환 전체가 선형(linear RGB 기준)이므로 하나의 3×3 행렬로
  // 합치고, 감마 인/디코딩은 LUT로 대체한다.
  //
  //   M = M_XYZ→RGB · Bradford(wpSrc→D65) · M_RGB→XYZ   (linear→linear)
  //
  // 결과는 correctPixelForField와 반올림 오차(±1/255) 내에서 동일해야
  // 한다 (fixtures/correction_equiv_test.html에서 검증).

  // sRGB ↔ XYZ (D65) 행렬 — illuminant.js와 동일한 IEC 61966-2-1 계수
  const M_RGB2XYZ = [
    [0.4124564, 0.3575761, 0.1804375],
    [0.2126729, 0.7151522, 0.0721750],
    [0.0193339, 0.1191920, 0.9503041],
  ];
  const M_XYZ2RGB = [
    [ 3.2404542, -1.5371385, -0.4985314],
    [-0.9692660,  1.8760108,  0.0415560],
    [ 0.0556434, -0.2040259,  1.0572252],
  ];

  function matMul(A, B) {
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        C[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
    return C;
  }

  /**
   * wpSrc(촬영 광원 화이트포인트) → D65 보정의 linearRGB→linearRGB 결합 행렬
   * @param {{ X,Y,Z }} wpSrc
   * @returns {number[][]} 3×3
   */
  function buildCorrectionMatrix(wpSrc) {
    const lmsSrc = matVec(M_BRADFORD, xyzToArr(wpSrc));
    const lmsDst = matVec(M_BRADFORD, xyzToArr(Illuminant.WP_D65));
    const D = [
      [lmsDst[0] / lmsSrc[0], 0, 0],
      [0, lmsDst[1] / lmsSrc[1], 0],
      [0, 0, lmsDst[2] / lmsSrc[2]],
    ];
    // XYZ→RGB · B⁻¹ · D · B · RGB→XYZ
    return matMul(M_XYZ2RGB, matMul(M_BRADFORD_INV, matMul(D, matMul(M_BRADFORD, M_RGB2XYZ))));
  }

  // 감마 LUT (지연 생성, 재사용)
  let _decodeLUT = null;   // sRGB 0–255 → linear [0,1]
  let _encodeLUT = null;   // linear [0,1]×65535 → sRGB 0–255

  function _buildGammaLUTs() {
    _decodeLUT = new Float32Array(256);
    for (let i = 0; i < 256; i++) _decodeLUT[i] = Illuminant.sRGBtoLinear(i / 255);

    _encodeLUT = new Uint8ClampedArray(65536);
    for (let i = 0; i < 65536; i++) {
      _encodeLUT[i] = Math.round(Illuminant.linearToSRGB(i / 65535) * 255);
    }
  }

  /**
   * ImageData 전체를 wpSrc → D65로 보정 (고속 경로)
   * @param {ImageData}  imageData
   * @param {{ X,Y,Z }}  wpSrc  촬영 광원 화이트포인트
   * @returns {ImageData} 새 ImageData (원본 불변)
   */
  function correctImageDataToD65(imageData, wpSrc) {
    if (!_decodeLUT) _buildGammaLUTs();
    const M = buildCorrectionMatrix(wpSrc);
    const m00 = M[0][0], m01 = M[0][1], m02 = M[0][2];
    const m10 = M[1][0], m11 = M[1][1], m12 = M[1][2];
    const m20 = M[2][0], m21 = M[2][1], m22 = M[2][2];

    const src = imageData.data;
    const out = new Uint8ClampedArray(src.length);
    const dec = _decodeLUT, enc = _encodeLUT;

    for (let i = 0; i < src.length; i += 4) {
      const r = dec[src[i]], g = dec[src[i + 1]], b = dec[src[i + 2]];
      let rn = m00 * r + m01 * g + m02 * b;
      let gn = m10 * r + m11 * g + m12 * b;
      let bn = m20 * r + m21 * g + m22 * b;
      // clamp [0,1] 후 LUT 인덱싱
      rn = rn < 0 ? 0 : rn > 1 ? 1 : rn;
      gn = gn < 0 ? 0 : gn > 1 ? 1 : gn;
      bn = bn < 0 ? 0 : bn > 1 ? 1 : bn;
      out[i]     = enc[(rn * 65535 + 0.5) | 0];
      out[i + 1] = enc[(gn * 65535 + 0.5) | 0];
      out[i + 2] = enc[(bn * 65535 + 0.5) | 0];
      out[i + 3] = src[i + 3];
    }
    return new ImageData(out, imageData.width, imageData.height);
  }

  // ─── sRGB255 픽셀 현장 보정 (캔버스 preview용) ──────────────────

  /**
   * sRGB255 픽셀을 현장 조명에서 D65로 보정
   * @param {number} r,g,b  원본 픽셀 [0–255]
   * @param {number} K      촬영 조명 색온도 (켈빈)
   * @returns {{ r, g, b }} 보정된 sRGB [0–255]
   */
  function correctPixelForField(r, g, b, K) {
    if (Math.abs(K - 6504) < 50) return { r, g, b };
    const xyz     = Illuminant.sRGB255toXYZ_D65(r, g, b);
    const adapted = fieldLightingToD65(xyz, K);
    return Illuminant.XYZ_D65tosRGB255(adapted.X, adapted.Y, adapted.Z);
  }

  /**
   * ImageData 전체 픽셀 현장 보정 (고속 경로에 위임)
   */
  function correctImageDataForField(imageData, K) {
    if (Math.abs(K - 6504) < 50) return imageData;
    return correctImageDataToD65(imageData, kelvinToXYZ(K));
  }

  // ─── Exports ──────────────────────────────────────────────────────
  return {
    // Core CAT
    cat02, bradford,
    // Munsell-specific
    D65toC, CtoD65,
    // Field correction
    fieldLightingToD65, kelvinToXYZ,
    correctPixelForField, correctImageDataForField,
    buildCorrectionMatrix, correctImageDataToD65,
    // Matrices (for testing)
    M_CAT02, M_CAT02_INV, M_BRADFORD, M_BRADFORD_INV,
  };
})();
