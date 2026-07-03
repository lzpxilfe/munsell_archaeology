"""
runtime_check.py — WebView2 Runtime 감지 및 미설치 안내

pywebview의 Windows 백엔드는 Edge WebView2 Runtime이 필요하다.
Windows 10/11 대부분에 기본 설치되어 있지만, 없는 PC에서는
레지스트리 확인 후 설치 안내를 띄운다.
"""

import ctypes
import webbrowser
import winreg

# Evergreen WebView2 Runtime의 클라이언트 GUID
_CLIENT_KEY = r"\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"

_REGISTRY_PATHS = [
    (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node" + _CLIENT_KEY),
    (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE" + _CLIENT_KEY),
    (winreg.HKEY_CURRENT_USER, r"SOFTWARE" + _CLIENT_KEY),
]

DOWNLOAD_URL = "https://developer.microsoft.com/microsoft-edge/webview2/"

MB_ICONERROR = 0x10
MB_YESNO = 0x04
IDYES = 6


def webview2_version():
    """설치된 WebView2 Runtime 버전 문자열, 없으면 None."""
    for hive, path in _REGISTRY_PATHS:
        try:
            with winreg.OpenKey(hive, path) as key:
                version, _ = winreg.QueryValueEx(key, "pv")
                if version and version != "0.0.0.0":
                    return version
        except OSError:
            continue
    return None


def show_missing_runtime_dialog():
    """WebView2 미설치 안내 + 다운로드 페이지 열기 여부 확인."""
    answer = ctypes.windll.user32.MessageBoxW(
        None,
        "이 프로그램은 Microsoft Edge WebView2 런타임이 필요합니다.\n"
        "(Windows 10/11 대부분에 기본 설치되어 있습니다)\n\n"
        "지금 다운로드 페이지를 여시겠습니까?",
        "먼셀 토색 판별기 — WebView2 필요",
        MB_ICONERROR | MB_YESNO,
    )
    if answer == IDYES:
        webbrowser.open(DOWNLOAD_URL)


def show_fatal_error(message):
    """콘솔 없는 exe에서 치명적 오류를 사용자에게 표시."""
    ctypes.windll.user32.MessageBoxW(
        None,
        f"프로그램 실행 중 오류가 발생했습니다:\n\n{message}",
        "먼셀 토색 판별기 — 오류",
        MB_ICONERROR,
    )
