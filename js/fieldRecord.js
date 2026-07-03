/**
 * fieldRecord.js
 * ─────────────────────────────────────────────────────────────────────
 * 현장 토층 기록 스키마 및 관리
 *
 * USDA Field Book for Describing and Sampling Soils (3rd ed.) 기반
 * https://www.nrcs.usda.gov/resources/guides-and-instructions/
 *         field-book-for-describing-and-sampling-soils
 *
 * 기록 항목:
 *   - Matrix color: dry / moist / wet (건조/습윤/포화 조건)
 *   - Mottles (반문): abundance, size, contrast
 *   - Redox features: 산화환원 특징
 *   - Texture, structure, boundary (질감, 구조, 경계)
 * ─────────────────────────────────────────────────────────────────────
 */

const FieldRecord = (() => {

  // ─── 스키마 ─────────────────────────────────────────────────────

  /**
   * 빈 토층 기록 객체 생성
   * @param {number} id  레이어 ID (Date.now())
   */
  function createLayer(id) {
    return {
      id,
      // 층위 식별
      number:      '',     // 층위번호 (사용자 정의, 예: "1", "2a")
      site:        '',     // 유적명
      trench:      '',     // 트렌치/그리드
      depth_top:   null,   // 상면 깊이 (cm)
      depth_bottom: null,  // 하면 깊이 (cm)

      // 먼셀 색 — Matrix (기질토)
      matrix: {
        code:      '',     // 먼셀 코드  예: "10YR 4/3"
        condition: 'moist', // 'dry' | 'moist' | 'wet'
        hex:       '',
        korName:   '',
        deltaE:    null,
        lightingK: 6504,   // 유효 색온도 (그레이카드 모드면 추정 CCT)
        wb:        null,   // { mode:'kelvin'|'graycard', K, whitePoint, cct }
        sampleStats: null, // 영역 평균일 때 픽셀 사용/제외 통계 (재현성)
        rgb:       null,
        pipeline:  null,   // 변환 파이프라인 중간값
      },

      // 반문 (Mottles / Redox Features)
      mottles: [],

      // 질감/구조 (선택)
      texture:   '',   // 예: "silty clay loam", "사질양토"
      structure: '',   // 예: "granular", "입상"
      consistency: '', // 예: "soft", "firm"
      boundary:  '',   // 예: "clear smooth", "명확 평탄"

      // 부가 정보
      notes:     '',
      timestamp: new Date().toLocaleString('ko-KR'),
      analyst:   '',
    };
  }

  /**
   * 빈 반문(mottle) 항목 생성
   */
  function createMottle() {
    return {
      code:       '',    // 먼셀 코드
      hex:        '',
      abundance:  'few', // 'few' | 'common' | 'many'
      size:       'fine', // 'fine' | 'medium' | 'coarse' | 'very coarse'
      contrast:   'faint', // 'faint' | 'distinct' | 'prominent'
      shape:      '',    // 예: "irregular"
    };
  }

  // ─── 코드 테이블 ─────────────────────────────────────────────────

  const CONDITION_LABEL = {
    dry:   '건조 (Dry)',
    moist: '습윤 (Moist)',
    wet:   '포화 (Wet)',
  };

  const ABUNDANCE_LABEL = {
    few:    '소량 (<2%)',
    common: '보통 (2–20%)',
    many:   '다량 (>20%)',
  };

  const SIZE_LABEL = {
    fine:        '세밀 (<5mm)',
    medium:      '중 (5–15mm)',
    coarse:      '조 (15–30mm)',
    very_coarse: '극조 (>30mm)',
  };

  const CONTRAST_LABEL = {
    faint:     '희미',
    distinct:  '뚜렷',
    prominent: '현저',
  };

  // ─── 직렬화 ─────────────────────────────────────────────────────

  /**
   * 층위 기록 → CSV 행 (헤더 포함)
   */
  function toCSVRows(layers) {
    const header = [
      '층위번호', '유적', '트렌치', '상면깊이(cm)', '하면깊이(cm)',
      '먼셀코드', '조건', 'Hue', 'Value', 'Chroma',
      'R', 'G', 'B', 'HEX', '한국어명', 'ΔE', '조명(K)',
      '반문수', '질감', '구조', '경계', '메모', '시간'
    ].join(',');

    const rows = layers.map(l => {
      const m = l.matrix;
      const code = m.code || '';
      const hvc = parseCode(code);
      const rgb = m.rgb || { r: '', g: '', b: '' };
      const mottleCount = (l.mottles || []).length;

      return [
        l.number, `"${l.site}"`, `"${l.trench}"`,
        l.depth_top ?? '', l.depth_bottom ?? '',
        code, m.condition, hvc.hue, hvc.value, hvc.chroma,
        rgb.r, rgb.g, rgb.b, m.hex,
        `"${m.korName}"`, m.deltaE ?? '', m.lightingK,
        mottleCount, `"${l.texture}"`, `"${l.structure}"`,
        `"${l.boundary}"`, `"${l.notes}"`, `"${l.timestamp}"`
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  /**
   * 층위 기록 → JSON
   */
  function toJSON(layers, meta = {}) {
    return JSON.stringify({
      munsell_kit_version: '1.0',
      schema: 'field-record-v1',
      exported: new Date().toISOString(),
      standard: 'ASTM D1535 / USDA Field Book 3rd ed.',
      ...meta,
      layers,
    }, null, 2);
  }

  // ─── 파싱 ────────────────────────────────────────────────────────

  function parseCode(code) {
    if (!code) return { hue: '', value: '', chroma: '' };
    const neutral = code.match(/^N\s*([0-9.]+)/i);
    if (neutral) return { hue: 'N', value: neutral[1], chroma: '0' };
    const chrom = code.match(/^([0-9.]+[A-Z]+)\s+([0-9.]+)\/([0-9.]*)/i);
    if (chrom) return { hue: chrom[1], value: chrom[2], chroma: chrom[3] };
    return { hue: '', value: '', chroma: '' };
  }

  // ─── Exports ──────────────────────────────────────────────────────
  return {
    createLayer, createMottle,
    toCSVRows, toJSON,
    parseCode,
    CONDITION_LABEL, ABUNDANCE_LABEL, SIZE_LABEL, CONTRAST_LABEL,
  };
})();
