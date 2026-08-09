# 여정 (Yeojeong) - 여행 정리

여행 경로를 세계 지도 위에 애니메이션으로 그려주는 웹.

방문한 도시를 순서대로 추가하면 구간마다 이동 수단 아이콘이 경로를 따라 움직이고, 완성된 경로는 영상으로 저장하거나 여행 요약 카드로 볼 수 있습니다.

**[ossca-thorvg.github.io/Yeojeong](https://ossca-thorvg.github.io/Yeojeong/)** 에서 바로 사용해볼 수 있습니다.

---

## 기능

| 기능 | 설명 |
| --- | --- |
| 도시 검색 | Mapbox Geocoding으로 도시 검색 |
| 이동 수단 | 비행기 · 배 · 기차 · 버스 · 자동차 · 자전거 · 도보 (구간별 지정) |
| 지도 테마 | 3종 기본 프리셋 + 바다 · 육지 · 라벨 색 커스텀 |
| 재생 제어 | 재생 · 일시정지 · 배속 · 진행 위치 이동 |
| 영상 내보내기 | `MediaRecorder`로 mp4 저장 (미지원 브라우저는 webm으로 자동 대체) |
| 여행 요약 | 총 거리, 방문 국가 · 도시 수, 이동 수단별 거리 비중을 리캡 카드(PNG)로 저장 |

## 기술 스택

- **Svelte 5** · **TypeScript** · **Vite**
- **ThorVG** (`@thorvg/webcanvas`) - 지도와 Lottie 애니메이션 캔버스 렌더링
- **Mapbox Search API**

## 시작하기

```bash
npm install

# .env.local 생성 후 VITE_MAPBOX_TOKEN 값 채우기
cp .env.example .env.local

npm run dev
```

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 (`dist/`) |
| `npm run preview` | 빌드 결과 로컬 미리보기 |
| `npm run check` | Svelte/TypeScript 타입 체크 |
| `npm run gen:map` | 세계 지도 데이터(TopoJSON) 재생성 |

> Mapbox 토큰은 빌드 시 번들에 그대로 삽입되므로, [Mapbox 콘솔](https://account.mapbox.com/access-tokens)에서 URL 제한을 걸어 두는 것을 권장합니다.

## 배포

`main` 브랜치에 푸시되면 GitHub Actions(`.github/workflows/deploy.yml`)가 자동으로 빌드하여 GitHub Pages([ossca-thorvg.github.io/Yeojeong](https://ossca-thorvg.github.io/Yeojeong/))에 배포합니다.
