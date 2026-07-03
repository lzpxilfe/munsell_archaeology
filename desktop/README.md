# 🖥️ 데스크톱 앱 (Windows exe)

기존 웹앱(리포 루트의 `index.html` + `js/` + `css/`)을 **pywebview**(Edge WebView2)
창에 그대로 띄우는 데스크톱 셸입니다. 웹앱 코드가 곧 데스크톱 앱 코드 —
별도 포팅 없이 단일 소스로 유지됩니다.

## 요구 사항

| 항목 | 내용 |
|---|---|
| OS | Windows 10 / 11 |
| WebView2 Runtime | 대부분 기본 설치됨. 없으면 실행 시 자동으로 안내 대화상자 표시 |
| Python (개발 시) | 3.12+ · `pip install -r requirements.txt` |
| Python (exe 사용자) | **불필요** — 단일 exe에 모두 포함 |

## 개발 실행

```bat
cd munsell_archaeology
python desktop\main.py            # 일반 실행
python desktop\main.py --debug    # 개발자 도구 열기
python desktop\main.py --smoke    # 자동 종단 테스트 후 종료 (CI/검증용)
```

`--smoke`는 합성 이미지 로드 → 스포이드 → 색온도 보정 → 영역 평균 →
그레이카드 → 마커 → 층위 승격까지 시뮬레이션하고 결과 JSON을 출력합니다
(콘솔 빌드/개발 실행에서만 출력이 보입니다).

## exe 빌드

```bat
cd desktop
build.bat
```

산출물: `desktop\dist\MunsellSoilColor.exe` (약 18MB, 포터블 — 설치 불필요, USB 이동 가능)

## 구조

```
desktop/
├── main.py              # 엔트리포인트: 자산 경로 해석, 창 생성, 스모크 테스트
├── server.py            # 고정 포트(127.0.0.1:17653) 로컬 HTTP 서버
│                        #   → origin 고정으로 localStorage(테마 등) 유지
├── api.py               # JS 브리지: save_file (CSV/JSON 네이티브 저장 대화상자)
├── runtime_check.py     # WebView2 Runtime 레지스트리 감지 + 설치 안내
├── requirements.txt
├── munsell_desktop.spec # PyInstaller onefile 설정
└── build.bat
```

## 설계 노트 / 알려진 함정

- **localStorage 유지**: pywebview 기본값은 private mode → `webview.start(private_mode=False,
  storage_path=%LOCALAPPDATA%\MunsellArchaeo)`로 명시. onefile 임시폴더(_MEIxxxx)에
  프로필이 생기지 않도록 하는 것도 이 설정이다.
- **파일 저장**: 웹앱의 `download()`는 데스크톱에서 `window.pywebview.api.save_file`
  (네이티브 저장 대화상자, CSV는 UTF-8 BOM으로 Excel 한글 호환)로 분기.
  브라우저에서 열면 기존 Blob 다운로드 그대로.
- **munsell.js**: CDN이 아닌 `js/vendor/munsell.min.js` 로컬 번들 → 완전 오프라인 동작.
- **백신 오탐**: onefile exe 특성상 일부 백신이 오탐할 수 있음 (upx 비활성으로 완화).
  문제 시 폴더 배포(onedir)로 전환 가능.
- **콘솔 없는 빌드에서의 진단**: 초기 예외는 MessageBox로 표시됨. 상세 진단이
  필요하면 spec에서 `console=True`로 바꿔 빌드 후 `--smoke` 출력 확인.
