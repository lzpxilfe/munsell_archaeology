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
        E2E_JS = """
        (async () => {
          const out = {
            title: document.title,
            munsellLib: typeof munsell !== 'undefined',
            bridge: typeof DesktopBridge !== 'undefined' && DesktopBridge.isDesktop(),
          };
          try {
            // 합성 이미지: 10YR 4/3 정답색 배경
            const c = document.createElement('canvas');
            c.width = 200; c.height = 100;
            const cx = c.getContext('2d');
            cx.fillStyle = 'rgb(115,92,64)';
            cx.fillRect(0, 0, 200, 100);
            const img = new Image();
            await new Promise(res => { img.onload = res; img.src = c.toDataURL(); });

            showCanvas();
            state.image = img;
            picker.setImage(img, currentCorrectFn());
            out.loaded = picker.hasImage;

            // 스포이드 시뮬레이션 (D65 — 보정 없음)
            const pair = picker.samplePair(50, 50);
            out.sample = [pair.r, pair.g, pair.b];
            handleColorPick(pair);
            out.code = state.currentResult.code;
            out.fromLib = state.currentResult.fromLib;

            // 조명 3200K: 보정본과 raw가 달라야 함
            setLighting(3200);
            const p2 = picker.samplePair(50, 50);
            out.corrected3200 = [p2.r, p2.g, p2.b];
            out.raw3200 = [p2.raw.r, p2.raw.g, p2.raw.b];
            setLighting(6504);

            // 영역 평균 (사각형) — 툴바 흐름과 동일한 진입점
            const avg = RegionStats.averageRect(picker.view.correctedImageData, 10, 10, 150, 80);
            handleRegionResult(avg, { kind: 'rect', geometry: { x0: 10, y0: 10, x1: 150, y1: 80 } });
            out.regionCode = state.currentResult.code;
            out.regionUsed = state.currentResult.sampleStats.used;
            out.statsShown = document.getElementById('sample-stats').style.display !== 'none';

            // 줌/팬
            picker.view.zoomAt(100, 50, 2);
            out.zoom = picker.view.zoomFactor;
            picker.view.panBy(10, 10);
            picker.view.render();
            out.ok = true;
          } catch (e) { out.err = String(e && e.stack || e); }
          window.__smokeResult = out;
        })()
        """

        def _smoke_collect():
            try:
                report = window.evaluate_js(
                    "JSON.stringify(window.__smokeResult || {pending: true})")
                print("SMOKE:", report, flush=True)
            except Exception as e:
                print("SMOKE-ERROR:", e, flush=True)
            window.destroy()

        def _smoke_start():
            try:
                window.evaluate_js(E2E_JS)
            except Exception as e:
                print("SMOKE-ERROR(start):", e, flush=True)
            threading.Timer(3.0, _smoke_collect).start()

        window.events.loaded += lambda: threading.Timer(2.5, _smoke_start).start()
        threading.Timer(25.0, window.destroy).start()

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
