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
   * ImageData 전체 픽셀 현장 보정
   */
  function correctImageDataForField(imageData, K) {
    if (Math.abs(K - 6504) < 50) return imageData;
    const data = new Uint8ClampedArray(imageData.data);
    for (let i = 0; i < data.length; i += 4) {
      const { r, g, b } = correctPixelForField(data[i], data[i+1], data[i+2], K);
      data[i] = r; data[i+1] = g; data[i+2] = b;
    }
    return new ImageData(data, imageData.width, imageData.height);
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
    // Matrices (for testing)
    M_CAT02, M_CAT02_INV, M_BRADFORD, M_BRADFORD_INV,
  };
})();
