# 먼셀 토색 레포지토리 — 참고 사이트 조사 노트

작성일: 2026-07-03  
작성자: 사용자 조사 / Antigravity 에이전트 검증

---

## 결론

이 레포는 "먼셀 색상표 모음"이 아니라
**renotation 데이터 + 변환 함수 + nearest-chip 검증 + 토양/현장 기록 문법**으로 잡는 게 좋습니다.

레포 이름: munsell-kit (데이터만이 아니라 parse/convert/nearest/test fixture까지 제공)

---

## 참고 사이트 목록 (우선순위 순)

### 1. Colour Science for Python ★★★ (가장 중요)

- https://www.colour-science.org/
- https://colour.readthedocs.io/en/latest/colour.notation.html
- https://github.com/colour-science/colour/tree/develop/colour/notation/datasets/munsell

**핵심 내용:**
- `MUNSELL_COLOURS_REAL` — Newhall et al. 1943 renotation, MacAdam 한계 내 실제 칩
- `MUNSELL_COLOURS_ALL` — 외삽 포함 전체 칩
- 데이터 형식: `( ('10YR', 4.0, 3.0), (x, y, Y) )` — Illuminant C, 2° observer
- Y 스케일링: 원본 MgO 기준(~97.5%), 정규화 시 ×(1/0.975) 적용 필요
- `munsell_colour_to_xyY()` — Munsell → CIE xyY
- `xyY_to_munsell_colour()` — CIE xyY → Munsell
- Centore 2014 변형 고정밀 버전도 제공

**핵심 기술 결론:**
- 먼셀 데이터 기준 조명: **Illuminant C** (6774K, 옛 표준 주광)
- sRGB 기준: **D65** (6504K)
- D65 → C 변환에는 **CAT02** 권고 (Bradford보다 정확)

---

### 2. ASTM D1535 ★★

- https://store.astm.org/d1535-14r18.html (유료)

**ASTM D1535 적용 조건 (반드시 README에 명시):**
- 불투명 물체 (translucent 불가)
- CIE 표준 관찰자 (2°)
- 정상 색각 관찰자
- 조명: Illuminant C (먼셀 정의 기준)

---

### 3. R munsell 패키지 ★

- https://cran.r-project.org/web/packages/munsell/index.html
- https://github.com/cwickham/munsell/

**특징:**
- Newhall, Nickerson, Judd 1943 renotation 표 기반
- `"5R 5/10"` → hex 변환
- 표 기반/그래픽용 참고에 가까움 (연속 보간 불가)

---

### 4. R munsellinterpol ★★

- https://cran.r-project.org/web/packages/munsellinterpol/index.html

**특징:**
- decimal hue/chroma 처리 (예: `7.9YR 2.7/2.0`)
- CIE xyY/XYZ/Lab/Luv/RGB 변환
- ISCC-NBS lookup
- 비표준 입력 처리에 유용

---

### 5. AQP / NCSS Tech ★★★ (토양/고고학 분야 필수)

- https://cran.r-project.org/web/packages/aqp/index.html
- https://ncss-tech.github.io/aqp/reference/munsell2rgb.html
- https://ncss-tech.github.io/aqp/reference/getClosestMunsellChip.html
- https://ncss-tech.github.io/aqp/reference/col2Munsell.html

**핵심 내용:**
- `col2Munsell(coords, space, nClosest)` — 현재 권장 함수
  - 입력 공간: `sRGB` (0–1) 또는 `CIELAB`
  - ~8,825개 칩 LUT
  - 거리 척도: **CIE ΔE2000 (dE00)**
  - `sigma` 반환 (= dE00 값, 불확실성 지표)
- `getClosestMunsellChip()` — 오래된/보조 함수
- **등가 임계값: dE00 ≤ 2.15** (0.001 유의수준)
- 올바른 알고리즘:
  ```
  sRGB → linearRGB → XYZ(D65) → CAT02 → XYZ(C) → Lab_C → ΔE2000
  ```

---

### 6. USDA NRCS Field Book ★★

- https://www.nrcs.usda.gov/resources/guides-and-instructions/field-book-for-describing-and-sampling-soils

**토층 기재 항목 (현장 기록 문법 기준):**
- Matrix color: dry / moist / wet 조건 구분 필수
- Mottles / Redox features: abundance(소/보통/다), size(세/중/조), contrast(희미/뚜렷/현저)
- Texture, structure, boundary

---

### 7. Paul Centore — Munsell and Kubelka-Munk Toolbox ★

- https://github.com/colour-science/MunsellAndKubelkaMunkToolbox

**특징:**
- Munsell ↔ xyY, sRGB ↔ Munsell 변환 루틴
- maximum chroma, interpolation 처리
- colour-science도 Centore 알고리즘 참조

---

### 8. Bruce Lindbloom Color Math ★★

- http://www.brucelindbloom.com/Eqn_RGB_to_XYZ.html
- http://www.brucelindbloom.com/Eqn_XYZ_to_RGB.html
- http://www.brucelindbloom.com/Eqn_ChromAdapt.html

**역할:** RGB/XYZ 행렬값 검증, sRGB companding, chromatic adaptation 공식 설명용

---

### 9. ISCC-NBS 색명 사전 (참고용)

- https://people.csail.mit.edu/jaffer/Color/Dictionaries

**주의:** 색 이름은 모호하므로 Munsell HVC 표기를 대체해서는 안 됨

---

## 핵심 기술 노트

### Illuminant C vs D65

```
먼셀 Renotation (1943): Illuminant C (6774K)
sRGB / 디지털 카메라:   D65 (6504K)

→ D65 입력을 그대로 먼셀 LUT와 비교하면 체계적 오차 발생
→ 반드시 CAT02로 D65 → C 변환 후 LUT 검색
```

### 올바른 변환 파이프라인

```
sRGB [0–255]
  ↓ linearize (IEC 61966-2-1)
linearRGB [0–1]
  ↓ sRGB → XYZ matrix (Lindbloom)
XYZ [D65]
  ↓ CAT02 (D65 → Illuminant C)
XYZ [C]
  ↓ XYZtoxyY
xyY [C]
  ↓ munsell.js or LUT ΔE2000
Munsell HVC
```

### Y 스케일링 주의

```
원본 Newhall 데이터: Y를 MgO 기준 측정 (≈ 97.5% 반사율)
정규화 기준:         완전 반사체 (Y = 1.0)
변환:                Y_normalized = Y_raw × (1 / 0.975) = Y_raw × 1.02564

colour-science는 이미 정규화됨
raw .dat 파일을 직접 읽으면 스케일링 필요
```

### 등가 임계값

```
dE00 < 2.15  → 지각적으로 동일한 칩 (AQP 기준, 0.001 유의수준)
dE00 < 3.5   → 근접 (실용적 허용)
dE00 ≥ 6.0   → 참고용 (명확한 색 차이)
```

### RIT Munsell Color Science Lab 데이터 URL 주의

```
옛 RIT renotation 데이터 URL은 현재 404 또는 새 페이지로 리다이렉트됨
→ 원천 provenance로는 기록하되
→ 실제 기계 판독 데이터는 colour-science, munsellinterpol, aqp 사용 권장
```
