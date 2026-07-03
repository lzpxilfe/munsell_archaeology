"""
server.py — 로컬 HTTP 서버 (고정 포트)

pywebview 내장 서버는 실행마다 랜덤 포트를 쓰므로 origin이 바뀌어
localStorage(테마 등)가 매번 초기화된다. 고정 포트(점유 시 임시 포트 폴백)의
stdlib 서버로 웹 자산을 서빙해 origin을 안정시킨다.
"""

import functools
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PREFERRED_PORT = 17653
HOST = "127.0.0.1"


class _AssetHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # WebView2가 개발 중 이전 버전 자산을 캐시하지 않도록
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format, *args):  # noqa: A002 - stdlib signature
        pass


def start_server(root):
    """root 디렉터리를 서빙하는 데몬 서버를 시작하고 (httpd, port)를 반환한다."""
    handler = functools.partial(_AssetHandler, directory=str(root))
    try:
        httpd = ThreadingHTTPServer((HOST, PREFERRED_PORT), handler)
    except OSError:
        # 포트 점유(다른 인스턴스 등) 시 임시 포트로 폴백
        httpd = ThreadingHTTPServer((HOST, 0), handler)

    port = httpd.server_address[1]
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd, port
