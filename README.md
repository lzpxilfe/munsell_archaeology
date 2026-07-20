# 🏺 먼셀 토색 판별기 (Munsell Kit)
### Munsell Soil Color Analyzer for Archaeology

고고학 토층 조사용 먼셀(Munsell) 색 체계 판별 도구 및 분석 라이브러리입니다.  
발굴 현장에서 고가의 먼셀 토색첩 없이 디지털 이미지로부터 정교하게 먼셀 색을 판별하고 기록하기 위한 핵심 엔진 세트를 제공합니다.

---

## ✨ 이 레포지토리의 목적

고고학 발굴 현장에서 **토층(土層)**의 색을 정확히 기록하는 일은 유구의 형성 과정과 시대를 판별하는 데 매우 중요합니다. 하지만 실물 먼셀 토색첩은 비싸고, 현장에서 비바람에 노출되어 오염되거나 훼손되기 쉽습니다. 게다가 촬영 조건(직사광선, 그늘, 실내조명 등)이나 렌즈 주변부가 어두워지는 현상(비네팅) 때문에 사진의 색이 왜곡되는 문제가 많았습니다.

이 레포지토리는 그러한 왜곡을 줄이고 실물 토색첩과 가장 근접한 색상 분석을 제공하는 **전문 학술 분석 엔진**과 **인터랙티브 웹/데스크톱 툴**을 제공합니다.

- 🖼️ **사진 스포이드 & 영역 통계** → 픽셀 RGB 추출 및 아웃라이어 제거
- 🌡️ **조명 색온도 보정** → D65 표준광으로 크로마틱 어댑테이션 (Bradford CAT)
- 🎨 **컬러체커 CCM 보정** → 6색 컬러 바 및 24색 맥베스 카드 회귀 매트릭스 계산
- 📷 **비네팅 반경 이득 보상** → 렌즈 곡률에 의한 주변부 광량 감소 복원
- 💧 **토양 수분 추정 및 정규화** → 건조/습윤 상태 예측 및 층위 기록 자동 정규화
- 🗂️ **토층 기록** → USDA 규격 야장 기록 및 CSV / JSON 내보내기

> 다른 프로그램(야장 앱, GIS 소프트웨어, 3D 도면 프로그램 등)이 **이 레포지토리의 자바스크립트 엔진**을 그대로 임포트하여 먼셀 변환 및 보정 기능을 쉽게 연동할 수 있도록 순수 함수형 모듈로 설계되었습니다.

---

## 🚀 바로 시작하기 (웹 브라우저)

**설치 없음, 서버 설치 불필요, 계정 로그인 없음** — 저장소를 다운로드하여 파일을 브라우저로 더블클릭해 열기만 하면 즉시 동작합니다.

```bash
git clone https://github.com/lzpxilfe/munsell_archaeology.git
cd munsell_archaeology

# index.html을 브라우저로 열기
start index.html          # Windows
open index.html           # macOS
xdg-open index.html       # Linux
```

---

## 🖥️ 데스크톱 앱 (Windows exe) 빌드 및 실행 방법

동일한 애플리케이션을 인터넷 연결이나 브라우저에 구애받지 않는 **단일 포터블 실행 파일(`MunsellSoilColor.exe`)**로 패키징하여 사용할 수 있습니다. USB 메모리에 파일 하나만 복사해서 야외 현장용 노트북으로 옮겨도 바로 더블클릭하여 오프라인으로 실행할 수 있습니다.

> ⚠️ **보안 및 저장소 최적화를 위해 `.exe` 파일 자체는 GitHub에 커밋되어 있지 않습니다.**  
> 아래 절차에 따라 사용하시는 컴퓨터에서 단 한 번만 빌드(컴파일)하면 100% 무해하고 완벽한 단독 실행 파일이 생성됩니다.

### 1단계: 컴퓨터에 Python 설치 (빌드 도구용, 최초 1회만 필요)
*이미 Python이 설치되어 있다면 2단계로 건너뛰세요.*
1. [Python 공식 다운로드 페이지](https://www.python.org/downloads/)에서 Windows용 최신 설치 프로그램을 다운로드합니다.
2. 설치 프로그램 실행 시 맨 아래의 **"Add python.exe to PATH"** 체크박스를 **반드시 체크**하고 설치를 완료합니다.
3. 명령 프롬프트(`cmd`)나 PowerShell을 열고 아래 명령어를 쳐서 정상 작동을 확인합니다:
   ```bash
   python --version
   ```
   `Python 3.12.x`처럼 버전 번호가 나타나면 성공입니다.

### 2단계: 저장소 소스코드 다운로드
* **방법 A: Git 사용자**
  ```bash
  git clone https://github.com/lzpxilfe/munsell_archaeology.git
  cd munsell_archaeology
  ```
* **방법 B: 일반 사용자 (ZIP 다운로드)**
  1. 저장소 우측 상단의 초록색 **`Code`** 버튼 ➡️ **`Download ZIP`**을 클릭합니다.
  2. 다운로드된 ZIP 파일의 압축을 풉니다 (경로명에 한글이 들어가지 않는 폴더 위치를 권장합니다).

### 3단계: 빌드 스크립트 실행 (exe 컴파일)
1. 압축을 푼 폴더 내부의 `desktop` 폴더로 이동합니다.
2. **`build.bat`** 파일을 마우스로 **더블클릭**합니다 (또는 터미널에서 `cd desktop && build.bat` 입력).
3. 스크립트가 실행되면 `pip install`을 통해 데스크톱 창 래퍼(`pywebview`)와 컴파일러(`pyinstaller`) 패키지를 자동 설치한 뒤 빌드(약 30초~1분 소요)를 진행합니다.
4. 완료되면 창에 `산출물: ...\desktop\dist\MunsellSoilColor.exe`가 표시되며 아무 키나 누르면 종료됩니다.

### 4단계: 실행 및 휴대
* 빌드가 완료되면 `desktop\dist\` 폴더 아래에 생성된 **`MunsellSoilColor.exe`** 파일을 원하시는 곳(바탕화면, USB 메모리 등)으로 복사하여 자유롭게 더블클릭해 실행하면 됩니다.
* **WebView2 안내 관련**: 만약 실행 시 "WebView2 런타임이 필요합니다"라는 경고가 발생한다면, 대화상자의 링크를 따라 Microsoft 공식 WebView2 런타임을 설치해 주시면 정상 실행됩니다 (Windows 10/11은 일반적으로 자동 내장되어 있습니다).
* **백신 오탐지 경고**: 직접 빌드한 수제 파일이므로 백신 프로그램(Windows Defender 등)이 출처가 불분명한 프로그램으로 경고창을 띄우는 경우가 있습니다. 이 경우 안심하고 "추가 정보"를 눌러 **`실행 허용`**을 선택하시면 됩니다.

---

## 🎯 핵심 기능 상세 소개

### 🖼️ 정밀 픽셀 스포이드 및 영역 통계 (Color Picker & Robust Region Mean)
* **단일 및 다중 픽셀 샘플링**: 사진의 디지털 노이즈를 제어하기 위해 픽셀 추출 반경을 `1px`, `3×3`, `5×5`, `7×7` 단위로 유연하게 설정할 수 있습니다.
* **로버스트 영역 평균 (▭ 사각형 / 올가미 / 📐 폴리라인)**: 단순히 드래그한 영역의 평균을 내면 토양 속 자갈, 뿌리, 그늘 등으로 오차가 생깁니다. 이를 해소하기 위해 **휘도 클리핑 ➡️ $L^*$ 값 기준 상하위 10% 트리밍 ➡️ 색도 공간(a\*, b\*) 아웃라이어 제거** 파이프라인을 구축하여 실제 흙 바탕색만을 강인하게(Robust) 검출합니다.
* **📐 폴리라인 도구**: CAD 스타일로 모퉁이를 콕콕 집어 다각형 경계를 만들 수 있어, 복잡하고 꺾인 유구 경계선의 토색을 정확히 획정합니다.
* **🔍 실시간 8배 돋보기 & 🔎 자유 줌/팬**: 고해상도 현장 사진을 자유롭게 마우스 휠로 확대하고(최대 8배) Space바 드래그로 이동하며 색상을 조준할 수 있습니다.
* **📌 다중 마커 고정 & 색차 측정**: 사진 여러 곳의 색을 찍어 고정하고, 마커 목록에서 두 층간의 $\Delta E_{2000}$ 색차를 연산하여 "이 두 흙이 과학적으로 동일한 층인가" 판단하는 지표를 제공합니다.

### 🌡️ 조명 보정 (Color Temperature) & 그레이카드 캘리브레이션
* **색온도 6대 프리셋**: 야외 직사광(5500K), 흐림(6500K), 그늘(9000K), 인공 LED(4000K) 등 조명 조건에 따라 표준 Bradford 변환 행렬을 적용하여 이미지를 보정합니다.
* **⬜ 회색카드 화이트 밸런스**: 사진 안에 그레이카드가 같이 찍혀 있다면, 해당 영역을 클릭하기만 해도 광원의 정확한 분광 분포와 색온도(CCT)를 추정해 D65 백색광으로 정밀 화정합니다.

### 🎨 컬러체커 보정 (Color Correction Matrix, CCM)
카메라 센서의 필터 특성상 적색, 녹색, 청색이 서로 혼입되는 Spectral Cross-talk 현상이 발생합니다. 단순 게인 보정을 넘어서 이를 선형 회귀 매트릭스로 완벽 보정합니다.
* **🎨 6색 컬러 바 모드**: 임의의 간이 촬영 스케일 자에 위치한 흰색, 회색, 검정색, 빨간색, 초록색, 파란색 패치를 순서대로 클릭하여 $3\times3$ 최소자승(Least-Squares) CCM을 추출합니다.
* **🏁 24색 맥베스 컬러체커 모드**: 24색 표준 컬러카드의 네 모퉁이(좌상 ➡️ 우상 ➡️ 우하 ➡️ 좌하)를 순서대로 클릭하면 자동으로 Bilinear interpolation으로 24개 격자의 중앙 좌표를 매핑하여 초정밀 보정 행렬을 풉니다.

### 📷 렌즈 비네팅 주변부 광량 복원 (Lens Vignetting Correction)
* 스마트폰 카메라 모듈의 한계로 인해 모서리로 갈수록 광량이 저하되어 흙이 원래보다 어둡고 탁하게 측정됩니다.
* **비네팅 보정 슬라이더(0% ~ 50%)**를 조절하여 이미지 중심부로부터의 거리 제곱에 비례하는 밝기 보상 가인(Radial Gain)을 실시간으로 역적용합니다.

### 💧 토양 수분 상태별 색상 추정 및 자동 정규화 (Soil Moisture Estimator)
* 흙은 수분을 함유할 때(Moist)와 바짝 마를 때(Dry) 먼셀 명도가 보통 1.5 ~ 2.0 단위가량 크게 변화합니다.
* **💧 수분 상태별 색상 추정 패널**: 현재 스포이드로 측정된 칩의 수분 상태를 기준으로 상대 상태의 예측값과 먼셀 토색첩의 실물 칩 데이터베이스를 매칭하여 예상 색상을 실시간으로 렌즈 옆에 대조 시뮬레이션해 줍니다.
* **건조 측정 시 자동 습윤 정규화 기록**: 흙이 바짝 마른 상태에서 층위 야장을 저장하더라도, 체크박스를 켜두면 **자동으로 예측 습윤 칩을 역조회하여 기록에 남겨주므로** 조사의 일관성을 유지할 수 있습니다.

### 📚 인터랙티브 플로팅 가이드 위젯
* 프로그램 사용에 서툰 초심자나 보정 원리가 궁금한 전공자를 위해 이미지 뷰어 우측 하단에 접이식 **`정밀 보정 가이드`** 위젯이 제공됩니다. 이미지 조작과 동시에 조명 원리, CCM 수학식, 비네팅 감쇠 모형, $\Delta E_{2000}$ 색차 의미를 탭으로 실시간 대조하여 정독할 수 있습니다.

---

## 📁 디렉토리 구조 및 자산 설명

```
munsell_archaeology/
│
├── 📄 index.html                ← HTML5 기반 시맨틱 마크업 메인 애플리케이션
│
├── 🎨 css/
│   └── style.css                ← HSL 테마 토큰, 8비트 SVG 아이콘 정렬, 레이아웃
│
├── ⚙️ js/                        ← 독립 계산형 핵심 모듈 세트 (No-Dependency)
│   ├── illuminant.js            ← 🌈 D65/C 광원 정의 및 CIE XYZ ↔ Lab 변환
│   ├── chromAdapt.js            ← 🌡️ Bradford CAT 변환식 및 그레이카드 플랭크 궤적 추정
│   ├── ccmSolver.js             ← 🎨 6색/24색 최소자승 회귀 솔버 및 비네팅 Radial Gain 계산
│   ├── chipDatabase.js          ← 🗃️ 먼셀 토색첩 전체 칩 정보
│   ├── nearestChip.js           ← 📏 CIEDE2000 색차 매칭 알고리즘
│   ├── munsellConvert.js        ← 🎯 sRGB 입력을 분석하여 먼셀 코드 및 한글 색명 출력
│   ├── fieldRecord.js           ← 🗂️ USDA 및 한국 매장문화재 야장용 데이터 스키마
│   │
│   │                            ── 브라우저/UI 핸들러 ──
│   ├── pixelIcons.js            ← 👾 이모지를 8비트 픽셀아트로 렌더링하는 SVG 컴파일러
│   ├── imageView.js             ← 🔎 풀해상도 드로잉, 돋보기 렌더링, 줌/팬 좌표 역변환
│   ├── colorPicker.js           ← 🖼️ 클릭 조준 및 도구별 마우스 좌표 위임
│   ├── regionSelect.js          ← ▭ 다각형 영역 수집 및 L*/a*/b* 아웃라이어 트리밍 필터
│   ├── markers.js               ← 📌 마커 핀 리스트 렌더러
│   ├── layerOverlay.js          ← 🗺 이미지 단면 상에 확정 층위 번호 고정 오버레이
│   ├── desktopBridge.js         ← 🖥️ 데스크톱 셸 여부 판정 및 파일 다이얼로그 호출
│   ├── app.js                   ← 🔗 전역 애플리케이션 컨트롤러
│   └── vendor/munsell.min.js    ← 📦 munsell.js 라이브러리 오프라인 내장 패키지
│
├── 🖥️ desktop/                   ← Windows exe 패키저 (pywebview + PyInstaller)
│   ├── main.py · server.py · api.py · runtime_check.py
│   └── munsell_desktop.spec · build.bat · requirements.txt
│
└── 🧪 fixtures/                  ← 단위 검증 및 수학적 동등성 검증용 픽스처
     ├── roundtrip_test.html      ← 먼셀 변환 무손실 정밀도 테스트
     └── ccm_test.html            ← 6색/24색 CCM 복원 수학적 무결성 테스트
```

---

## 🔬 학술적 선대 연구 및 기술 참조문헌 (Academic References)

이 먼셀 토색 판별 도구가 지니는 학술적 정직성(Academic Honesty)과 신뢰도를 보증하기 위해, 보정과 연산 설계에 토대 된 핵심 선대 연구 목록을 기록합니다.

### 1. 먼셀 색체계의 수학적 정립 및 재표기
* **Newhall, S. M., Nickerson, D., & Judd, D. B. (1943).** *Final report of the O.S.A. subcommittee on the spacing of the Munsell colors.* Journal of the Optical Society of America, 33(7), 385-418.
  - 현대의 표준 먼셀 재표기(Munsell Renotation) 체계를 수립한 기념비적인 기본 논문으로, XYZ 색상 좌표와 먼셀 HVC 표기 간의 기준 격자를 제공합니다.

### 2. 색차 분석 공식 ($\Delta E_{2000}$)
* **Luo, M. R., Cui, G., & Rigg, B. (2001).** *The development of the CIE 2000 colour-difference formula: CIEDE2000.* Color Research & Application, 26(5), 340-348.
  - 인간 육안의 색 자각 비선형성(타원체 인지 오차)을 보정한 공식으로, 본 도구에서 스포이드 색상과 가장 가까운 먼셀 칩 간의 물리적 괴리를 계산하는 척도로 쓰입니다.

### 3. 카메라 색보정 매트릭스 (CCM) 및 선형 회귀
* **ISO 17321-1:2012.** *Graphic technology and photography — Colour characterisation of digital still cameras (DSCs).*
  - 디지털카메라의 분광 민감도(Spectral Sensitivity) 차이에 기인하는 원색 왜곡을 3x3 선형 보정 매트릭스를 활용해 보정하는 국제 표준 방법론의 기초가 됩니다.
* **Finlayson, G. D., Drew, M. S., & Lu, C. (2015).** *Entropy Minimization for Color Correction.*
  - 정밀 색상 보정을 위해 디지털 카메라 원시 센서 데이터를 최소자승법(Least-Squares Linear Regression)을 활용해 타깃 컬러 패치 좌표로 최적화하는 기하학적 정렬 원리입니다.

### 4. 크로마틱 어댑테이션 및 화이트 밸런스 (CIE CAT)
* **Lam, K. M. (1985).** *Metamerism and Colour Constancy under Chromatic Adaptation.* Ph.D. thesis, University of Bradford.
  - 현대 화이트 밸런스의 근간이 되는 Bradford 색채 적응 모델의 효시가 되는 연구입니다.
* **CIE 15:2018 Technical Report.** *Colorimetry, 4th Edition.* Commission Internationale de l'Eclairage.
  - 표준 D65 광원 및 가상의 Kelvin 온도에 기초한 흑체 플랑크 궤적(Planckian Locus) 화이트포인트를 수학적으로 유도하는 기준 식을 담고 있습니다.

### 5. 토양 수분 함량에 따른 먼셀 색상 변동성
* **Post, D. F., Fimbres, A., Matthias, A. D., Sano, E. E., Accioly, L., Batchily, A. K., & Ferreira, L. G. (2000).** *Predicting soil Munsell color from laboratory-measured organic carbon, iron oxide, and moisture contents.* Soil Science Society of America Journal, 64(3), 1027-1034.
  - 토양 내부의 유기물, 철산화물, 특히 **수분 함량의 점진적 변화**에 따라 Munsell Value(명도)와 Chroma(채도)가 비선형적으로 감쇠하는 현상을 측정하고 실험 통계를 제시한 핵심 자료입니다.
* **Soil Survey Technical Note 2.** *Munsell Soil Color Charts and Soil Moisture Shifts.* USDA National Soil Survey Center (NSSC).
  - 미국 농무성 기준 토양 샘플 분석에 있어서 야외 건조 상태의 측정치를 어떻게 표준 습윤 상태와 연동하여 표기하는지에 대한 현장 매뉴얼 가이드라인을 제공합니다.

### 6. 카메라 렌즈 비네팅 감쇠 모형
* **Kang, S. B., & Weiss, R. (2000).** *Can we calibrate vignetting from a single image?* Proceedings of IEEE Conference on Computer Vision and Pattern Recognition (CVPR), 2, 2-9.
  - 렌즈 중심 대각 거리의 코사인 4승 법칙($\cos^4 \phi$)과 방사형 감쇠를 단순 다항 가인으로 교정하는 수학 모델을 정립하여, 렌즈 주변부 왜곡을 보상하는 가인의 근간을 이룹니다.

---

## ⚖️ 라이선스

**MIT License** — 학술 연구, 발굴 조사, 개인 및 영리 목적 등 누구나 제한 없이 수정하고 재배포할 수 있습니다. 

```
✅ 개인 연구      ✅ 학술 논문 인용    ✅ 현장 실무 적용
✅ 자유로운 커스텀  ✅ 상업적 재배포     ✅ 타 야장 시스템과의 결합
```

자세한 조항은 [LICENSE](LICENSE) 파일을 참조해 주세요.

---

<div align="center">

🏺 **정확한 토색 기록, 매장유산 조사의 첫걸음입니다.**

*발굴 현장의 모든 연구자와 조사원들에게 과학적 신뢰를 제공하기 위해 오픈소스로 공개합니다.*

</div>

## Citation

이 저장소가 연구, 수업, 현장 업무에 도움이 되었다면 GitHub의 **Cite this repository** 버튼으로 인용해 주세요.

[![Cite this repository](https://img.shields.io/badge/Cite_this-repository-2ea44f?logo=github)](https://github.com/lzpxilfe/munsell_archaeology)
[![Star this repository](https://img.shields.io/github/stars/lzpxilfe/munsell_archaeology?style=social)](https://github.com/lzpxilfe/munsell_archaeology)

인용 메타데이터는 [CITATION.cff](CITATION.cff)에 보관합니다.

