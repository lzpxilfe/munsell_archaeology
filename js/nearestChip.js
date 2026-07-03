/**
 * nearestChip.js
 * ─────────────────────────────────────────────────────────────────────
 * ΔE2000 기반 Nearest Munsell Chip 검색
 *
 * 방법:
 *   - AQP/NCSS col2Munsell 방식 (getClosestMunsellChip) 참고
 *   - CIEDE2000 (dE00) — 지각적으로 가장 정확한 색차 공식
 *   - 등가 임계값: dE00 < 2.15 (AQP 기준, 0.001 유의수준)
 *
 * 입력 공간: CIE L*a*b* under Illuminant C
 * (먼셀 Renotation 기준 조명원과 일치)
 *
 * 참고:
 *   - Sharma, G. et al. (2005). "The CIEDE2000 Color-Difference Formula"
 *   - NCSS-Tech aqp: getClosestMunsellChip(), col2Munsell()
 * ─────────────────────────────────────────────────────────────────────
 */

const NearestChip = (() => {

  /**
   * CIEDE2000 색차 계산
   * Sharma et al. 2005 논문 공식 완전 구현
   * @param {{ L, a, b }} lab1
   * @param {{ L, a, b }} lab2
   * @returns {number}  dE00 (낮을수록 색이 비슷함)
   */
  function deltaE2000(lab1, lab2) {
    const { L: L1, a: a1, b: b1 } = lab1;
    const { L: L2, a: a2, b: b2 } = lab2;

    const k_L = 1, k_C = 1, k_H = 1;

    // Step 1: C*ab
    const C1 = Math.sqrt(a1**2 + b1**2);
    const C2 = Math.sqrt(a2**2 + b2**2);

    // Step 2: a' (C*ab 평균 기반 보정)
    const Cb = (C1 + C2) / 2;
    const Cb7 = Cb ** 7;
    const G = 0.5 * (1 - Math.sqrt(Cb7 / (Cb7 + 25**7)));
    const a1p = a1 * (1 + G);
    const a2p = a2 * (1 + G);

    // Step 3: C', h'
    const C1p = Math.sqrt(a1p**2 + b1**2);
    const C2p = Math.sqrt(a2p**2 + b2**2);
    const h1p = (Math.atan2(b1, a1p) * 180 / Math.PI + 360) % 360;
    const h2p = (Math.atan2(b2, a2p) * 180 / Math.PI + 360) % 360;

    // Step 4: ΔL', ΔC', Δh'
    const dLp = L2 - L1;
    const dCp = C2p - C1p;

    let dhp;
    if (C1p * C2p === 0)         dhp = 0;
    else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
    else if (h2p - h1p > 180)   dhp = h2p - h1p - 360;
    else                          dhp = h2p - h1p + 360;

    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * Math.PI / 180);

    // Step 5: 가중치 함수
    const Lbp = (L1 + L2) / 2;
    const Cbp = (C1p + C2p) / 2;

    let Hbp;
    if (C1p * C2p === 0)            Hbp = h1p + h2p;
    else if (Math.abs(h1p - h2p) <= 180) Hbp = (h1p + h2p) / 2;
    else if (h1p + h2p < 360)       Hbp = (h1p + h2p + 360) / 2;
    else                              Hbp = (h1p + h2p - 360) / 2;

    const T = 1
      - 0.17 * Math.cos((Hbp - 30) * Math.PI / 180)
      + 0.24 * Math.cos(2 * Hbp * Math.PI / 180)
      + 0.32 * Math.cos((3 * Hbp + 6) * Math.PI / 180)
      - 0.20 * Math.cos((4 * Hbp - 63) * Math.PI / 180);

    const S_L = 1 + 0.015 * (Lbp - 50)**2 / Math.sqrt(20 + (Lbp - 50)**2);
    const S_C = 1 + 0.045 * Cbp;
    const S_H = 1 + 0.015 * Cbp * T;

    const Cbp7 = Cbp ** 7;
    const R_T = -2 * Math.sqrt(Cbp7 / (Cbp7 + 25**7))
      * Math.sin(60 * Math.exp(-((Hbp - 275) / 25)**2) * Math.PI / 180);

    return Math.sqrt(
      (dLp  / (k_L * S_L))**2 +
      (dCp  / (k_C * S_C))**2 +
      (dHp  / (k_H * S_H))**2 +
      R_T * (dCp / (k_C * S_C)) * (dHp / (k_H * S_H))
    );
  }

  /**
   * 등가 임계값: 이 이하이면 지각적으로 동일한 칩으로 간주
   * (AQP: 0.001 유의수준)
   */
  const EQUIVALENCE_THRESHOLD = 2.15;

  /**
   * Lab_C 값으로부터 가장 가까운 N개의 Munsell 칩을 반환
   * @param {{ L, a, b }} labC  Illuminant C 기준 L*a*b*
   * @param {Array}       chips  칩 데이터베이스 (각 항목에 .labC 필드 필요)
   * @param {number}      n      반환할 칩 개수
   * @returns {Array}  [{ code, hex, dE, sigma, hue, value, chroma, equivalent }]
   */
  function findNearest(labC, chips, n = 5) {
    const scored = chips.map(chip => ({
      ...chip,
      dE: deltaE2000(labC, chip.labC),
    }));

    scored.sort((a, b) => a.dE - b.dE);
    const top = scored.slice(0, n);

    // sigma: best dE가 낮을수록 확신도 높음
    const bestDe = top[0]?.dE ?? 99;

    return top.map((chip, i) => ({
      code:       chip.code,
      hex:        chip.hex,
      hue:        chip.hue,
      value:      chip.value,
      chroma:     chip.chroma,
      dE:         Math.round(chip.dE * 100) / 100,
      sigma:      chip.dE,         // raw dE00 (AQP 기준 "sigma")
      rank:       i + 1,
      equivalent: chip.dE <= EQUIVALENCE_THRESHOLD,  // 지각적 등가
    }));
  }

  /**
   * 정확도 레이블 (dE00 기준)
   * @param {number} dE
   * @returns {{ level, label, cls }}
   */
  function accuracy(dE) {
    if (dE < 1.0)  return { level: 'perfect', label: '일치',   cls: 'perfect', icon: '◉' };
    if (dE < 2.15) return { level: 'equiv',   label: '등가',   cls: 'good',    icon: '●' };
    if (dE < 3.5)  return { level: 'close',   label: '근접',   cls: 'fair',    icon: '○' };
    if (dE < 6.0)  return { level: 'approx',  label: '근사',   cls: 'warn',    icon: '◌' };
    return               { level: 'rough',   label: '참고용', cls: 'poor',    icon: '△' };
  }

  return { deltaE2000, findNearest, accuracy, EQUIVALENCE_THRESHOLD };
})();
