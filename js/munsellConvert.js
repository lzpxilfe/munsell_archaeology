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

    // 1차: munsell.js (XYZ → Munsell HVC, renotation 보간)
    let code, codePrecise = null, fromLib = false;
    if (this.libReady) {
      const lib = this._libConvert(pipe);
      if (lib) { code = lib.code; codePrecise = lib.precise; fromLib = true; }
    }

    // 2차: LUT ΔE2000 검색 (폴백 + Top-N 후보 목록)
    let candidates = NearestChip.findNearest(pipe.lab_C, this.chips);
    if (!code) code = candidates[0].code;

    const parsed = this._parseCode(code);
    const chipHex = this._codeToHex(code);

    // munsell.js 결과를 1순위 후보로 삽입
    // dE00은 해당 칩의 Lab_C 기준으로 재계산 (LUT 최근접 칩과 다를 수 있음)
    if (fromLib) {
      const labChip = this._codeToLabC(code);
      const dE = labChip
        ? NearestChip.deltaE2000(pipe.lab_C, labChip)
        : candidates[0].dE;
      const libCand = {
        code,
        hex:        chipHex,
        hue:        parsed.hue,
        value:      parsed.value,
        chroma:     parsed.chroma,
        dE:         Math.round(dE * 100) / 100,
        sigma:      dE,
        equivalent: dE <= NearestChip.EQUIVALENCE_THRESHOLD,
        from:       'munsell.js',
      };
      candidates = [libCand, ...candidates.filter(c => c.code !== code)]
        .slice(0, 5)
        .map((c, i) => ({ ...c, rank: i + 1 }));
    }

    const bestDe  = candidates[0].dE;
    const acc     = NearestChip.accuracy(bestDe);

    return {
      // 먼셀 코드
      code,                    // 토색첩 표기로 반올림된 코드 (예: '10YR 4/3')
      codePrecise,             // munsell.js 연속값 (예: '9.8YR 4.1/3.2', 폴백 시 null)
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
    // privet-kitty/munsell v1.1.x 실제 export 기준
    // (xyY 계열 함수는 존재하지 않음 — xyzToMhvc / mhvcToMunsell 사용)
    this._libFns = {
      xyzToMhvc:     typeof munsell.xyzToMhvc === 'function',
      mhvcToMunsell: typeof munsell.mhvcToMunsell === 'function',
      toRgb255:      typeof munsell.munsellToRgb255 === 'function',
      toLab:         typeof munsell.munsellToLab === 'function',
    };
    console.info('[MunsellConvert] 사용 가능한 함수:', this._libFns);
  }

  /**
   * XYZ → 먼셀 코드 (munsell.js 경유)
   *
   * munsell.js의 native 공간은 Illuminant C지만, XYZ_D65를 기본
   * illuminant(D65)로 넘기면 라이브러리가 자체 CAT 행렬로 C에 적응시킨다.
   * munsellToRgb255()의 역방향과 정확히 같은 행렬을 쓰므로
   * 왕복(먼셀 → sRGB → 먼셀) 일관성이 보장된다.
   * (pipe.xyz_C / lab_C의 CAT02 값은 LUT 검색·디버그 표시용으로 유지)
   *
   * @returns {{ code, precise, mhvc } | null}
   */
  _libConvert(pipe) {
    try {
      if (!this._libFns?.xyzToMhvc) return null;
      const { X, Y, Z } = pipe.xyz_D65;
      const [h100, v, c] = munsell.xyzToMhvc(X, Y, Z);   // 기본 illuminant = D65
      if (![h100, v, c].every(Number.isFinite)) return null;
      return {
        code:    this._snapMhvc(h100, v, c),
        precise: this._libFns.mhvcToMunsell ? munsell.mhvcToMunsell(h100, v, c, 1) : null,
        mhvc:    [h100, v, c],
      };
    } catch (e) {
      return null;  // 수렴 실패 등 → LUT 폴백
    }
  }

  /**
   * 연속 HVC → 토색첩(soil color chart) 표기 반올림
   *
   * munsell.js는 '8.7YR 3.9/3.4'처럼 연속값을 반환하지만, 실물 토색첩
   * 칩과 대조하는 현장 도구라는 목적상 표시·매칭에는 토색첩 규약을
   * 따른다:
   *   - hue:    2.5 단위 (2.5 / 5 / 7.5 / 10)
   *   - value:  정수 (1–9)
   *   - chroma: 정수 (최소 1, 0.5 미만이면 무채색 N)
   *
   * @param {number} h100  hue (0–100; R→YR→Y→GY→G→BG→B→PB→P→RP 순)
   * @param {number} v     value (0–10)
   * @param {number} c     chroma (0–)
   * @returns {string}  예: '10YR 4/3', 'N 5/'
   */
  _snapMhvc(h100, v, c) {
    const value = Math.min(9, Math.max(1, Math.round(v)));
    if (c < 0.5) return `N ${value}/`;

    const FAMILIES = ['R', 'YR', 'Y', 'GY', 'G', 'BG', 'B', 'PB', 'P', 'RP'];
    const h = ((h100 % 100) + 100) % 100;
    let idx = Math.floor(h / 10);
    let num = Math.round((h - idx * 10) / 2.5) * 2.5;
    if (num === 0) { num = 10; idx = (idx + 9) % 10; }

    const chroma = Math.max(1, Math.round(c));
    return `${num}${FAMILIES[idx]} ${value}/${chroma}`;
  }

  /**
   * 먼셀 코드 → Lab (Illuminant C)
   * munsell.js의 munsellToLab은 native 공간인 Illuminant C 기준 Lab을 반환
   */
  _codeToLabC(code) {
    if (this.libReady && this._libFns?.toLab) {
      try {
        const [L, a, b] = munsell.munsellToLab(code);
        return { L, a, b };
      } catch {}
    }
    const chip = this.chips.find(c => c.code === code);
    return chip?.labC ?? null;
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
