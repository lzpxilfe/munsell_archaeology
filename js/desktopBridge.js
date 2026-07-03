/**
 * desktopBridge.js
 * ─────────────────────────────────────────────────────────────────────
 * pywebview 데스크톱 셸 감지 + 네이티브 파일 저장 브리지
 *
 * 데스크톱 앱(desktop/main.py)에서 실행되면 window.pywebview.api가
 * 비동기로 주입된다('pywebviewready' 이벤트). 브라우저에서 index.html을
 * 직접 열면 이 모듈은 아무 일도 하지 않고, 호출부는 기존 Blob 다운로드로
 * 폴백한다.
 * ─────────────────────────────────────────────────────────────────────
 */

const DesktopBridge = (() => {
  let ready = false;

  window.addEventListener('pywebviewready', () => { ready = true; });

  function isDesktop() {
    return ready && !!(window.pywebview && window.pywebview.api);
  }

  /**
   * 네이티브 저장 대화상자로 파일 저장
   * @returns {Promise<{ok:boolean, path?:string, reason?:string}>}
   */
  async function saveFile(filename, content, mime) {
    return window.pywebview.api.save_file(filename, content, mime);
  }

  return { isDesktop, saveFile };
})();
