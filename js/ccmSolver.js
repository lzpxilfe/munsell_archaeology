/**
 * ccmSolver.js
 * ─────────────────────────────────────────────────────────────────────
 * 6-Patch Color Correction Matrix (CCM) Least-Squares Solver
 *
 * 역할:
 *   스마트폰 카메라가 촬영한 6가지 참조 패치(White, Gray, Black, Red, Green, Blue)의
 *   sRGB 입력값을 표준 D65 linear sRGB 공간의 참조값으로 매핑하는 3x3 선형 보정 행렬을
 *   최소자승법(Least-Squares Regression)으로 해결합니다.
 * ─────────────────────────────────────────────────────────────────────
 */

(function(global) {
  // sRGB 감마 언디코딩 (선형화)
  function srgbToLinear(c) {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  // 선형 RGB 감마 인코딩
  function linearToSrgb(v) {
    const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1/2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(c * 255)));
  }

  // 6가지 표준 패치 (White, Gray, Black, Red, Green, Blue)
  const REF_COLORS_SRGB = [
    [235, 235, 235], // 1. White (90% 반사율 근사)
    [118, 118, 118], // 2. Neutral Gray (18% 반사율)
    [35, 35, 35],    // 3. Black (3% 반사율)
    [190, 50, 45],   // 4. Red (어두운 토색 기준 보정에 좋은 적색 패치)
    [50, 140, 55],   // 5. Green
    [40, 70, 160],   // 6. Blue
  ];

  const REF_COLORS_LINEAR = REF_COLORS_SRGB.map(rgb => rgb.map(srgbToLinear));

  // 24가지 표준 맥베스 컬러체커 패치 (D65 기준 표준 sRGB 및 선형값)
  const MACBETH_COLORS_SRGB = [
    [115, 82, 68],    // 1. Dark Skin
    [194, 150, 130],  // 2. Light Skin
    [98, 122, 157],   // 3. Blue Sky
    [87, 108, 67],    // 4. Foliage
    [129, 128, 177],  // 5. Blue Flower
    [102, 189, 170],  // 6. Bluish Green
    [219, 116, 39],   // 7. Orange
    [70, 92, 167],    // 8. Purplish Blue
    [193, 84, 98],    // 9. Moderate Red
    [91, 58, 107],    // 10. Purple
    [157, 188, 64],   // 11. Yellow Green
    [224, 163, 46],   // 12. Orange Yellow
    [28, 54, 133],    // 13. Blue
    [65, 145, 91],    // 14. Green
    [166, 44, 52],    // 15. Red
    [238, 198, 20],   // 16. Yellow
    [187, 82, 149],   // 17. Magenta
    [8, 133, 161],    // 18. Cyan
    [242, 243, 245],  // 19. White 9.5
    [200, 202, 202],  // 20. Neutral 8.0
    [160, 162, 162],  // 21. Neutral 6.5
    [121, 122, 121],  // 22. Neutral 5.0
    [85, 85, 85],     // 23. Neutral 3.5
    [52, 52, 52]      // 24. Black 2.0
  ];

  const MACBETH_COLORS_LINEAR = MACBETH_COLORS_SRGB.map(rgb => rgb.map(srgbToLinear));

  // 행렬 연산 유틸리티
  function matMul_3xN_Nx3(A, B, N) {
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let sum = 0;
        for (let k = 0; k < N; k++) {
          sum += A[i][k] * B[k][j];
        }
        C[i][j] = sum;
      }
    }
    return C;
  }

  function matMul_3x3_3x3(A, B) {
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        C[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
      }
    }
    return C;
  }

  function transpose_3xN(A, N) {
    const B = [];
    for (let i = 0; i < N; i++) {
      B.push([A[0][i], A[1][i], A[2][i]]);
    }
    return B;
  }

  // 3x3 행렬식과 수반 행렬을 이용한 분석적 역행렬 계산 (Cramer's Rule)
  function invert3x3(A) {
    const det = A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
                A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
                A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
    
    if (Math.abs(det) < 1e-9) return null;
    const invdet = 1 / det;
    
    return [
      [
        (A[1][1] * A[2][2] - A[1][2] * A[2][1]) * invdet,
        (A[0][2] * A[2][1] - A[0][1] * A[2][2]) * invdet,
        (A[0][1] * A[1][2] - A[0][2] * A[1][1]) * invdet
      ],
      [
        (A[1][2] * A[2][0] - A[1][0] * A[2][2]) * invdet,
        (A[0][0] * A[2][2] - A[0][2] * A[2][0]) * invdet,
        (A[0][2] * A[1][0] - A[0][0] * A[1][2]) * invdet
      ],
      [
        (A[1][0] * A[2][1] - A[1][1] * A[2][0]) * invdet,
        (A[0][1] * A[2][0] - A[0][0] * A[2][1]) * invdet,
        (A[0][0] * A[1][1] - A[0][1] * A[1][0]) * invdet
      ]
    ];
  }

  /**
   * 카메라 샘플링 sRGB 값으로 3x3 CCM 도출
   * @param {number[][]} camRGBs - [[r, g, b]...] 배열 (크기 6 또는 24)
   * @param {string} targetType - '6patch' | 'macbeth'
   * @returns {number[][] | null} 3x3 보정 매트릭스 또는 null
   */
  function solveCCM(camRGBs, targetType = '6patch') {
    const isMacbeth = targetType === 'macbeth';
    const N = isMacbeth ? 24 : 6;
    if (camRGBs.length !== N) return null;

    // 카메라 샘플링값 선형화 후 3xN 행렬 구성
    const P_cam = [
      camRGBs.map(rgb => srgbToLinear(rgb[0])),
      camRGBs.map(rgb => srgbToLinear(rgb[1])),
      camRGBs.map(rgb => srgbToLinear(rgb[2])),
    ];

    // 표준 목표값 3xN 행렬 구성
    const refSource = isMacbeth ? MACBETH_COLORS_LINEAR : REF_COLORS_LINEAR;
    const P_ref = [
      refSource.map(rgb => rgb[0]),
      refSource.map(rgb => rgb[1]),
      refSource.map(rgb => rgb[2]),
    ];

    const P_cam_T = transpose_3xN(P_cam, N);

    // A = P_cam * P_cam_T (3x3)
    const A = matMul_3xN_Nx3(P_cam, P_cam_T, N);
    const A_inv = invert3x3(A);
    if (!A_inv) return null;

    // B = P_ref * P_cam_T (3x3)
    const B = matMul_3xN_Nx3(P_ref, P_cam_T, N);

    // M_CCM = B * A_inv (3x3)
    return matMul_3x3_3x3(B, A_inv);
  }

  /**
   * 3x3 CCM을 적용하여 선형 RGB 픽셀 보정
   * @param {number} r, g, b - 선형 RGB 성분 (0.0 - 1.0)
   * @param {number[][]} M - 3x3 CCM 행렬
   * @returns {number[]} 보정된 [r, g, b] (0.0 - 1.0)
   */
  function correctPixel(r, g, b, M) {
    const cr = M[0][0] * r + M[0][1] * g + M[0][2] * b;
    const cg = M[1][0] * r + M[1][1] * g + M[1][2] * b;
    const cb = M[2][0] * r + M[2][1] * g + M[2][2] * b;
    return [
      Math.max(0, Math.min(1.0, cr)),
      Math.max(0, Math.min(1.0, cg)),
      Math.max(0, Math.min(1.0, cb))
    ];
  }

  // 고속 이미지 변환용 LUT
  let decodeLUT = null;
  let encodeLUT = null;

  function buildLUTs() {
    decodeLUT = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const v = i / 255;
      decodeLUT[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    encodeLUT = new Uint8Array(65536);
    for (let i = 0; i < 65536; i++) {
      const v = i / 65535;
      const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1/2.4) - 0.055;
      encodeLUT[i] = Math.max(0, Math.min(255, Math.round(c * 255)));
    }
  }

  /**
   * ImageData 전체를 CCM 보정 및 비네팅 제거 (LUT 최적화 고속 경로)
   * @param {ImageData} imageData
   * @param {number[][] | null} M - 3x3 CCM 행렬 (null 일 경우 항등행렬 처리하여 비네팅만 보정 가능)
   * @param {number} vignetteAlpha - 비네팅 반경 이득 강도 (0.0 ~ 0.5)
   * @returns {ImageData} 보정된 새 ImageData
   */
  function correctImageData(imageData, M, vignetteAlpha = 0) {
    if (!decodeLUT) buildLUTs();
    const src = imageData.data;
    const out = new Uint8ClampedArray(src.length);
    
    const m00 = M ? M[0][0] : 1, m01 = M ? M[0][1] : 0, m02 = M ? M[0][2] : 0;
    const m10 = M ? M[1][0] : 0, m11 = M ? M[1][1] : 1, m12 = M ? M[1][2] : 0;
    const m20 = M ? M[2][0] : 0, m21 = M ? M[2][1] : 0, m22 = M ? M[2][2] : 1;

    const dec = decodeLUT;
    const enc = encodeLUT;

    const width = imageData.width;
    const height = imageData.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDistSq = centerX * centerX + centerY * centerY;

    for (let y = 0; y < height; y++) {
      const dy = y - centerY;
      const dySq = dy * dy;
      const rowOffset = y * width * 4;
      
      for (let x = 0; x < width; x++) {
        const i = rowOffset + x * 4;
        
        let r = dec[src[i]];
        let g = dec[src[i + 1]];
        let b = dec[src[i + 2]];

        // 비네팅 주변부 광량 감소 보정 (Radial Gain)
        if (vignetteAlpha > 0) {
          const dx = x - centerX;
          const distSq = dx * dx + dySq;
          const gain = 1 + vignetteAlpha * (distSq / maxDistSq);
          r = r * gain;
          g = g * gain;
          b = b * gain;
        }

        let cr = m00 * r + m01 * g + m02 * b;
        let cg = m10 * r + m11 * g + m12 * b;
        let cb = m20 * r + m21 * g + m22 * b;

        cr = cr < 0 ? 0 : cr > 1 ? 1 : cr;
        cg = cg < 0 ? 0 : cg > 1 ? 1 : cg;
        cb = cb < 0 ? 0 : cb > 1 ? 1 : cb;

        out[i]     = enc[(cr * 65535 + 0.5) | 0];
        out[i + 1] = enc[(cg * 65535 + 0.5) | 0];
        out[i + 2] = enc[(cb * 65535 + 0.5) | 0];
        out[i + 3] = src[i + 3];
      }
    }
    return new ImageData(out, width, height);
  }

  const CCMSolver = {
    REF_COLORS_SRGB,
    REF_COLORS_LINEAR,
    MACBETH_COLORS_SRGB,
    MACBETH_COLORS_LINEAR,
    srgbToLinear,
    linearToSrgb,
    solve: solveCCM,
    correctPixel,
    correctImageData
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CCMSolver;
  } else {
    global.CCMSolver = CCMSolver;
  }
})(this);
