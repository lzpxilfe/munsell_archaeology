# 먼셀 토색 판별기 (Munsell Archaeology Color Analyzer)

고고학 토층 조사용 먼셀(Munsell) 색 체계 판별 도구.  
사진에서 스포이드로 색을 채취하고, 먼셀 코드로 변환합니다.

> **이 레포지토리의 목적**: 현장 조사에서 고가의 먼셀 토색첩 없이 디지털로 색을 판별하기 위한 **핵심 엔진 레포지토리**입니다. 다른 프로그램(야장 앱, 도면 소프트웨어 등)에서 이 레포지토리를 참조하여 먼셀 색 기능을 통합할 수 있도록 설계되었습니다.

---

## 핵심 기능

### 🎯 색 판별 (Color Discrimination)

| 기능 | 설명 |
|---|---|
| **Canvas 스포이드** | 이미지 위 클릭으로 픽셀 색 채취 |
| **다중 픽셀 샘플링** | 1px / 3×3 / 5×5 / 7×7 평균 — 사진 노이즈 대응 |
| **돋보기(Magnifier)** | 커서 주변 15×15px를 8배 확대, 정확한 위치 선택 |
| **ΔE2000 색차** | CIE CIEDE2000 알고리즘으로 가장 정확한 색차 계산 |
| **Top-5 후보 칩** | 가장 가까운 먼셀 칩 5개를 ΔE 순으로 표시 |
| **EyeDropper API** | Chrome/Edge에서 화면 전체 색 추출 (보조) |

### 🌡️ 색온도 보정 (Color Temperature Correction)

현장 조명 조건에 따른 색 차이를 보정합니다.

| 프리셋 | 색온도 | 적용 상황 |
|---|---|---|
| ☀️ 맑음 | 5500K | 직사광선 아래 촬영 |
| 🌤️ 흐림 | 6500K | 엷은 구름 |
| ☁️ 흐린날 | 7500K | 완전 흐린 날 |
| 🌿 그늘 | 9000K | 나무 그늘, 깊은 트렌치 |
| 🔆 LED | 4000K | 실내 LED 조명 |
| 💡 텅스텐 | 3200K | 텅스텐 인공조명 |
| ⚖️ 기준 | 6504K | 보정 없음 (D65) |

보정 알고리즘: **Bradford Chromatic Adaptation Transform**  
(ISO 11664-6 / CIE 200:2011 기반)

### 📊 먼셀 변환

- **1차**: [munsell.js](https://github.com/privet-kitty/munsell.js) — CIE 먼셀 재표기 데이터 기반, 가장 정확
- **2차 (Fallback)**: 내장 먼셀 칩 LUT — ~250개 주요 토색 칩과 ΔE2000 최소거리 탐색
- **출력**: 먼셀 코드 (`10YR 4/3`), 한국어 색명, 토색 분류, ΔE 정확도

### 🏺 토층 기록

- 층위별 먼셀 코드, 색명, 조명 조건, 메모 기록
- 층위 비교 스트립 (색상 나란히 시각화)
- CSV / JSON 내보내기

---

## 사용법

### 온라인 사용

```
https://lzpxilfe.github.io/munsell_archaeology/
```

### 로컬 실행

```bash
git clone https://github.com/lzpxilfe/munsell_archaeology.git
cd munsell_archaeology
# index.html을 브라우저로 열기 (서버 불필요)
start index.html
```

---

## 파일 구조

```
munsell_archaeology/
├── index.html               ← 메인 앱 (단일 파일로 실행 가능)
├── css/
│   └── style.css            ← 다크모드 기반 UI
├── js/
│   ├── colorTemp.js         ← 색온도 보정 (Bradford CAT)
│   ├── munsellConverter.js  ← RGB → 먼셀 변환 핵심 엔진
│   ├── colorPicker.js       ← Canvas 스포이드 + 돋보기
│   └── app.js               ← 앱 로직 (이벤트, 상태, 내보내기)
└── README.md
```

---

## 다른 프로젝트에서 참조하기

### 핵심 모듈만 가져오기

```javascript
// 1. munsellConverter.js + colorTemp.js 를 포함

const corrector = new ColorTemperatureCorrector();
const converter = new MunsellConverter();

// 색온도 보정
const { r, g, b } = corrector.correctPixel(rawR, rawG, rawB, 7500); // 7500K = 그늘

// 먼셀 변환
const result = converter.analyze(r, g, b);
console.log(result.code);       // "10YR 4/3"
console.log(result.korName);    // "갈색"
console.log(result.deltaE);     // 1.8 (ΔE2000)
console.log(result.candidates); // Top-5 후보 칩
```

### API 참조

#### `MunsellConverter`

```javascript
const conv = new MunsellConverter();

// 분석
const result = conv.analyze(r, g, b);
// result: { code, hue, value, chroma, korName, soilClass, hex, chipHex, deltaE, accuracy, candidates, rgb, lab }

// 먼셀 코드 → HEX
const hex = conv.codeToHex('10YR 4/3');

// ΔE2000 직접 계산 (내부 메서드)
const dE = conv._deltaE2000(lab1, lab2);
```

#### `ColorTemperatureCorrector`

```javascript
const ctc = new ColorTemperatureCorrector();

// 단일 픽셀 보정
const corrected = ctc.correctPixel(r, g, b, sourceK);

// ImageData 전체 보정
const correctedData = ctc.correctImageData(imageData, sourceK);

// 프리셋 목록
const presets = ctc.presets;
// { sunny:{K:5500,...}, overcast:{K:7500,...}, ... }
```

---

## 먼셀 색체계 기초

먼셀 색체계는 **색상(Hue) · 명도(Value) · 채도(Chroma)** 세 축으로 색을 표기합니다.

```
표기: [색상] [명도]/[채도]
예:   10YR   4    / 3
      ↑       ↑      ↑
      황적색  어두움  낮은 채도
```

**토층에서 자주 등장하는 색 계열:**

| 색 계열 | 대표 코드 | 의미 |
|---|---|---|
| 흑색토 | N 2/ ~ 10YR 2/1 | 부식토, 유기물 풍부 |
| 암갈색토 | 10YR 3/2~3/3 | 일반 경작층 |
| 갈색토 | 7.5YR 4/4 | 자연 퇴적층 |
| 황갈색토 | 10YR 5/4~6/4 | 기반층 상부 |
| 황색토 | 2.5Y 6/4 | 풍화기반암층 |
| 적갈색토 | 5YR 4/4 | 철산화 층위 |

---

## 참고 자료

- [Munsell Soil Color Charts (2009)](https://munsell.com/color-products/color-books/munsell-soil-color-charts/)
- [privet-kitty/munsell.js](https://github.com/privet-kitty/munsell.js) — JS 먼셀 변환 라이브러리
- [CIEDE2000 Color Difference Formula](https://en.wikipedia.org/wiki/Color_difference#CIEDE2000)
- 국가유산청, 「매장문화재 발굴조사 업무 매뉴얼」

---

## 라이선스

MIT License — 현장 조사, 연구, 교육 목적 자유 사용

---

*이 도구는 현장의 조명 조건, 카메라 특성, 모니터 캘리브레이션에 따라 결과가 달라질 수 있습니다. 중요한 보고서 작성 시에는 실물 먼셀 토색첩으로 최종 확인하시기 바랍니다.*
