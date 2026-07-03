"""
main.py — 먼셀 토색 판별기 데스크톱 앱 엔트리포인트

기존 웹앱(리포 루트의 index.html + js/ + css/)을 pywebview(WebView2) 창에
그대로 띄운다. PyInstaller onefile로 패키징하면 웹 자산은 sys._MEIPASS/web
아래에 풀린다.

실행:
    python desktop/main.py            # 개발 실행
    python desktop/main.py --debug    # 개발자 도구 + 콘솔 로그
    python desktop/main.py --smoke    # 8초 후 자동 종료 (스모크 테스트)
"""

import os
import sys
import threading
import traceback
from pathlib import Path

APP_TITLE = "먼셀 토색 판별기 — Munsell Soil Color Analyzer"
STORAGE_DIRNAME = "MunsellArchaeo"


def asset_root():
    """웹 자산 문서 루트: 개발 시 리포 루트, exe에서는 _MEIPASS/web."""
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS) / "web"
    return Path(__file__).resolve().parent.parent


def storage_dir():
    """WebView2 사용자 데이터(localStorage 등) 보관 위치.

    onefile exe의 임시 해제 폴더(_MEIxxxx)는 실행마다 바뀌므로
    반드시 %LOCALAPPDATA% 아래 고정 경로를 쓴다.
    """
    base = os.environ.get("LOCALAPPDATA") or str(Path.home())
    path = Path(base) / STORAGE_DIRNAME
    path.mkdir(parents=True, exist_ok=True)
    return path


def run(debug=False, smoke=False):
    from runtime_check import show_missing_runtime_dialog, webview2_version

    if webview2_version() is None:
        show_missing_runtime_dialog()
        return 1

    import webview

    from api import Api
    from server import start_server

    root = asset_root()
    index = root / "index.html"
    if not index.exists():
        raise FileNotFoundError(f"웹 자산을 찾을 수 없습니다: {index}")

    _httpd, port = start_server(root)

    # js_api 브리지가 실패해도 Blob 다운로드가 동작하도록 보조 경로 허용
    webview.settings["ALLOW_DOWNLOADS"] = True

    window = webview.create_window(
        APP_TITLE,
        f"http://127.0.0.1:{port}/index.html",
        js_api=Api(),
        width=1320,
        height=880,
        min_size=(980, 640),
    )

    if smoke:
        def _smoke_probe():
            try:
                report = window.evaluate_js(
                    "JSON.stringify((() => {"
                    "  const out = {"
                    "    title: document.title,"
                    "    app: typeof state !== 'undefined',"
                    "    convert: typeof MunsellConvert !== 'undefined',"
                    "    munsellLib: typeof munsell !== 'undefined',"
                    "    bridge: typeof DesktopBridge !== 'undefined' && DesktopBridge.isDesktop(),"
                    "  };"
                    "  out.globals = {"
                    "    Illuminant: typeof Illuminant, ChromAdapt: typeof ChromAdapt,"
                    "    NearestChip: typeof NearestChip, ChipDatabase: typeof ChipDatabase,"
                    "    FieldRecord: typeof FieldRecord, ColorPicker: typeof ColorPicker,"
                    "  };"
                    "  out.resources = performance.getEntriesByType('resource')"
                    "    .filter(r => r.name.includes('.js'))"
                    "    .map(r => r.name.split('/').pop() + ':' + (r.responseStatus ?? '?') + ':' + r.transferSize);"
                    "  try {"
                    "    const xhr = new XMLHttpRequest();"
                    "    xhr.open('GET', 'js/nearestChip.js', false);"
                    "    xhr.send();"
                    "    out.reevalStatus = xhr.status + ' len=' + xhr.responseText.length;"
                    "    (0, eval)(xhr.responseText.replace('const NearestChip', 'window.__NC'));"
                    "    out.reeval = typeof window.__NC;"
                    "  } catch (e) { out.reevalErr = String(e); }"
                    "  try {"
                    "    out.libRgb = munsell.munsellToRgb255('5YR 4/4');"
                    "    const r = converter.analyze(116, 88, 52);"
                    "    out.analyzeCode = r.code;"
                    "    out.fromLib = r.fromLib;"
                    "  } catch (e) { out.err = String(e && e.stack || e); }"
                    "  return out;"
                    "})())"
                )
                print("SMOKE:", report, flush=True)
            except Exception as e:
                print("SMOKE-ERROR:", e, flush=True)
            window.destroy()

        window.events.loaded += lambda: threading.Timer(3.0, _smoke_probe).start()
        threading.Timer(20.0, window.destroy).start()

    webview.start(
        debug=debug,
        private_mode=False,
        storage_path=str(storage_dir()),
    )
    return 0


def main():
    debug = "--debug" in sys.argv
    smoke = "--smoke" in sys.argv
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    try:
        return run(debug=debug, smoke=smoke)
    except Exception:
        message = traceback.format_exc()
        try:
            from runtime_check import show_fatal_error
            show_fatal_error(message)
        except Exception:
            pass
        print(message, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
