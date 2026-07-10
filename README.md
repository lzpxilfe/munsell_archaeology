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

## 🖥️ 데스크톱 앱 (Windows exe) 설치 방법

같은 앱을 **단일 포터블 exe**로도 쓸 수 있습니다 — 웹앱과 기능은 완전히 동일하고,
설치 프로그램·인터넷 연결 없이 더블클릭으로 바로 실행됩니다. USB에 담아 현장
노트북으로 옮겨도 그대로 동작합니다.

> ⚠️ **exe 파일 자체는 이 저장소(GitHub)에 올라가 있지 않습니다.** 빌드 산출물이라
> 용량이 크고 커밋 이력에 안 어울려서 `.gitignore`로 제외해 두었습니다. 아래
> 절차대로 **컴퓨터에서 직접 한 번 빌드**하면 `desktop\dist\` 폴더 안에 exe가
> 생성됩니다 — 이후로는 그 exe 파일만 복사해서 계속 쓰면 됩니다 (매번 다시
> 빌드할 필요 없음).

### 1단계 — Python 설치 (빌드할 때만 필요, 딱 한 번)

exe를 만드는 컴퓨터에만 Python이 필요합니다. **exe를 실행하는 사람은 Python이
전혀 필요 없습니다.**

1. [python.org/downloads](https://www.python.org/downloads/) 에서 최신 버전 다운로드 (3.12 이상)
2. 설치 화면 맨 아래 **"Add python.exe to PATH"** 체크박스를 꼭 체크하고 설치
3. 설치 확인: 명령 프롬프트(cmd)나 PowerShell을 열고 아래 입력

   ```
   python --version
   ```

   `Python 3.12.x` 같은 버전이 나오면 성공.

### 2단계 — 이 저장소 받기

**방법 A: git이 있는 경우**
```bat
git clone https://github.com/lzpxilfe/munsell_archaeology.git
cd munsell_archaeology
```

**방법 B: git 없이 다운로드만 (더 쉬움)**
1. 이 저장소 페이지 우측 상단 초록색 **`< > Code`** 버튼 → **Download ZIP**
2. 받은 ZIP 파일 압축 해제 (원하는 폴더 아무 곳에나, 경로에 한글이 없는 위치 권장)

### 3단계 — 빌드

압축 해제한(또는 clone한) 폴더 안에서:

```bat
cd desktop
build.bat
```

더블클릭으로 실행해도 됩니다. 처음 실행 시 필요한 패키지를 자동으로 설치하고
(수십 초~1분 정도 소요), 마지막에 아래처럼 완료 메시지가 뜹니다:

```
산출물: ...\desktop\dist\MunsellSoilColor.exe
```

### 4단계 — 바탕화면에 두기

`desktop\dist\MunsellSoilColor.exe`를 실행 위치로 두 가지 방법이 있습니다. 둘 다 잘 동작하니 편한 쪽으로 선택하세요.

**방법 A: exe 파일을 바탕화면에 직접 복사** (더 간단, USB로 옮기기도 편함)
1. `desktop\dist\MunsellSoilColor.exe`를 찾아 복사(`Ctrl+C`)
2. 바탕화면에 붙여넣기(`Ctrl+V`)
3. 원하면 이름을 "먼셀 토색 판별기.exe" 등으로 변경

**방법 B: 원본은 그대로 두고 바로가기만 생성** (재빌드 시 자동으로 최신 반영됨)
1. `desktop\dist\MunsellSoilColor.exe`를 **마우스 오른쪽 클릭 → 바로가기 만들기**
2. 생성된 바로가기 파일을 바탕화면으로 드래그, 원하면 이름 변경

코드를 수정해서 다시 빌드할 계획이라면 방법 B(바로가기)가 편합니다 — `build.bat`를 다시
실행해도 바로가기가 가리키는 파일이 그대로 갱신되기 때문입니다. 방법 A(파일 복사)를
선택했다면 재빌드 후 다시 복사해줘야 최신 상태가 됩니다.

### 실행 후 확인 사항

- **사진 파일 위치는 어디든 상관없습니다.** C드라이브, USB, 바탕화면, 다운로드
  폴더, 네트워크 드라이브 등 어디에 있는 사진이든 파일 선택창·드래그앤드롭·
  Ctrl+V 붙여넣기로 불러오면 동일하게 동작합니다. (프로그램이 사진 파일 내용을
  그대로 메모리로 읽어들이는 방식이라 원본 경로와 무관합니다.)
- **완전 오프라인 동작**: 인터넷 연결 없이도 모든 기능(먼셀 변환, 색온도 보정,
  그레이카드 WB 등)이 정상 작동합니다.
- 테마 설정 등은 `%LOCALAPPDATA%\MunsellArchaeo` 폴더에 저장됩니다.

### 문제가 생기면

- **"WebView2 필요" 안내가 뜨는 경우**: Windows 10/11 대부분에 기본 설치되어
  있지만, 없는 PC라면 안내 창의 다운로드 링크를 눌러 설치 후 다시 실행하세요.
- **백신이 경고를 띄우는 경우**: 단일 exe 파일 빌드 특성상 일부 백신이 오탐할
  수 있습니다. 직접 빌드한 파일이므로 예외 처리하고 사용하면 됩니다.
- 자세한 내용/문제 해결: [desktop/README.md](desktop/README.md)

개발자용 정보 (수정 없이 바로 실행): `python desktop\main.py`

---

## 🎯 핵심 기능

### 🖼️ 스포이드 & 영역 분석 (Color Picker / Region)

| 기능 | 설명 |
|---|---|
| **Canvas 스포이드** | 이미지 위 클릭으로 픽셀 색 채취 — 풀해상도 원본 픽셀 기준 |
| **다중 픽셀 샘플링** | `1px` / `3×3` / `5×5` / `7×7` 평균 — 사진 노이즈 대응 |
| **▭ 영역 평균 (사각형/올가미/폴리라인)** | 영역을 지정하면 **빛·그림자·이물을 자동 제외**한 로버스트 평균색 판별 (클리핑 가드 → L\* 트리밍 → 색도 이상치 제거 → linear RGB 평균). 📐 폴리라인은 클릭으로 정점을 찍는 캐드 방식 — 각진 토층 경계를 정밀하게 추적 |
| **🔍 돋보기(Magnifier)** | 커서 주변을 8배 확대, 정확한 위치 선택 지원 |
| **🔎 줌/팬** | 휠 줌(최대 8×) + Space 드래그 이동 — 고해상도 토층 사진 정밀 선택 |
| **📌 다중 지점 비교 (마커)** | 여러 지점/영역을 마커로 고정해 나란히 비교, 마커 간 **상호 ΔE2000**으로 "같은 층인가" 판단 지원 |
| **🗺 층위 경계 고정** | 채취한 영역을 층위 번호와 함께 추가하면 그 경계가 사진 위에 영구히 남는다 — 여러 층을 차례로 따내면 토층 구분선 전체가 번호와 함께 표시되는 스케치가 됨 |
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

#### ⬜ 그레이카드 화이트밸런스 (색온도 프리셋보다 정확)

사진에 **회색 카드·컬러체커·무채색 물체**가 찍혀 있다면 그 지점을 클릭하는 것만으로
촬영 광원을 직접 추정해 보정합니다. 색온도를 추측할 필요가 없어 가장 정확합니다.

- 클릭 지점(9×9 평균)의 색도 → 광원 화이트포인트 추정 (McCamy CCT 표시)
- 플랑크 궤적 거리(Duv) 검증으로 유채색 물체 오클릭 경고
- 색온도 슬라이더와 상호배타 — 프리셋/슬라이더 조작 시 자동 해제

### 🎨 먼셀 변환 엔진

```
입력: RGB (0–255)  →  출력: 10YR 4/3 (Hue Value/Chroma)
```

| 단계 | 방법 | 특징 |
|---|---|---|
| **1차** | [munsell.js](https://github.com/privet-kitty/munsell.js) (로컬 번들, 오프라인 동작) | CIE 먼셀 재표기 데이터 기반, 가장 정확. 결과는 토색첩 표기로 반올림(`10YR 4/3`) + 연속값은 `codePrecise`로 별도 제공 |
| **2차 (폴백)** | 내장 LUT 511칩 | ΔE2000 최소거리 탐색 (munsell.js 미로드 시에도 동작) |

- **실물 토색첩 그리드 준수** — Value는 `2.5, 3, 4, 5, 6, 7, 8`(7단계), Chroma는
  `1, 2, 3, 4, 6, 8`(6단계)만 사용합니다. 실물 Munsell Soil Color Charts 책에
  존재하지 않는 칩(예: Chroma 5·7, Value 1·2·9)은 절대 결과로 나오지 않고,
  가장 가까운 실제 칩으로 스냅됩니다 — 현장에서 책과 바로 대조할 수 있도록.
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
├── 📄 index.html                ← 메인 앱 (브라우저로 바로 실행 가능)
│
├── 🎨 css/
│   └── style.css                ← 다크/라이트 모드 UI
│
├── ⚙️ js/                        ← 색채 엔진 (순수 계산, 브라우저 독립적)
│   ├── illuminant.js            ← 🌈 CIE 색공간 변환 기초 (Illuminant C/D65)
│   ├── chromAdapt.js            ← 🌡️ CAT02/Bradford 어댑테이션 + 그레이카드 WB
│   ├── chipDatabase.js          ← 🗃️ 먼셀 칩 LUT (munsell.js 기준 재생성)
│   ├── nearestChip.js           ← 📏 CIEDE2000 최근접 칩 검색
│   ├── munsellConvert.js        ← 🎯 sRGB→먼셀 파이프라인 엔진
│   ├── fieldRecord.js           ← 🗂️ USDA Field Book 층위 기록 스키마
│   │                            ── UI 모듈 ──
│   ├── imageView.js             ← 🔎 줌/팬 + 풀해상도 픽셀 캐시
│   ├── colorPicker.js           ← 🖼️ 스포이드 + 돋보기 + 도구 라우팅
│   ├── regionSelect.js          ← ▭ 영역 선택(사각형/올가미/폴리라인) + 로버스트 평균
│   ├── markers.js               ← 📌 다중 지점 비교
│   ├── layerOverlay.js          ← 🗺 층위 경계 고정 (사진 위 상시 표시)
│   ├── desktopBridge.js         ← 🖥️ 데스크톱 셸 감지 + 파일 저장 브리지
│   ├── app.js                   ← 🔗 앱 전체 로직
│   └── vendor/munsell.min.js    ← 📦 munsell.js v1.1.6 로컬 번들 (오프라인)
│
├── 🖥️ desktop/                   ← Windows exe 셸 (pywebview + PyInstaller)
│   ├── main.py · server.py · api.py · runtime_check.py
│   └── munsell_desktop.spec · build.bat · README.md
│
├── 🧪 fixtures/                  ← 검증 픽스처 (브라우저로 열면 자동 실행)
│   ├── roundtrip_test.html      ← 파이프라인 왕복 검증 (15/15 등가)
│   ├── correction_equiv_test.html ← 보정 고속 경로 동등성
│   ├── region_test.html         ← 영역 로버스트 평균
│   ├── graycard_test.html       ← 그레이카드 WB
│   └── known_chips.json         ← 기준 케이스 데이터
│
├── 📖 README.md
├── ⚖️  LICENSE
└── 🚫 .gitignore
```

---

## 🔧 다른 프로젝트에서 참조하기

이 레포지토리의 핵심 모듈(`illuminant.js`, `chromAdapt.js`, `chipDatabase.js`, `nearestChip.js`,
`munsellConvert.js`, `fieldRecord.js` — 전부 브라우저 API에 의존하지 않는 순수 계산 모듈)만
가져다 쓸 수 있습니다.

### 기본 사용 예시

```javascript
// script 태그로 포함하거나 import (illuminant → chromAdapt → nearestChip →
// chipDatabase → munsellConvert 순서로 로드해야 함, index.html 참고)

const converter = new MunsellConvert(ChipDatabase.build());

// 1. 현장 조명 보정 (그늘 9000K → D65)
const { r, g, b } = ChromAdapt.correctPixelForField(rawR, rawG, rawB, 9000);

// 2. 먼셀 변환
const result = converter.analyze(r, g, b);

console.log(result.code);         // "10YR 4/3"       (토색첩 표기로 반올림)
console.log(result.codePrecise);  // "9.8YR 4.1/3.2"   (munsell.js 연속값, 폴백 시 null)
console.log(result.hue);          // "10YR"
console.log(result.value);        // 4
console.log(result.chroma);       // 3
console.log(result.korName);      // "갈색"
console.log(result.soilClass);    // { label: "갈색토", en: "Brown Soil", class: "brown" }
console.log(result.deltaE);       // 0.3   (ΔE2000 — 낮을수록 정확)
console.log(result.accuracy);     // { level: "perfect", label: "일치", cls: "perfect" }
console.log(result.candidates);   // Top-5 후보 칩 배열
console.log(result.chipHex);      // "#745834"  (가장 가까운 칩의 HEX)
```

### API 참조

#### `MunsellConvert`

```javascript
const conv = new MunsellConvert(ChipDatabase.build());

// ✅ 핵심: sRGB → 먼셀 전체 분석 (이미 조명 보정된 값을 넣을 것)
const result = conv.analyze(r, g, b);
// → { code, codePrecise, hue, value, chroma, isNeutral, korName, soilClass,
//     hex, chipHex, deltaE, accuracy, candidates, fromLib, pipeline, rgb }
```

#### `ChromAdapt`

```javascript
// ✅ 단일 픽셀 현장 보정 (r,g,b: 0-255 / K: 촬영 조명 색온도)
const corrected = ChromAdapt.correctPixelForField(r, g, b, K);   // → { r, g, b }

// ✅ ImageData 전체 보정 (Canvas API, 고속 경로: 결합 행렬 + 감마 LUT)
const correctedData = ChromAdapt.correctImageDataForField(imageData, K);

// ✅ 그레이카드 화이트밸런스: 무채색 픽셀 → 광원 화이트포인트 추정
const est = ChromAdapt.estimateIlluminantFromGray(r, g, b);
// → { wp, cct, duv, warnings }  (warnings: clipped_high/low, not_neutral, suspicious_cct)
const wbCorrected = ChromAdapt.correctImageDataToD65(imageData, est.wp);

// ✅ 켈빈 → CIE XYZ 화이트 포인트
const xyz = ChromAdapt.kelvinToXYZ(6504);
```

#### `NearestChip`

```javascript
// ✅ CIEDE2000 색차 (지각적으로 가장 정확한 색차 공식)
const dE = NearestChip.deltaE2000(lab1, lab2);

// ✅ 등가 임계값 (AQP/NCSS 기준)
NearestChip.EQUIVALENCE_THRESHOLD;   // 2.15
```

#### `result.candidates` 구조

```javascript
// Top-5 후보 칩 — ΔE2000 오름차순
[
  { code: "10YR 4/3", hex: "#745834", dE: 0.3, equivalent: true, from: "munsell.js" },  // 1순위 (munsell.js 결과)
  { code: "10YR 4/4", hex: "#7c562c", dE: 2.1, equivalent: true, rank: 2 },              // 이하 LUT 후보 (from 없음)
  { code: "7.5YR 4/3",hex: "#7c5439", dE: 3.4, equivalent: false, rank: 3 },
  // ...
]
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

## Citation

이 저장소가 연구, 수업, 현장 업무에 도움이 되었다면 GitHub의 **Cite this repository** 버튼으로 인용해 주세요.

[![Cite this repository](https://img.shields.io/badge/Cite_this-repository-2ea44f?logo=github)](https://github.com/lzpxilfe/munsell_archaeology)
[![Star this repository](https://img.shields.io/github/stars/lzpxilfe/munsell_archaeology?style=social)](https://github.com/lzpxilfe/munsell_archaeology)

인용 메타데이터는 [CITATION.cff](CITATION.cff)에 보관합니다.

