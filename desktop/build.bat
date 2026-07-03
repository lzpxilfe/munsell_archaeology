@echo off
rem ─────────────────────────────────────────────────────────────
rem 먼셀 토색 판별기 — 포터블 exe 빌드 스크립트
rem 사용법: desktop 폴더에서 build.bat 실행 (또는 더블클릭)
rem 산출물: desktop\dist\MunsellSoilColor.exe
rem ─────────────────────────────────────────────────────────────
cd /d "%~dp0"

echo [1/3] 의존성 설치...
python -m pip install -r requirements.txt --quiet
if errorlevel 1 goto :error

echo [2/3] PyInstaller 빌드...
python -m PyInstaller munsell_desktop.spec --noconfirm
if errorlevel 1 goto :error

echo [3/3] 완료!
echo.
echo   산출물: %~dp0dist\MunsellSoilColor.exe
echo.
pause
exit /b 0

:error
echo.
echo 빌드 실패 — 위 오류 메시지를 확인하세요.
pause
exit /b 1
