# -*- mode: python ; coding: utf-8 -*-
# 먼셀 토색 판별기 — PyInstaller onefile spec
#
# 빌드:  python -m PyInstaller munsell_desktop.spec --noconfirm
# 산출:  dist/MunsellSoilColor.exe (포터블 단일 실행 파일)
#
# 주의:
#  - upx=False: 백신 오탐 완화
#  - console=False: 창 전용. 초기 오류는 main.py의 MessageBox로 표출됨.
#    문제 진단 시에는 콘솔 빌드(스파이크)로 다시 빌드해 --smoke 출력 확인.
#  - 웹 자산은 web/ 아래로 포함 → main.py의 asset_root()가
#    sys._MEIPASS/web 에서 찾는다.

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('../index.html', 'web'),
        ('../js', 'web/js'),
        ('../css', 'web/css'),
        ('../fixtures', 'web/fixtures'),
    ],
    hiddenimports=[
        'webview.platforms.edgechromium',
        'clr_loader',
        'pythonnet',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='MunsellSoilColor',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
