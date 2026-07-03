"""
api.py — Python <-> JS 브리지 (pywebview js_api)

웹앱의 js/desktopBridge.js가 window.pywebview.api.* 로 호출한다.
브라우저에서 index.html을 직접 열면 이 API 없이 기존 Blob 다운로드로 동작한다.
"""

import webview

_FILE_TYPES = {
    "text/csv": ("CSV 파일 (*.csv)", "모든 파일 (*.*)"),
    "application/json": ("JSON 파일 (*.json)", "모든 파일 (*.*)"),
}


class Api:
    def save_file(self, filename, content, mime="text/plain"):
        """
        네이티브 저장 대화상자를 띄우고 content를 UTF-8로 저장한다.
        반환: {'ok': True, 'path': str} 또는 {'ok': False, 'reason': str}
        """
        try:
            window = webview.windows[0]
            file_types = _FILE_TYPES.get(mime, ("모든 파일 (*.*)",))
            result = window.create_file_dialog(
                webview.SAVE_DIALOG,
                save_filename=filename,
                file_types=file_types,
            )
            if not result:
                return {"ok": False, "reason": "cancelled"}
            path = result[0] if isinstance(result, (list, tuple)) else result

            # 한글 CSV를 Excel에서 바로 열 수 있도록 UTF-8 BOM 부여
            if str(path).lower().endswith(".csv") and not content.startswith("\ufeff"):
                content = "\ufeff" + content

            with open(path, "w", encoding="utf-8", newline="") as f:
                f.write(content)
            return {"ok": True, "path": str(path)}
        except Exception as e:  # JS 쪽에서 토스트로 표시
            return {"ok": False, "reason": str(e)}

    def app_info(self):
        """데스크톱 셸 정보 (JS에서 데스크톱 모드 확인/표시용)."""
        import sys
        return {
            "desktop": True,
            "frozen": bool(getattr(sys, "frozen", False)),
            "python": sys.version.split()[0],
        }
