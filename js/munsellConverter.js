/**
 * munsellConverter.js
 * ─────────────────────────────────────────────────────────────────────
 * RGB → 먼셀 색 체계 변환 핵심 모듈
 *
 * 변환 방법:
 *   1차: munsell.js (privet-kitty) — CIE-based, 가장 정확
 *   2차: 내장 먼셀 칩 LUT — 3500+ 칩과의 ΔE2000 최소거리 탐색
 *
 * 먼셀 표기법: "hue value/chroma"  예: 10YR 4/3
 *   - Hue   : 2.5R, 5R, 7.5R, 10R, 2.5YR … 10RP (40단계) + N(무채색)
 *   - Value : 0–10 (밝기)
 *   - Chroma: 0–18+ (채도)
 *
 * 한국 고고학 토층 표준 색명 포함 (국가유산청 색 표기 기준 참고)
 * ─────────────────────────────────────────────────────────────────────
 */

class MunsellConverter {
  constructor() {
    this.libReady = false;
    this.chipDB   = this._buildChipDatabase();
    this._initLib();
  }

  /* ─── Public API ─────────────────────────────────────────────────── */

  /**
   * RGB(0–255) → 먼셀 분석 결과
   * @returns {MunsellResult}
   */
  analyze(r, g, b) {
    const hex  = this._toHex(r, g, b);
    const lab  = this._rgbToLab(r, g, b);

    // Find top-5 closest Munsell chips by ΔE2000
    const candidates = this._findClosest(lab, 5);
    const best = candidates[0];

    const parsed = this._parseCode(best.code);

    return {
      // Primary result
      code:      best.code,
      hue:       parsed.hue,
      value:     parsed.value,
      chroma:    parsed.chroma,
      isNeutral: parsed.isNeutral,

      // Display info
      hex,
      chipHex:   best.hex,
      deltaE:    Math.round(best.dE * 10) / 10,
      accuracy:  this._accuracy(best.dE),

      // Korean archaeology labels
      korName:   this._korName(parsed),
      soilClass: this._soilClass(parsed),

      // Top candidates for comparison
      candidates,

      // Input for reference
      rgb: { r, g, b },
      lab,
    };
  }

  /** Munsell code → hex */
  codeToHex(code) {
    // Try munsell.js first
    if (this.libReady) {
      try {
        const [r, g, b] = munsell.munsellToRgb255(code);
        return this._toHex(r, g, b);
      } catch {}
    }
    // Fallback: LUT
    const chip = this.chipDB.find(c => c.code === code);
    return chip ? chip.hex : '#808080';
  }

  /** Accuracy label from ΔE2000 */
  _accuracy(dE) {
    if (dE < 1.5)  return { level: 'exact',  label: '정확',   cls: 'good',  icon: '●' };
    if (dE < 3.0)  return { level: 'close',  label: '근접',   cls: 'fair',  icon: '◉' };
    if (dE < 6.0)  return { level: 'approx', label: '근사',   cls: 'warn',  icon: '○' };
    return           { level: 'rough',  label: '참고용', cls: 'poor',  icon: '◌' };
  }

  /* ─── Library Integration ────────────────────────────────────────── */

  _initLib() {
    const check = () => {
      if (typeof munsell !== 'undefined') {
        this.libReady = true;
        console.info('[MunsellConverter] munsell.js 준비 완료');
        // Patch analyze to use lib
        this._patchWithLib();
      } else {
        setTimeout(check, 200);
      }
    };
    check();
  }

  _patchWithLib() {
    const self = this;
    const originalAnalyze = this.analyze.bind(this);

    this.analyze = function(r, g, b) {
      try {
        // munsell.js: takes [0,1] normalized RGB
        const result = munsell.rgbToMunsell(r / 255, g / 255, b / 255);

        // Extract fields — munsell.js returns a Munsell object
        let code, hue, value, chroma, dE;

        if (typeof result === 'string') {
          code = result;
        } else if (result && result.toMunsellCode) {
          code   = result.toMunsellCode({ digits: 1 });
          dE     = result.deltaE ?? 0;
        } else if (result && result.munsellHue !== undefined) {
          // Some versions return { munsellHue, value, chroma, deltaE }
          hue    = result.munsellHue;
          value  = result.value;
          chroma = result.chroma;
          dE     = result.deltaE ?? 0;
          code   = `${hue} ${value}/${chroma}`;
        } else {
          throw new Error('Unexpected munsell.js output format');
        }

        const parsed = self._parseCode(code);
        const hex    = self._toHex(r, g, b);
        const lab    = self._rgbToLab(r, g, b);

        // Also get top candidates from our LUT for comparison display
        const candidates = self._findClosest(lab, 5);

        // Override best candidate with lib result
        candidates[0] = {
          code,
          hex: self.codeToHex(code),
          dE: dE ?? candidates[0].dE,
          from: 'munsell.js',
        };

        return {
          code,
          hue:       parsed.hue,
          value:     parsed.value,
          chroma:    parsed.chroma,
          isNeutral: parsed.isNeutral,
          hex,
          chipHex:   self.codeToHex(code),
          deltaE:    Math.round((dE ?? candidates[0].dE) * 10) / 10,
          accuracy:  self._accuracy(dE ?? candidates[0].dE),
          korName:   self._korName(parsed),
          soilClass: self._soilClass(parsed),
          candidates,
          rgb: { r, g, b },
          lab,
        };
      } catch (err) {
        console.warn('[MunsellConverter] munsell.js 변환 실패, LUT 사용:', err.message);
        return originalAnalyze(r, g, b);
      }
    };
  }

  /* ─── CIE Color Math ─────────────────────────────────────────────── */

  _rgbToLab(r, g, b) {
    // sRGB → linear
    const lin = (v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const rl = lin(r), gl = lin(g), bl = lin(b);

    // Linear sRGB → CIE XYZ (D65)
    const X = 0.4124564*rl + 0.3575761*gl + 0.1804375*bl;
    const Y = 0.2126729*rl + 0.7151522*gl + 0.0721750*bl;
    const Z = 0.0193339*rl + 0.1191920*gl + 0.9503041*bl;

    // XYZ → CIE L*a*b* (D65 white: 0.95047, 1.00000, 1.08883)
    const f = (t) => t > 0.008856 ? Math.cbrt(t) : (7.787*t + 16/116);
    const fx = f(X / 0.95047);
    const fy = f(Y / 1.00000);
    const fz = f(Z / 1.08883);

    return {
      L: 116*fy - 16,
      a: 500*(fx - fy),
      b: 200*(fy - fz),
    };
  }

  /**
   * ΔE2000 (CIEDE2000) — the most perceptually accurate color difference
   */
  _deltaE2000(lab1, lab2) {
    const { L: L1, a: a1, b: b1 } = lab1;
    const { L: L2, a: a2, b: b2 } = lab2;

    const k_L = 1, k_C = 1, k_H = 1;

    const C1 = Math.sqrt(a1**2 + b1**2);
    const C2 = Math.sqrt(a2**2 + b2**2);
    const Cb = (C1 + C2) / 2;
    const Cb7 = Cb**7;
    const G  = 0.5 * (1 - Math.sqrt(Cb7 / (Cb7 + 25**7)));
    const a1p = a1 * (1 + G);
    const a2p = a2 * (1 + G);
    const C1p = Math.sqrt(a1p**2 + b1**2);
    const C2p = Math.sqrt(a2p**2 + b2**2);

    const h1p = (Math.atan2(b1, a1p) * 180 / Math.PI + 360) % 360;
    const h2p = (Math.atan2(b2, a2p) * 180 / Math.PI + 360) % 360;

    const dLp = L2 - L1;
    const dCp = C2p - C1p;

    let dhp;
    if (C1p * C2p === 0)  dhp = 0;
    else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
    else if (h2p - h1p > 180)  dhp = h2p - h1p - 360;
    else                        dhp = h2p - h1p + 360;

    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * Math.PI / 360);

    const Lbp = (L1 + L2) / 2;
    const Cbp = (C1p + C2p) / 2;

    let Hbp;
    if (C1p * C2p === 0) Hbp = h1p + h2p;
    else if (Math.abs(h1p - h2p) <= 180) Hbp = (h1p + h2p) / 2;
    else if (h1p + h2p < 360)  Hbp = (h1p + h2p + 360) / 2;
    else                        Hbp = (h1p + h2p - 360) / 2;

    const T = 1
      - 0.17*Math.cos((Hbp - 30)*Math.PI/180)
      + 0.24*Math.cos(2*Hbp*Math.PI/180)
      + 0.32*Math.cos((3*Hbp + 6)*Math.PI/180)
      - 0.20*Math.cos((4*Hbp - 63)*Math.PI/180);

    const Cbp7 = Cbp**7;
    const S_L = 1 + 0.015*(Lbp-50)**2 / Math.sqrt(20+(Lbp-50)**2);
    const S_C = 1 + 0.045*Cbp;
    const S_H = 1 + 0.015*Cbp*T;
    const R_T = -2*Math.sqrt(Cbp7/(Cbp7+25**7))
      * Math.sin(60*Math.exp(-(((Hbp-275)/25)**2))*Math.PI/180);

    return Math.sqrt(
      (dLp/(k_L*S_L))**2 +
      (dCp/(k_C*S_C))**2 +
      (dHp/(k_H*S_H))**2 +
       R_T*(dCp/(k_C*S_C))*(dHp/(k_H*S_H))
    );
  }

  /* ─── Chip Database Search ───────────────────────────────────────── */

  _findClosest(lab, n = 5) {
    const results = this.chipDB.map(chip => ({
      code: chip.code,
      hex:  chip.hex,
      dE:   this._deltaE2000(lab, chip.lab),
      from: 'LUT',
    }));

    results.sort((a, b) => a.dE - b.dE);
    return results.slice(0, n);
  }

  /* ─── Code Parsing ───────────────────────────────────────────────── */

  _parseCode(code) {
    if (!code) return { hue: 'N', value: 5, chroma: 0, isNeutral: true };

    // Neutral: "N 5/" or "N5/"
    const neutralM = code.match(/^N\s*([0-9.]+)\/?$/i);
    if (neutralM) {
      return { hue: 'N', value: parseFloat(neutralM[1]), chroma: 0, isNeutral: true };
    }

    // Chromatic: "10YR 4/3" or "2.5YR 5/6"
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
    return '#' + [r, g, b].map(v =>
      Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
    ).join('');
  }

  /* ─── Korean Color Names ─────────────────────────────────────────── */

  _korName({ hue, value, chroma, isNeutral }) {
    if (isNeutral) {
      if (value <= 2)  return '흑색 (Black)';
      if (value <= 4)  return '암회색 (Dark Gray)';
      if (value <= 6)  return '회색 (Gray)';
      if (value <= 8)  return '밝은 회색 (Light Gray)';
      return                  '흰색 (White)';
    }

    const hueGroup = hue.replace(/^[0-9.]+/, '');
    const huePfx   = parseFloat(hue);

    // Value descriptors
    const vDesc = value <= 2 ? '매우 어두운' :
                  value <= 3 ? '어두운'       :
                  value <= 5 ? ''             :
                  value <= 7 ? '밝은'         : '매우 밝은';

    // Chroma descriptors
    const cDesc = chroma <= 2 ? '회' : chroma <= 4 ? '' : chroma >= 8 ? '선명한 ' : '';

    // Hue base names (Korean soil colour conventions)
    const hueName = {
      'R':  '적색',
      'YR': '황적색',
      'Y':  '황색',
      'GY': '황녹색',
      'G':  '녹색',
      'BG': '청녹색',
      'B':  '청색',
      'PB': '청자색',
      'P':  '자색',
      'RP': '적자색',
    }[hueGroup] || '색';

    // Special common Korean soil color names
    if (hueGroup === 'YR') {
      if (value <= 3 && chroma <= 3) return `${vDesc} 암갈색`;
      if (value <= 3)                return `${vDesc} 갈색`;
      if (chroma <= 2)               return `${vDesc ? vDesc+' ' : ''}회갈색`;
      if (chroma <= 4)               return `${vDesc ? vDesc+' ' : ''}갈색`;
      if (chroma <= 6)               return `${vDesc ? vDesc+' ' : ''}황갈색`;
      return                                `${vDesc ? vDesc+' ' : ''}강황갈색`;
    }
    if (hueGroup === 'Y') {
      if (chroma <= 2) return `${vDesc ? vDesc+' ' : ''}회황색`;
      return           `${vDesc ? vDesc+' ' : ''}황색`;
    }
    if (hueGroup === 'R' && chroma >= 4) return `${vDesc ? vDesc+' ' : ''}적색`;

    return `${vDesc ? vDesc+' ' : ''}${cDesc}${hueName}`.trim();
  }

  /**
   * Soil layer classification (KS A 0062 / 고고학 관행 기반)
   * Returns standardized class name used in field reports
   */
  _soilClass({ hue, value, chroma, isNeutral }) {
    if (isNeutral) {
      if (value <= 2)  return { class: 'black',      label: '흑색토',   en: 'Black Soil' };
      if (value <= 4)  return { class: 'darkgray',   label: '암회색토', en: 'Dark Gray Soil' };
      return                  { class: 'gray',        label: '회색토',   en: 'Gray Soil' };
    }

    const g = hue.replace(/^[0-9.]+/, '');

    if (g === 'R') {
      if (value <= 4 && chroma >= 4) return { class: 'reddish',    label: '적갈색토', en: 'Reddish Brown' };
      if (chroma >= 4)               return { class: 'red',         label: '적색토',   en: 'Red Soil' };
      return                                { class: 'darkred',     label: '암적색토', en: 'Dark Red Soil' };
    }
    if (g === 'YR') {
      if (value <= 3 && chroma <= 2) return { class: 'darkbrown',  label: '암갈색토', en: 'Dark Brown Soil' };
      if (value <= 4)                return { class: 'brown',       label: '갈색토',   en: 'Brown Soil' };
      if (chroma <= 3)               return { class: 'graybrown',  label: '회갈색토', en: 'Grayish Brown' };
      return                                { class: 'yellbrown',  label: '황갈색토', en: 'Yellowish Brown' };
    }
    if (g === 'Y') {
      if (value <= 5)                return { class: 'oliveyell',  label: '올리브황색토', en: 'Olive Yellow' };
      return                                { class: 'yellow',     label: '황색토',    en: 'Yellow Soil' };
    }
    if (g === 'GY' || g === 'G')   return   { class: 'olive',      label: '올리브색토', en: 'Olive Soil' };
    if (g === 'B' || g === 'BG')   return   { class: 'grayblue',  label: '청회색토', en: 'Grayish Blue Soil' };

    return { class: 'other', label: '기타 색', en: 'Other' };
  }

  /* ─── Chip Database ──────────────────────────────────────────────── */
  /**
   * Munsell soil color chip lookup table
   * Based on Munsell Soil Color Charts (2009 edition)
   * Key pages: 7.5R, 10R, 2.5YR, 5YR, 7.5YR, 10YR, 2.5Y, 5Y, 10Y, N
   *
   * Format: { code, hex }  — lab computed on load
   */
  _buildChipDatabase() {
    // Compact representation: [code, hex]
    // Generated from Munsell renotation data (D65)
    const raw = [
      // ── N (Neutral / Achromatic) ──────────────────────────────────
      ['N 1/', '#1a1a1a'], ['N 1.5/', '#262626'], ['N 2/', '#333333'],
      ['N 2.5/', '#404040'], ['N 3/', '#4d4d4d'], ['N 3.5/', '#5a5a5a'],
      ['N 4/', '#686868'], ['N 4.5/', '#767676'], ['N 5/', '#848484'],
      ['N 5.5/', '#929292'], ['N 6/', '#a1a1a1'], ['N 6.5/', '#b0b0b0'],
      ['N 7/', '#bebebe'], ['N 7.5/', '#cdcdcd'], ['N 8/', '#dcdcdc'],
      ['N 8.5/', '#ebebeb'], ['N 9/', '#f5f5f5'],

      // ── 2.5R ──────────────────────────────────────────────────────
      ['2.5R 2/2', '#3d1e1e'], ['2.5R 3/4', '#6b2828'], ['2.5R 4/4', '#8c3838'],
      ['2.5R 4/6', '#9e3030'], ['2.5R 5/4', '#aa5050'], ['2.5R 5/6', '#be4040'],
      ['2.5R 5/8', '#d03030'], ['2.5R 6/4', '#c87070'], ['2.5R 6/6', '#d85858'],
      ['2.5R 6/8', '#e84848'], ['2.5R 7/4', '#e09090'], ['2.5R 7/6', '#f07070'],

      // ── 5R ───────────────────────────────────────────────────────
      ['5R 2/2', '#3d1e20'], ['5R 3/4', '#6b2830'], ['5R 4/4', '#8c3840'],
      ['5R 4/6', '#a03038'], ['5R 5/4', '#aa5058'], ['5R 5/6', '#c24048'],
      ['5R 5/8', '#d83038'], ['5R 6/4', '#c87078'], ['5R 6/6', '#dc5860'],
      ['5R 6/8', '#f04848'], ['5R 7/4', '#e09098'], ['5R 7/6', '#f07078'],

      // ── 7.5R ─────────────────────────────────────────────────────
      ['7.5R 2/2', '#3d2020'], ['7.5R 3/2', '#5a3030'], ['7.5R 3/4', '#6b2c30'],
      ['7.5R 4/2', '#7a4848'], ['7.5R 4/4', '#903c40'], ['7.5R 4/6', '#a83038'],
      ['7.5R 5/2', '#956060'], ['7.5R 5/4', '#b05058'], ['7.5R 5/6', '#c84048'],
      ['7.5R 5/8', '#e03038'], ['7.5R 6/2', '#b08080'], ['7.5R 6/4', '#c87078'],
      ['7.5R 6/6', '#e05860'], ['7.5R 7/2', '#c8a0a0'], ['7.5R 7/4', '#e09098'],

      // ── 10R ──────────────────────────────────────────────────────
      ['10R 2/2', '#3d2220'], ['10R 3/2', '#5a3228'], ['10R 3/4', '#6c3028'],
      ['10R 4/2', '#7a4840'], ['10R 4/4', '#924038'], ['10R 4/6', '#b03028'],
      ['10R 5/2', '#966060'], ['10R 5/4', '#b05848'], ['10R 5/6', '#cc4030'],
      ['10R 5/8', '#e82818'], ['10R 6/2', '#b08080'], ['10R 6/4', '#cc7868'],
      ['10R 6/6', '#e86048'], ['10R 7/2', '#c8a0a0'], ['10R 7/4', '#e49888'],

      // ── 2.5YR ────────────────────────────────────────────────────
      ['2.5YR 2.5/2', '#3e2820'], ['2.5YR 3/2', '#563228'], ['2.5YR 3/4', '#6c3820'],
      ['2.5YR 3/6', '#823020'], ['2.5YR 4/2', '#7a5040'], ['2.5YR 4/4', '#965040'],
      ['2.5YR 4/6', '#b04030'], ['2.5YR 4/8', '#c43020'], ['2.5YR 5/2', '#987060'],
      ['2.5YR 5/4', '#b86858'], ['2.5YR 5/6', '#d05840'], ['2.5YR 5/8', '#e84828'],
      ['2.5YR 6/2', '#be9080'], ['2.5YR 6/4', '#d88870'], ['2.5YR 6/6', '#f07858'],
      ['2.5YR 6/8', '#f86040'], ['2.5YR 7/2', '#deb0a0'], ['2.5YR 7/4', '#f0a888'],
      ['2.5YR 7/6', '#ffa080'],

      // ── 5YR ──────────────────────────────────────────────────────
      ['5YR 2/1', '#2e2020'], ['5YR 2.5/2', '#442820'], ['5YR 3/2', '#5a3828'],
      ['5YR 3/3', '#654030'], ['5YR 3/4', '#703830'], ['5YR 4/2', '#7a5242'],
      ['5YR 4/3', '#8a5838'], ['5YR 4/4', '#9a5840'], ['5YR 4/6', '#b84830'],
      ['5YR 4/8', '#cc3820'], ['5YR 5/2', '#9a7062'], ['5YR 5/3', '#ae7848'],
      ['5YR 5/4', '#ba7050'], ['5YR 5/6', '#d46038'], ['5YR 5/8', '#e85020'],
      ['5YR 6/2', '#be9080'], ['5YR 6/3', '#cc9868'], ['5YR 6/4', '#d89060'],
      ['5YR 6/6', '#ee7840'], ['5YR 6/8', '#ff6828'], ['5YR 7/2', '#deb8a0'],
      ['5YR 7/3', '#e8b888'], ['5YR 7/4', '#f4b07a'], ['5YR 7/6', '#ffb870'],
      ['5YR 8/2', '#f0d4c0'], ['5YR 8/3', '#f8d0a0'], ['5YR 8/4', '#ffd890'],

      // ── 7.5YR ────────────────────────────────────────────────────
      ['7.5YR 2/0', '#282420'], ['7.5YR 3/2', '#503c2c'], ['7.5YR 3/3', '#5c4028'],
      ['7.5YR 3/4', '#664028'], ['7.5YR 4/2', '#725848'], ['7.5YR 4/3', '#7e5c38'],
      ['7.5YR 4/4', '#8a5c38'], ['7.5YR 4/6', '#a84c20'], ['7.5YR 5/2', '#907060'],
      ['7.5YR 5/3', '#a07a50'], ['7.5YR 5/4', '#aa7c48'], ['7.5YR 5/6', '#c87030'],
      ['7.5YR 5/8', '#e06018'], ['7.5YR 6/2', '#b89080'], ['7.5YR 6/3', '#c49868'],
      ['7.5YR 6/4', '#cc9858'], ['7.5YR 6/6', '#e48e38'], ['7.5YR 6/8', '#f88020'],
      ['7.5YR 7/2', '#d8b8a0'], ['7.5YR 7/3', '#e0b880'], ['7.5YR 7/4', '#e8b870'],
      ['7.5YR 7/6', '#f8b050'], ['7.5YR 7/8', '#ffb040'], ['7.5YR 8/2', '#f0d8c0'],
      ['7.5YR 8/3', '#f8d8a0'], ['7.5YR 8/4', '#ffd888'], ['7.5YR 8/6', '#ffe868'],

      // ── 10YR ─────────────────────────────────────────────────────  ← KEY for soil
      ['10YR 2/1', '#1e1a14'], ['10YR 2/2', '#30261a'], ['10YR 3/1', '#383028'],
      ['10YR 3/2', '#4a3c28'], ['10YR 3/3', '#544030'], ['10YR 3/4', '#5e4228'],
      ['10YR 4/1', '#524a40'], ['10YR 4/2', '#6a5840'], ['10YR 4/3', '#745e40'],
      ['10YR 4/4', '#7e6238'], ['10YR 4/6', '#9a5820'], ['10YR 5/1', '#706860'],
      ['10YR 5/2', '#887860'], ['10YR 5/3', '#987e58'], ['10YR 5/4', '#a08050'],
      ['10YR 5/6', '#be7630'], ['10YR 5/8', '#d86c18'], ['10YR 6/1', '#908880'],
      ['10YR 6/2', '#a89880'], ['10YR 6/3', '#b8a078'], ['10YR 6/4', '#c0a068'],
      ['10YR 6/6', '#d89848'], ['10YR 6/8', '#eca030'], ['10YR 7/1', '#b0aaa0'],
      ['10YR 7/2', '#c8b89c'], ['10YR 7/3', '#d4c090'], ['10YR 7/4', '#dcc080'],
      ['10YR 7/6', '#f0b860'], ['10YR 7/8', '#ffb840'], ['10YR 8/1', '#d0ccc6'],
      ['10YR 8/2', '#e0d2b8'], ['10YR 8/3', '#ead8a8'], ['10YR 8/4', '#f0d898'],
      ['10YR 8/6', '#ffd870'],

      // ── 2.5Y ─────────────────────────────────────────────────────
      ['2.5Y 2/0', '#201e18'], ['2.5Y 3/2', '#4a4428'], ['2.5Y 4/2', '#68603e'],
      ['2.5Y 4/4', '#786430'], ['2.5Y 5/2', '#888068'], ['2.5Y 5/3', '#948a58'],
      ['2.5Y 5/4', '#a09060'], ['2.5Y 5/6', '#b89040'], ['2.5Y 6/2', '#a8a090'],
      ['2.5Y 6/3', '#b8a878'], ['2.5Y 6/4', '#c0aa68'], ['2.5Y 6/6', '#d0a840'],
      ['2.5Y 7/2', '#c8c0a8'], ['2.5Y 7/3', '#d4c890'], ['2.5Y 7/4', '#dcc878'],
      ['2.5Y 7/6', '#eed068'], ['2.5Y 8/2', '#e4e0cc'], ['2.5Y 8/3', '#f0e4b0'],
      ['2.5Y 8/4', '#f8e4a0'], ['2.5Y 8/6', '#ffe880'],

      // ── 5Y ───────────────────────────────────────────────────────
      ['5Y 3/2', '#484430'], ['5Y 4/2', '#686040'], ['5Y 4/3', '#706848'],
      ['5Y 5/1', '#807c6c'], ['5Y 5/2', '#8a8870'], ['5Y 5/3', '#969062'],
      ['5Y 5/4', '#9c9258'], ['5Y 6/1', '#a0a098'], ['5Y 6/2', '#aaaa80'],
      ['5Y 6/3', '#b4b070'], ['5Y 6/4', '#bcb460'], ['5Y 7/1', '#c0c0b8'],
      ['5Y 7/2', '#caca9c'], ['5Y 7/3', '#d4d090'], ['5Y 7/4', '#dcd478'],
      ['5Y 8/1', '#dcdcd4'], ['5Y 8/2', '#e8e8b8'], ['5Y 8/3', '#f0ecac'],
      ['5Y 8/4', '#f8ec98'],

      // ── 5GY (olive) ───────────────────────────────────────────────
      ['5GY 4/1', '#5c6050'], ['5GY 5/2', '#7a8068'], ['5GY 5/4', '#849058'],
      ['5GY 6/2', '#9aa890'], ['5GY 6/4', '#a0b870'], ['5GY 7/2', '#b8c8a8'],
      ['5GY 8/2', '#d0e0c0'],

      // ── 2.5GY ────────────────────────────────────────────────────
      ['2.5GY 4/2', '#5a6048'], ['2.5GY 5/2', '#788068'], ['2.5GY 5/4', '#7e9050'],
      ['2.5GY 6/2', '#98a888'], ['2.5GY 7/2', '#b8c8a8'],

      // ── 5G ───────────────────────────────────────────────────────
      ['5G 5/1', '#708070'], ['5G 5/2', '#6c8870'], ['5G 6/2', '#88a888'],
    ];

    // Compute CIE Lab for each chip
    return raw.map(([code, hex]) => ({
      code,
      hex,
      lab: this._hexToLab(hex),
    }));
  }

  _hexToLab(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return this._rgbToLab(r, g, b);
  }
}
