/**
 * munsellConvert.js
 * ─────────────────────────────────────────────────────────────────────
 * sRGB → 먼셀 색체계 변환 핵심 엔진 (올바른 파이프라인)
 *
 * ★ 파이프라인 (ASTM D1535 / colour-science 기준):
 *
 *   sRGB [0–255]
 *     → linearRGB [0–1]       (IEC 61966-2-1 companding)
 *     → XYZ_D65               (IEC sRGB → XYZ 행렬)
 *     → XYZ_C                 (CAT02: D65 → Illuminant C)
 *     → xyY_C                 (Munsell Renotation 기준 공간)
 *     → Munsell HVC           (munsell.js 1차, LUT ΔE2000 2차)
 *
 * ★ 필수 조건 (ASTM D1535):
 *   - 불투명 물체 (translucent 불가)
 *   - CIE 1931 2° 표준 관찰자
 *   - Illuminant C (먼셀 정의 기준)
 *   - 정상 색각
 *
 * ★ 주의: Illuminant C ≠ D65
 *   먼셀 Renotation(1943)의 모든 xyY 값은 Illuminant C 기준.
 *   D65로 직접 변환하면 체계적 오차 발생.
 *
 * 참고:
 *   - Newhall, Nickerson & Judd (1943) Renotation
 *   - colour-science: colour.munsell_colour_to_xyY()
 *   - AQP: col2Munsell(), getClosestMunsellChip()
 *   - privet-kitty/munsell.js (CDN, munsellToRgb255 등)
 * ─────────────────────────────────────────────────────────────────────
 */

class MunsellConvert {
  constructor(chipDatabase) {
    this.chips    = chipDatabase;   // NearestChip 검색용 LUT
    this.libReady = false;
    this._initLib();
  }

  // ─── Public API ─────────────────────────────────────────────────

  /**
   * sRGB [0–255] → 먼셀 분석 결과
   *
   * @param {number} r, g, b  sRGB (0–255), 이미 현장 조명 보정 완료된 값
   * @returns {MunsellResult}
   */
  analyze(r, g, b) {
    const hex  = this._toHex(r, g, b);
    const pipe = this._sRGBtoPipeline(r, g, b);

    // 1차: munsell.js (xyY → Munsell, 보간 포함)
    let code, fromLib;
    if (this.libReady) {
      const result = this._libConvert(pipe.xyY_C);
      if (result) { code = result; fromLib = true; }
    }

    // 2차: LUT ΔE2000 검색
    const candidates = NearestChip.findNearest(pipe.lab_C, this.chips);
    if (!code) {
      code     = candidates[0].code;
      fromLib  = false;
    }

    const parsed = this._parseCode(code);
    const chipHex = this._codeToHex(code);

    // best candidate에 munsell.js 결과 반영
    if (fromLib) {
      candidates[0] = {
        ...candidates[0],
        code,
        hex: chipHex,
        from: 'munsell.js',
      };
    }

    const bestDe  = candidates[0].dE;
    const acc     = NearestChip.accuracy(bestDe);

    return {
      // 먼셀 코드
      code,
      hue:       parsed.hue,
      value:     parsed.value,
      chroma:    parsed.chroma,
      isNeutral: parsed.isNeutral,

      // 디스플레이
      hex,
      chipHex,
      deltaE:   bestDe,
      accuracy: acc,

      // 한국어 설명
      korName:   this._korName(parsed),
      soilClass: this._soilClass(parsed),

      // 파이프라인 중간값 (디버그/참고용)
      pipeline: {
        lab_D65:  pipe.lab_D65,
        xyz_C:    pipe.xyz_C,
        xyY_C:    pipe.xyY_C,
        lab_C:    pipe.lab_C,
      },

      // Top-N 후보
      candidates,
      fromLib,
      rgb: { r, g, b },
    };
  }

  /**
   * 먼셀 코드 → sRGB HEX
   * munsell.js 우선, 없으면 LUT 폴백
   */
  _codeToHex(code) {
    if (this.libReady) {
      try {
        const [r, g, b] = munsell.munsellToRgb255(code);
        return this._toHex(r, g, b);
      } catch {}
    }
    const chip = this.chips.find(c => c.code === code);
    return chip?.hex ?? '#808080';
  }

  // ─── 파이프라인 ─────────────────────────────────────────────────

  /**
   * sRGB → 변환 파이프라인의 모든 중간값 계산
   */
  _sRGBtoPipeline(r, g, b) {
    // Step 1–2: sRGB → XYZ_D65
    const xyz_D65 = Illuminant.sRGB255toXYZ_D65(r, g, b);

    // Step 3: Lab_D65 (참고용)
    const lab_D65 = Illuminant.XYZtoLab(xyz_D65, Illuminant.WP_D65);

    // Step 4: XYZ_D65 → XYZ_C (CAT02)
    const xyz_C = ChromAdapt.D65toC(xyz_D65);

    // Step 5: XYZ_C → xyY_C
    const xyY_C = Illuminant.XYZtoxyY(xyz_C.X, xyz_C.Y, xyz_C.Z);

    // Step 6: XYZ_C → Lab_C (Illuminant C 기준)
    const lab_C = Illuminant.XYZtoLab(xyz_C, Illuminant.WP_C);

    return { xyz_D65, lab_D65, xyz_C, xyY_C, lab_C };
  }

  // ─── munsell.js 연동 ─────────────────────────────────────────────

  _initLib() {
    const check = () => {
      if (typeof munsell !== 'undefined') {
        this.libReady = true;
        console.info('[MunsellConvert] munsell.js 준비 완료');
        this._detectLibAPI();
      } else {
        setTimeout(check, 200);
      }
    };
    check();
  }

  _detectLibAPI() {
    // munsell.js의 실제 API를 탐지
    const exports = Object.keys(munsell);
    this._libFns = {
      toRgb255:   typeof munsell.munsellToRgb255 === 'function',
      toXYZ:      typeof munsell.munsellToXyz === 'function',
      xyYToCode:  typeof munsell.xyYToMunsell === 'function',
    };
    console.info('[MunsellConvert] munsell.js exports:', exports.slice(0, 10));
    console.info('[MunsellConvert] 사용 가능한 함수:', this._libFns);
  }

  /**
   * xyY_C → 먼셀 코드 (munsell.js 경유)
   * munsell.js는 내부적으로 Illuminant C xyY 공간에서 동작
   */
  _libConvert(xyY_C) {
    try {
      // xyY_C를 munsell.js의 기대 형식으로 전달
      // 라이브러리 버전에 따라 API 다름 — 여러 시도
      const { x, y, Y } = xyY_C;

      if (this._libFns?.xyYToCode) {
        // privet-kitty/munsell: xyYToMunsell 또는 유사 함수
        const result = munsell.xyYToMunsell(x, y, Y);
        if (result) return typeof result === 'string' ? result : result.code;
      }

      // 일부 버전: munsell 네임스페이스의 다른 진입점 시도
      if (typeof munsell.xyYToMunsellHVC === 'function') {
        const hvc = munsell.xyYToMunsellHVC(x, y, Y);
        if (hvc) return `${hvc.hue} ${hvc.value}/${hvc.chroma}`;
      }

      return null;  // 폴백으로 LUT 사용
    } catch (e) {
      return null;
    }
  }

  // ─── 파싱 ────────────────────────────────────────────────────────

  _parseCode(code) {
    if (!code) return { hue: 'N', value: 5, chroma: 0, isNeutral: true };

    const neutralM = code.match(/^N\s*([0-9.]+)\/?$/i);
    if (neutralM) {
      return { hue: 'N', value: parseFloat(neutralM[1]), chroma: 0, isNeutral: true };
    }

    const chromM = code.match(/^([0-9.]+[A-Z]+)\s+([0-9.]+)\/([0-9.]*)$/i);
    if (chromM) {
      return {
        hue:      chromM[1].toUpperCase(),
        value:    parseFloat(chromM[2]),
        chroma:   parseFloat(chromM[3] || '0'),
        isNeutral: false,
      };
    }
    return { hue: 'N', value: 5, chroma: 0, isNeutral: true };
  }

  _toHex(r, g, b) {
    return '#' + [r, g, b]
      .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('');
  }

  // ─── 한국어 토색 설명 ────────────────────────────────────────────

  _korName({ hue, value, chroma, isNeutral }) {
    if (isNeutral) {
      if (value <= 2) return '흑색 (Black)';
      if (value <= 4) return '암회색 (Dark Gray)';
      if (value <= 6) return '회색 (Gray)';
      if (value <= 8) return '밝은 회색 (Light Gray)';
      return '흰색 (White)';
    }
    const g = hue.replace(/^[0-9.]+/, '');
    const v = value <= 2 ? '매우 어두운 ' : value <= 3 ? '어두운 ' : value <= 5 ? '' : value <= 7 ? '밝은 ' : '매우 밝은 ';
    const c = chroma <= 1 ? '극히 탁한 ' : chroma <= 2 ? '탁한 ' : chroma >= 8 ? '선명한 ' : '';

    if (g === 'YR') {
      if (value <= 3 && chroma <= 2) return `${v}암갈색`;
      if (value <= 3)                return `${v}어두운 갈색`;
      if (chroma <= 2)               return `${v}회갈색`;
      if (chroma <= 4)               return `${v}갈색`;
      if (chroma <= 6)               return `${v}황갈색`;
      return                                `${v}강황갈색`;
    }
    if (g === 'R')  { return chroma >= 4 ? `${v}적색` : `${v}적갈색`; }
    if (g === 'Y')  { return chroma <= 2 ? `${v}회황색` : `${v}황색`; }
    if (g === 'GY') { return `${v}황녹색`; }
    if (g === 'G')  { return `${v}녹색`; }
    if (g === 'BG') { return `${v}청록색`; }
    if (g === 'B')  { return `${v}청색`; }
    if (g === 'PB') { return `${v}청자색`; }
    if (g === 'P')  { return `${v}자색`; }
    if (g === 'RP') { return `${v}적자색`; }
    return `${v}${c}색`;
  }

  _soilClass({ hue, value, chroma, isNeutral }) {
    if (isNeutral) {
      if (value <= 2) return { class: 'black',    label: '흑색토',   en: 'Black Soil' };
      if (value <= 4) return { class: 'darkgray', label: '암회색토', en: 'Dark Gray Soil' };
      return               { class: 'gray',      label: '회색토',   en: 'Gray Soil' };
    }
    const g = hue.replace(/^[0-9.]+/, '');
    if (g === 'R') {
      if (value <= 4 && chroma >= 4) return { class: 'reddish',   label: '적갈색토', en: 'Reddish Brown' };
      return                                { class: 'red',       label: '적색토',   en: 'Red Soil' };
    }
    if (g === 'YR') {
      if (value <= 3 && chroma <= 2) return { class: 'darkbrown', label: '암갈색토', en: 'Dark Brown Soil' };
      if (value <= 4)                return { class: 'brown',     label: '갈색토',   en: 'Brown Soil' };
      if (chroma <= 3)               return { class: 'graybrown', label: '회갈색토', en: 'Grayish Brown' };
      return                                { class: 'yellbrown', label: '황갈색토', en: 'Yellowish Brown' };
    }
    if (g === 'Y') {
      if (value <= 5) return { class: 'oliveyell', label: '올리브황색토', en: 'Olive Yellow' };
      return               { class: 'yellow',    label: '황색토',      en: 'Yellow Soil' };
    }
    if (g === 'GY' || g === 'G') return { class: 'olive',    label: '올리브색토', en: 'Olive Soil' };
    if (g === 'B'  || g === 'BG') return { class: 'grayblue', label: '청회색토',  en: 'Grayish Blue' };
    return { class: 'other', label: '기타', en: 'Other' };
  }
}
