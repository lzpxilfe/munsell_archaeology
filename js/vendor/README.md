# js/vendor

## munsell.min.js

- **원본**: [privet-kitty/munsell.js](https://github.com/privet-kitty/munsell.js) v1.1.6 (MIT License)
- **생성 방법**: npm 패키지에는 브라우저용 단일 번들이 없으므로, jsDelivr의 자동 ESM 번들을
  내려받아 전역 `window.munsell`을 노출하는 클래식 스크립트로 변환했다.

  ```
  1. https://cdn.jsdelivr.net/npm/munsell@<버전>/+esm 다운로드
  2. 말미의 export{...} 문을 window.munsell = {...} 할당으로 치환
  3. 전체를 IIFE로 감싸 전역 오염 방지
  ```

  변환 스크립트: 저장소에 포함하지 않음 — 절차가 위 3단계뿐이므로 갱신 시 재작성해도 된다.

- **갱신 시 주의**: `+esm` 번들에 외부 `import`(다른 /npm/ URL)나 `import.meta`가
  없는지 확인할 것. 있으면 이 변환은 동작하지 않는다.
