# 🏺 먼셀 토색 판별기 (Munsell Kit)
### Munsell Soil Color Analyzer for Archaeology

고고학 토층 조사용 먼셀(Munsell) 색 체계 판별 도구 및 분석 라이브러리입니다.  
발굴 현장에서 고가의 먼셀 토색첩 없이 디지털 이미지로부터 정교하게 먼셀 색을 판별하고 기록하기 위한 핵심 엔진 세트를 제공합니다.


---

## ✨ 이 레포지토리의 목적

고고학 발굴 현장에서 **토층(土層)** 의 색을 정확히 기록하는 일은 유구의 형성 과정과 시대를 판별하는 데 매우 중요합니다. 그러나 실물 먼셀 토색첩은 비싸고 현장에서 관리하기 번거롭습니다.

이 레포지토리는 **먼셀 색 판별의 핵심 엔진**을 제공합니다.

- 🖼️ **사진 스포이드** → 픽셀 RGB 추출
- 🌡️ **현장 조명 보정** → D65 표준으로 크로마틱 어댑테이션
- 🎨 **먼셀 코드 변환** → `10YR 4/3` 형태로 출력
- 🗂️ **토층 기록** → CSV / JSON 내보내기

> 다른 프로그램(야장 앱, 도면 소프트웨어 등)이 **이 레포지토리를 참조**하여 먼셀 색 기능을 통합할 수 있도록 모듈식으로 설계했습니다.

---

## 🚀 바로 시작하기

**설치 없음, 서버 없음, 계정 없음** — 파일을 받아서 브라우저로 열기만 하면 됩니다.

```bash
git clone https://github.com/lzpxilfe/munsell_archaeology.git
cd munsell_archaeology

# index.html을 브라우저로 열기
start index.html          # Windows
open index.html           # macOS
xdg-open index.html       # Linux
```

---

## 🎯 핵심 기능

### 🖼️ 스포이드 (Color Picker)

| 기능 | 설명 |
|---|---|
| **Canvas 스포이드** | 이미지 위 클릭으로 픽셀 색 채취 |
| **다중 픽셀 샘플링** | `1px` / `3×3` / `5×5` / `7×7` 평균 — 사진 노이즈 대응 |
| **🔍 돋보기(Magnifier)** | 커서 주변을 8배 확대, 정확한 위치 선택 지원 |
| **화면 스포이드** | Chrome/Edge의 EyeDropper API로 화면 어디서나 색 추출 |
| **드래그&드롭 / 붙여넣기** | `Ctrl+V`로 스크린샷 바로 분석 |

### 🌡️ 색온도 보정 (Color Temperature Correction)

발굴 현장의 조명 조건은 색을 크게 왜곡합니다. 이를 보정하지 않으면 같은 흙도 다른 먼셀 코드로 판별될 수 있습니다.

| 프리셋 | 색온도 | 적용 상황 |
|---|---|---|
| ☀️ **맑음** | 5,500K | 직사광선 아래 촬영 |
| 🌤️ **흐림** | 6,500K | 엷은 구름, 실외 확산광 |
| ☁️ **흐린날** | 7,500K | 완전 흐린 날, 비 올 때 |
| 🌿 **그늘** | 9,000K | 나무 그늘, 깊은 트렌치 안 |
| 🔆 **LED** | 4,000K | 실내 LED 조명 |
| 💡 **텅스텐** | 3,200K | 텅스텐 할로겐 인공조명 |
| ⚖️ **기준(D65)** | 6,504K | 보정 없음 (먼셀 체계 기준 조명) |

보정 알고리즘: **Bradford Chromatic Adaptation Transform**
> ISO 11664-6 / CIE 200:2011 기반. 촬영 조명의 화이트 포인트에서 D65로 색을 역변환합니다.

### 🎨 먼셀 변환 엔진

```
입력: RGB (0–255)  →  출력: 10YR 4/3 (Hue Value/Chroma)
```

| 단계 | 방법 | 특징 |
|---|---|---|
| **1차** | [munsell.js](https://github.com/privet-kitty/munsell.js) | CIE 먼셀 재표기 데이터 기반, 가장 정확 |
| **2차 (폴백)** | 내장 LUT ~250칩 | ΔE2000 최소거리 탐색 |

- **CIEDE2000 (ΔE2000)** — 인간 시각에 가장 근접한 색차 공식으로 정확도 계산
- **Top-5 후보 칩** — 가장 가까운 먼셀 칩 5개를 색차 순으로 제시
- **한국어 토색명** — `갈색`, `황갈색`, `암갈색` 등 현장 보고서 표기
- **토색 분류** — `갈색토`, `황갈색토`, `암적색토` 등 표준 분류

### 🗂️ 토층 기록

- 층위 번호, 먼셀 코드, 색명, 조명 조건, 메모 입력
- 층위별 **색상 비교 스트립** (나란히 시각화)
- **CSV** 내보내기 → Excel 바로 열기
- **JSON** 내보내기 → 다른 프로그램과 연동

---

## 📁 파일 구조

```
munsell_archaeology/
│
├── 📄 index.html                ← 메인 앱 (단일 파일로 실행 가능)
│
├── 🎨 css/
│   └── style.css                ← 다크/라이트 모드 UI
│
├── ⚙️ js/
│   ├── illuminant.js            ← 💡 CIE 광원 화이트 포인트 + xyY↔XYZ 변환
│   ├── chromAdapt.js            ← 🌡️ CAT02/Bradford 크로마틱 어댑테이션 (색온도 보정)
│   ├── nearestChip.js           ← 📏 ΔE2000 최근접 먼셀 칩 검색
│   ├── chipDatabase.js          ← 🗂️ 먼셀 Renotation 칩 룩업 테이블 (LUT)
│   ├── munsellConvert.js        ← 🎯 sRGB→먼셀 변환 파이프라인
│   ├── fieldRecord.js           ← 📋 현장 토층 기록 스키마 (USDA Field Book 기반)
│   ├── colorPicker.js           ← 🖼️ Canvas 스포이드 + 돋보기
│   └── app.js                   ← 🔗 앱 전체 로직
│
├── 🧪 fixtures/
│   ├── known_chips.json         ← 검증용 기준 칩 데이터
│   └── roundtrip_test.html      ← 변환 왕복 테스트 페이지
│
├── 📖 README.md
├── ⚖️  LICENSE
└── 🚫 .gitignore
```

---

## 🔧 다른 프로젝트에서 참조하기

이 레포지토리의 핵심 모듈만 가져다 쓸 수 있습니다. 모듈 간 의존성이 있으므로 아래 순서대로 로드하세요.

```html
<!-- 선택: munsell.js CDN — 없으면 내장 LUT로 폴백 -->
<script src="https://cdn.jsdelivr.net/npm/munsell@latest/dist/munsell.min.js"></script>

<script src="js/illuminant.js"></script>
<script src="js/chromAdapt.js"></script>
<script src="js/nearestChip.js"></script>
<script src="js/chipDatabase.js"></script>
<script src="js/munsellConvert.js"></script>
```

### 기본 사용 예시

```javascript
const chipsDB   = ChipDatabase.build();
const converter = new MunsellConvert(chipsDB);

// 1. 현장 조명 보정 (그늘 9000K → D65)
const { r, g, b } = ChromAdapt.correctPixelForField(rawR, rawG, rawB, 9000);

// 2. 먼셀 변환
const result = converter.analyze(r, g, b);

console.log(result.code);        // "10YR 4/3"
console.log(result.hue);         // "10YR"
console.log(result.value);       // 4
console.log(result.chroma);      // 3
console.log(result.korName);     // "갈색"
console.log(result.soilClass);   // { class: "brown", label: "갈색토", en: "Brown Soil" }
console.log(result.deltaE);      // 1.8  (ΔE2000 — 낮을수록 정확)
console.log(result.accuracy);    // { level: "close", label: "근접", cls: "fair", icon: "○" }
console.log(result.candidates);  // Top-5 후보 칩 배열
console.log(result.chipHex);     // "#7e6238"  (가장 가까운 칩의 HEX)
```

### API 참조

#### `MunsellConvert`

```javascript
const conv = new MunsellConvert(ChipDatabase.build());

// ✅ 핵심: sRGB → 먼셀 전체 분석
// (munsell.js 로드 시 보간 변환, 미로드 시 LUT ΔE2000 검색)
const result = conv.analyze(r, g, b);
// → { code, hue, value, chroma, isNeutral, hex, chipHex, deltaE,
//     accuracy, korName, soilClass, pipeline, candidates, fromLib, rgb }
```

#### `ChromAdapt`

```javascript
// ✅ 단일 픽셀 현장 조명 보정 (r,g,b: 0–255 / K: 촬영 조명 켈빈)
const corrected = ChromAdapt.correctPixelForField(r, g, b, K);
// → { r, g, b }

// ✅ ImageData 전체 보정 (Canvas API)
const correctedData = ChromAdapt.correctImageDataForField(imageData, K);

// ✅ 켈빈 → CIE XYZ 화이트 포인트 (Kang et al. 2002 근사식)
const xyz = ChromAdapt.kelvinToXYZ(6504);

// ✅ 먼셀 변환용 CAT02 어댑테이션 (XYZ는 { X, Y, Z } 객체)
const xyzC = ChromAdapt.D65toC(xyzD65);   // D65 → Illuminant C
const back = ChromAdapt.CtoD65(xyzC);     // Illuminant C → D65
```

#### `NearestChip`

```javascript
// ✅ ΔE2000 직접 계산 (Lab 값: { L, a, b })
const dE = NearestChip.deltaE2000(lab1, lab2);

// ✅ Lab(Illuminant C) → 최근접 칩 Top-N 검색
const candidates = NearestChip.findNearest(labC, chipsDB, 5);
```

#### `result.candidates` 구조

```javascript
// Top-5 후보 칩 — ΔE2000 오름차순
[
  { code: "10YR 4/2", hex: "#71624e", hue: "10YR", value: 4, chroma: 2,
    dE: 1.8, sigma: 1.8, rank: 1, equivalent: true },   // best
  { code: "10YR 4/4", hex: "#80603a", hue: "10YR", value: 4, chroma: 4,
    dE: 2.3, sigma: 2.3, rank: 2, equivalent: false },
  // ...
]
// LUT 칩은 짝수 채도만 포함하며, munsell.js 보간 변환이 성공하면
// 첫 항목의 code가 보간 결과(예: "10YR 4/3")로 바뀌고 from: "munsell.js"가 추가됩니다.
```

---

## 📐 먼셀 색체계 기초

먼셀 색체계는 **색상(Hue) · 명도(Value) · 채도(Chroma)** 세 축으로 색을 수치화합니다.

```
표기법:   [색상]  [명도] / [채도]
예시:     10YR     4    /   3
           ↑        ↑        ↑
        황적색계   어두움   낮은 채도
           ↓        ↓        ↓
        (흙 = 주로 YR, Y 계열)
```

### 🪨 토층에서 자주 등장하는 색 계열

| 먼셀 코드 범위 | 한국어명 | 주요 의미 |
|---|---|---|
| `N 2/` ~ `10YR 2/1` | 🖤 흑색토 | 부식토, 유기물 풍부한 층위 |
| `10YR 3/1` ~ `3/3`  | 🟫 암갈색토 | 일반 경작층, 교란층 |
| `7.5YR 4/4` ~ `10YR 4/4` | 🟤 갈색토 | 자연 퇴적층 |
| `10YR 5/4` ~ `6/4`  | 🟡 황갈색토 | 기반층 상부 |
| `2.5Y 6/4` ~ `5Y 7/3` | 🌕 황색토 | 풍화기반암층, 생토 |
| `5YR 4/4` ~ `7.5YR 4/6` | 🔴 적갈색토 | 철산화층, 소성흔 |
| `2.5Y 5/2` ~ `5Y 6/2` | 🩶 회황색토 | 습윤환원층, 저지대 |

### 🌡️ 색온도가 판독에 미치는 영향

```
같은 흙 (실제: 10YR 4/3 갈색)을 다른 조명에서 촬영하면:

  ☀️ 직사광선 (5500K) → 카메라에 10YR 5/4 로 찍힘 (더 밝고 노랗게)
  🌿 그늘 (9000K)     → 카메라에 10YR 3/2 로 찍힘 (더 어둡고 파랗게)
  ⚖️ D65 보정 후      → 10YR 4/3 으로 정확히 판별
```

---

## 🤝 기여 / 피드백

먼셀 칩 데이터 추가, 알고리즘 개선, 버그 수정 등 어떤 기여든 환영합니다.

- 🐛 **버그 리포트**: [Issues](https://github.com/lzpxilfe/munsell_archaeology/issues)
- 💡 **기능 제안**: [Issues](https://github.com/lzpxilfe/munsell_archaeology/issues)
- 🔀 **Pull Request**: 언제든 환영합니다

---

## 📚 참고 자료

- 📘 [Munsell Soil Color Charts (2009 개정판)](https://munsell.com/color-products/color-books/munsell-soil-color-charts/) — 실물 토색첩 표준
- 🔬 [privet-kitty/munsell.js](https://github.com/privet-kitty/munsell.js) — 이 프로젝트가 사용하는 먼셀 변환 라이브러리
- 📐 [CIEDE2000 색차 공식](https://en.wikipedia.org/wiki/Color_difference#CIEDE2000) — ΔE2000 알고리즘 원문
- 📗 [CIE 200:2011](https://cie.co.at/) — 크로마틱 어댑테이션 표준
- 📙 국가유산청, 「매장문화재 발굴조사 업무 매뉴얼」

---

## ⚖️ 라이선스

**MIT License** — 누구나, 어디서나, 어떤 목적으로도 자유롭게 사용하세요.

```
✅ 개인 사용     ✅ 연구/학술    ✅ 현장 조사
✅ 수정/개선     ✅ 재배포       ✅ 다른 프로젝트에 통합
```

자세한 내용은 [LICENSE](LICENSE) 파일을 참고하세요.

---

<div align="center">

🏺 **고가의 토색첩 없이도, 현장에서 정확한 먼셀 색 판별을.**

*발굴 현장의 모든 연구자와 조사원을 위해 만들었습니다.*

</div>
