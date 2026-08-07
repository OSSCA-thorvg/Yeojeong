<!-- Renders the interactive map canvas: world map, journey path, transport icon, zoom/pan, and follow-camera during playback. -->
<!-- 지도를 렌더링하는 캔버스 컴포넌트. 세계 지도, 여정 경로, 이동 수단 아이콘, 확대/이동, 재생 중 카메라 추적을 담당한다. -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Scene } from '@thorvg/webcanvas';
  import { getThorVG, type ThorVGModule } from './thorvg';
  import { buildWorldMap, buildCountryLabels, loadLabelFont } from './worldMap';
  import { buildJourneyPath, buildPulse, buildArrivalPin, currentMarkerState, type Bounds } from './journeyPath';
  import {
    journey,
    playbackProgress,
    isPlaying,
    playbackDuration,
    playbackSpeed,
    mapPalette,
    isExporting,
  } from './journey';
  import type { MapPalette } from './mapTheme';
  import {
    TRANSPORT_ANIMATION,
    TRANSPORT_ANIMATION_BASE_FACING,
    TRANSPORT_ANIMATION_SCALE,
    TRANSPORT_ANIMATION_ANCHOR,
    TRANSPORT_ANIMATION_SPEED,
  } from './transportAnimations';
  import type { MapProjection } from './projection';
  import type { JourneyStop, TransportMode } from './types';

  const canvasId = 'yeojeong-map-canvas';
  const iconCanvasId = 'yeojeong-icon-canvas';
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 8;
  const PULSE_PERIOD_MS = 1800;
  const FOLLOW_MIN_ZOOM = MIN_ZOOM;
  const FOLLOW_MAX_ZOOM = 40;
  const FOLLOW_FIT_RATIO = 0.8;
  const ICON_DISPLAY_ZOOM_CAP = MAX_ZOOM;
  const MARKER_BASE_PX_MIN = 22;
  const MARKER_BASE_PX_MAX = 56;
  const MARKER_REFERENCE_PX = 48;
  const ICON_PX = 512;
  const ICON_SPAN_RATIO_MIN = 0.1;
  const ICON_SPAN_RATIO_MAX = 0.2;
  const FOLLOW_EASE = 0.06;
  const FOLLOW_EASE_STEP_MS = 1000 / 60;
  const MAX_FRAME_MS = 100;

  let wrapEl: HTMLDivElement;
  let canvasEl: HTMLCanvasElement;
  let iconCanvasEl: HTMLCanvasElement;
  let TVG: ThorVGModule | undefined;
  let canvas: InstanceType<ThorVGModule['Canvas']> | undefined;
  let iconCanvas: InstanceType<ThorVGModule['Canvas']> | undefined;
  let iconAnimation: InstanceType<ThorVGModule['LottieAnimation']> | undefined;
  let iconAnimMode: TransportMode | undefined;
  let iconTotalFrames = 0;
  let iconFps = 30;
  let iconFrameCursor = 0;
  let iconRenderedFrame = -1;
  let rootScene: Scene | undefined;
  let worldMapScene: Scene | undefined;
  let labelScene: Scene | undefined;
  let journeyScene: Scene | undefined;
  let pulseScene: Scene | undefined;
  let pinScene: Scene | undefined;
  let projection: MapProjection | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let initError = '';
  let baseMapRafId: number | null = null;
  let resizeRafId: number | null = null;
  let pendingPalette: MapPalette | undefined;

  let canvasCenterX = 0;
  let canvasCenterY = 0;
  let mapHalfWidth = 0;
  let mapHalfHeight = 0;

  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartPanX = 0;
  let dragStartPanY = 0;
  let activePointers = new Map<number, PointerEvent>();
  let pinchStartDist = 0;
  let pinchStartZoom = 1;

  let pulseRafId: number | null = null;
  let lastPulseTime = 0;

  let iconVisible = false;
  let iconDir: 1 | -1 = 1;
  let iconX = 0;
  let iconY = 0;
  let iconSizePx = 0;

  let followZoomTarget = FOLLOW_MIN_ZOOM;

  // Returns how close the current follow-zoom target is to the far end of its range, as a 0-1 ratio.
  // 현재 카메라 추적 줌 목표가 원거리 쪽에 얼마나 가까운지 0~1 비율로 반환한다.
  function distanceFactor(): number {
    const span = FOLLOW_MAX_ZOOM - FOLLOW_MIN_ZOOM;
    return span > 0 ? Math.min(1, Math.max(0, (followZoomTarget - FOLLOW_MIN_ZOOM) / span)) : 0;
  }

  // Calculates the on-screen pixel size of the transport icon, based on canvas size and travel distance.
  // 캔버스 크기와 이동 거리에 따라 이동 수단 아이콘의 화면상 픽셀 크기를 계산한다.
  function iconDisplayPx(): number {
    const shortEdge = Math.min(canvasCenterX, canvasCenterY) * 2;
    const ratio = ICON_SPAN_RATIO_MIN + (ICON_SPAN_RATIO_MAX - ICON_SPAN_RATIO_MIN) * distanceFactor();
    return shortEdge * ratio;
  }

  // Calculates a scale factor that keeps markers and route lines a consistent on-screen size regardless of zoom.
  // 줌 배율과 무관하게 마커와 경로 선이 화면상 일정한 크기를 유지하도록 스케일 값을 계산한다.
  function markerVisualScale(): number {
    const markerBasePx = MARKER_BASE_PX_MAX - (MARKER_BASE_PX_MAX - MARKER_BASE_PX_MIN) * distanceFactor();
    return (markerBasePx * Math.min(zoom, ICON_DISPLAY_ZOOM_CAP)) / MARKER_REFERENCE_PX / zoom;
  }

  // Updates the camera's follow-zoom target so the current segment's bounds fit within the viewport.
  // 현재 구간의 경계가 화면 안에 들어오도록 카메라 추적 줌 목표를 갱신한다.
  function updateFollowZoomTargetForSegment(bounds: Bounds) {
    if (canvasCenterX === 0 || canvasCenterY === 0) return;
    const spanX = Math.max(bounds.maxX - bounds.minX, 1);
    const spanY = Math.max(bounds.maxY - bounds.minY, 1);
    const fitZoom = Math.min(
      (canvasCenterX * 2 * FOLLOW_FIT_RATIO) / spanX,
      (canvasCenterY * 2 * FOLLOW_FIT_RATIO) / spanY,
    );
    followZoomTarget = Math.min(FOLLOW_MAX_ZOOM, Math.max(FOLLOW_MIN_ZOOM, fitZoom));
  }

  // Loads and positions the Lottie animation for a transport mode on the icon canvas, replacing any previous one.
  // 이동 수단에 맞는 Lottie 애니메이션을 아이콘 캔버스에 불러와 배치하고, 이전 애니메이션은 교체한다.
  function ensureIconAnimation(mode: TransportMode) {
    if (!TVG || !iconCanvas || iconAnimMode === mode) return;
    if (iconAnimation) {
      iconCanvas.remove();
      iconAnimation.dispose();
      iconAnimation = undefined;
    }
    const animation = new TVG.LottieAnimation();
    animation.load(TRANSPORT_ANIMATION[mode]);
    const picture = animation.picture;
    if (!picture) return;
    const natural = picture.size();
    const fit = ((ICON_PX * 0.82) / Math.max(natural.width, natural.height, 1)) * TRANSPORT_ANIMATION_SCALE[mode];
    const w = natural.width * fit;
    const h = natural.height * fit;
    picture.size(w, h);
    const y = TRANSPORT_ANIMATION_ANCHOR[mode] === 'bottom' ? ICON_PX - h : (ICON_PX - h) / 2;
    picture.translate((ICON_PX - w) / 2, y);
    iconCanvas.add(picture);
    const info = animation.info();
    iconTotalFrames = info?.totalFrames ?? 0;
    iconFps = info?.fps || 30;
    iconFrameCursor = 0;
    iconRenderedFrame = -1;
    iconAnimation = animation;
    iconAnimMode = mode;
  }

  // Advances the icon's Lottie animation frame based on elapsed time and the mode's playback speed, skipping re-render if the frame didn't change.
  // 경과 시간과 이동 수단별 재생 속도에 따라 아이콘 애니메이션 프레임을 진행시키고, 프레임이 그대로면 렌더링을 생략한다.
  function advanceIconAnimation(mode: TransportMode, frameMs: number) {
    if (!iconAnimation || iconTotalFrames <= 0) return;
    const step = (frameMs / 1000) * iconFps * TRANSPORT_ANIMATION_SPEED[mode];
    iconFrameCursor = (iconFrameCursor + step) % iconTotalFrames;
    const next = Math.floor(iconFrameCursor);
    if (next === iconRenderedFrame) return;
    iconRenderedFrame = next;
    try {
      iconAnimation.frame(next);
    } catch {
    }
    iconCanvas?.update().render();
  }

  // Clamps a pan offset so the map can't be dragged past its edges at the current zoom level.
  // 현재 줌 배율에서 지도가 가장자리를 넘어 드래그되지 않도록 팬 오프셋을 제한한다.
  function clampPan(x: number, y: number): [number, number] {
    const slackX = mapHalfWidth * zoom - canvasCenterX;
    const slackY = mapHalfHeight * zoom - canvasCenterY;
    const clampedX = slackX > 0 ? Math.min(slackX, Math.max(-slackX, x)) : 0;
    const clampedY = slackY > 0 ? Math.min(slackY, Math.max(-slackY, y)) : 0;
    return [clampedX, clampedY];
  }

  // Applies the current zoom and pan as a scale/translate transform on the root scene.
  // 현재 줌과 팬 값을 루트 씬에 스케일/이동 변환으로 적용한다.
  function setCameraTransform() {
    rootScene?.scale(zoom);
    rootScene?.translate(canvasCenterX + panX, canvasCenterY + panY);
  }

  // Applies the camera transform and re-renders the map canvas.
  // 카메라 변환을 적용하고 지도 캔버스를 다시 렌더링한다.
  function applyTransform() {
    setCameraTransform();
    canvas?.update().render();
  }

  // Smoothly moves the camera's zoom and pan toward the current marker position, at a rate independent of frame rate.
  // 프레임레이트와 무관한 속도로 카메라의 줌과 팬을 현재 마커 위치 쪽으로 부드럽게 이동시킨다.
  function followCamera(at: { x: number; y: number }, frameMs: number) {
    const ease = 1 - Math.pow(1 - FOLLOW_EASE, frameMs / FOLLOW_EASE_STEP_MS);
    zoom += (followZoomTarget - zoom) * ease;
    const [targetX, targetY] = clampPan(-at.x * zoom, -at.y * zoom);
    panX = targetX;
    panY = targetY;
    setCameraTransform();
  }

  // Zooms the map to a new level while keeping the point under the pointer fixed in place.
  // 포인터 아래의 지점이 고정된 채로 유지되도록 지도를 새 배율로 확대/축소한다.
  function zoomAt(pointerX: number, pointerY: number, nextZoomRaw: number) {
    const localX = (pointerX - canvasCenterX - panX) / zoom;
    const localY = (pointerY - canvasCenterY - panY) / zoom;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoomRaw));
    const [x, y] = clampPan(pointerX - canvasCenterX - localX * newZoom, pointerY - canvasCenterY - localY * newZoom);
    zoom = newZoom;
    panX = x;
    panY = y;
    applyTransform();
  }

  // Returns the first two active pointers, used for pinch gestures.
  // 핀치 제스처에 사용할, 현재 활성화된 포인터 중 처음 두 개를 반환한다.
  function pinchPointers(): PointerEvent[] {
    return [...activePointers.values()].slice(0, 2);
  }

  // Calculates the distance and midpoint between the two pinch pointers, relative to the canvas.
  // 두 핀치 포인터 사이의 거리와 중간점을 캔버스 기준 좌표로 계산한다.
  function pinchMetrics(): { dist: number; midX: number; midY: number } | null {
    const [a, b] = pinchPointers();
    if (!a || !b) return null;
    const rect = canvasEl.getBoundingClientRect();
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    return {
      dist,
      midX: (a.clientX + b.clientX) / 2 - rect.left,
      midY: (a.clientY + b.clientY) / 2 - rect.top,
    };
  }

  // Starts a pinch-zoom gesture, recording the starting distance and zoom level.
  // 핀치 줌 제스처를 시작하며 시작 거리와 줌 배율을 기록한다.
  function beginPinch() {
    const metrics = pinchMetrics();
    if (!metrics || metrics.dist === 0) return;
    dragging = false;
    pinchStartDist = metrics.dist;
    pinchStartZoom = zoom;
  }

  // Starts a drag-to-pan gesture, recording the starting pointer position and pan offset.
  // 드래그로 지도를 이동시키는 제스처를 시작하며 시작 포인터 위치와 팬 오프셋을 기록한다.
  function beginDrag(e: PointerEvent) {
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartPanX = panX;
    dragStartPanY = panY;
  }

  // Handles pointer press: starts a pinch if two pointers are down, otherwise starts a drag.
  // 포인터가 눌렸을 때, 포인터가 두 개면 핀치를, 아니면 드래그를 시작한다.
  function onPointerDown(e: PointerEvent) {
    activePointers.set(e.pointerId, e);
    canvasEl.setPointerCapture(e.pointerId);
    if (activePointers.size >= 2) {
      beginPinch();
      return;
    }
    beginDrag(e);
  }

  // Handles pointer movement: updates pinch zoom or drag pan depending on the active gesture.
  // 포인터 이동을 처리한다. 진행 중인 제스처에 따라 핀치 줌 또는 드래그 팬을 갱신한다.
  function onPointerMove(e: PointerEvent) {
    if (activePointers.has(e.pointerId)) activePointers.set(e.pointerId, e);

    if (activePointers.size >= 2) {
      const metrics = pinchMetrics();
      if (!metrics || pinchStartDist === 0) return;
      zoomAt(metrics.midX, metrics.midY, (pinchStartZoom * metrics.dist) / pinchStartDist);
      return;
    }

    if (!dragging) return;
    const [x, y] = clampPan(dragStartPanX + (e.clientX - dragStartX), dragStartPanY + (e.clientY - dragStartY));
    panX = x;
    panY = y;
    applyTransform();
  }

  // Handles pointer release: ends the gesture, or drops back to single-finger drag if one pointer remains.
  // 포인터가 떼어졌을 때 제스처를 종료하고, 포인터가 하나 남으면 드래그로 전환한다.
  function onPointerUp(e: PointerEvent) {
    activePointers.delete(e.pointerId);
    if (canvasEl.hasPointerCapture(e.pointerId)) canvasEl.releasePointerCapture(e.pointerId);
    pinchStartDist = 0;
    if (activePointers.size === 1) {
      const [remaining] = activePointers.values();
      beginDrag(remaining);
      return;
    }
    dragging = false;
  }

  // Zooms in on double-click/double-tap, centered on the clicked point.
  // 더블클릭/더블탭 지점을 중심으로 지도를 확대한다.
  function onDoubleTap(e: MouseEvent) {
    const rect = canvasEl.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, zoom * 1.8);
  }

  // Zooms the map with the scroll wheel, centered on the cursor position.
  // 휠 스크롤로 지도를 확대/축소한다. 커서 위치를 중심으로 확대/축소된다.
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const rect = canvasEl.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, zoom * Math.exp(-e.deltaY * 0.001));
  }

  // Rebuilds the world map and country label scenes with a given color palette, replacing the previous ones.
  // 주어진 색상 팔레트로 세계 지도와 국가 라벨 씬을 다시 만들고, 기존 씬은 교체한다.
  function buildBaseMap(palette: MapPalette) {
    if (!TVG || !rootScene || !projection) return;
    if (worldMapScene) {
      rootScene.remove(worldMapScene);
      worldMapScene.dispose();
    }
    if (labelScene) {
      rootScene.remove(labelScene);
      labelScene.dispose();
    }
    worldMapScene = buildWorldMap(TVG, projection, palette);
    labelScene = buildCountryLabels(TVG, projection, palette);
    rootScene.add(worldMapScene);
    rootScene.add(labelScene);
  }

  // Schedules a base map rebuild on the next animation frame, coalescing repeated palette changes into one rebuild.
  // 다음 애니메이션 프레임에 지도를 다시 그리도록 예약한다. 연속된 팔레트 변경은 한 번의 재구성으로 합친다.
  function scheduleBaseMap(palette: MapPalette) {
    pendingPalette = palette;
    if (baseMapRafId !== null) return;
    baseMapRafId = requestAnimationFrame(() => {
      baseMapRafId = null;
      if (!pendingPalette) return;
      buildBaseMap(pendingPalette);
      pendingPalette = undefined;
      applyTransform();
    });
  }

  // Schedules a resize handler on the next animation frame, coalescing repeated resize events.
  // 다음 애니메이션 프레임에 리사이즈 처리를 예약한다. 연속된 리사이즈 이벤트를 하나로 합친다.
  function scheduleResize() {
    if (resizeRafId !== null) return;
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = null;
      handleResize();
    });
  }

  // Resizes the canvas and recalculates the map projection, pan bounds, and scenes to fit the new size.
  // 캔버스 크기를 조정하고 새 크기에 맞춰 지도 투영, 팬 범위, 씬을 다시 계산한다.
  function handleResize() {
    if (!TVG || !canvas || !projection || !wrapEl) return;
    const width = wrapEl.clientWidth;
    const height = wrapEl.clientHeight;
    if (width === 0 || height === 0) return;

    canvas.resize(width, height);
    canvasCenterX = width / 2;
    canvasCenterY = height / 2;
    projection.scale = Math.min(width / 360, height / 180) * 0.92;
    mapHalfWidth = 180 * projection.scale;
    mapHalfHeight = 90 * projection.scale;

    const [x, y] = clampPan(panX, panY);
    panX = x;
    panY = y;

    scheduleBaseMap($mapPalette);
    updateJourneyScene($journey, $playbackProgress, $mapPalette.accent);
    applyTransform();
  }

  // Rebuilds the journey route scene for the current stops and playback progress, replacing the previous one.
  // 현재 정거장과 재생 진행률에 맞춰 여정 경로 씬을 다시 만들고, 기존 씬은 교체한다.
  function updateJourneyScene(stops: JourneyStop[], progress: number, accent: [number, number, number]) {
    if (!TVG || !rootScene || !projection) return;
    const nextScene = buildJourneyPath(TVG, stops, progress, projection, accent, markerVisualScale());
    if (journeyScene) {
      rootScene.remove(journeyScene);
      journeyScene.dispose();
    }
    journeyScene = nextScene;
    rootScene.add(journeyScene);
    canvas?.update().render();
  }

  $: if (rootScene) updateJourneyScene($journey, $playbackProgress, $mapPalette.accent);

  $: if (rootScene && projection) scheduleBaseMap($mapPalette);

  // Per-frame loop: updates the camera, and draws the pulse ring, transport icon, or arrival pin at the marker's current position.
  // 매 프레임 실행되는 루프. 카메라를 갱신하고, 마커의 현재 위치에 펄스 링, 이동 수단 아이콘, 또는 도착 핀을 그린다.
  function pulseTick(time: number) {
    pulseRafId = requestAnimationFrame(pulseTick);
    const frameMs = lastPulseTime === 0 ? FOLLOW_EASE_STEP_MS : Math.min(time - lastPulseTime, MAX_FRAME_MS);
    lastPulseTime = time;
    if (!TVG || !rootScene || !projection) return;
    const state = currentMarkerState($journey, $playbackProgress, projection);
    if (state) updateFollowZoomTargetForSegment(state.bounds);

    if ($isPlaying && state) followCamera(state.at, frameMs);

    if (pulseScene) {
      rootScene.remove(pulseScene);
      pulseScene.dispose();
      pulseScene = undefined;
    }
    if (pinScene) {
      rootScene.remove(pinScene);
      pinScene.dispose();
      pinScene = undefined;
    }
    const hasStarted = $isPlaying || $playbackProgress > 0;
    if (!state || !hasStarted) {
      iconVisible = false;
      return;
    }

    const arrived = $journey.length >= 2 && $playbackProgress >= 1;
    if (arrived) {
      iconVisible = false;
      pinScene = buildArrivalPin(TVG, state.at, markerVisualScale());
      rootScene.add(pinScene);
      canvas?.update().render();
      return;
    }

    const phase = (time % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
    pulseScene = buildPulse(TVG, state.at, phase, $mapPalette.accent, markerVisualScale());
    rootScene.add(pulseScene);
    canvas?.update().render();

    ensureIconAnimation(state.mode);
    iconVisible = true;
    iconDir = (state.dirX * TRANSPORT_ANIMATION_BASE_FACING[state.mode]) as 1 | -1;
    iconX = canvasCenterX + panX + state.at.x * zoom;
    iconY = canvasCenterY + panY + state.at.y * zoom;
    iconSizePx = iconDisplayPx();
    advanceIconAnimation(state.mode, frameMs);
  }

  const EXPORT_FPS = 30;
  /** 마지막 진행 단계 이후에도 녹화를 이어가 도착 장면까지 파일에 담기 위한 여유 시간 */
  const EXPORT_TAIL_MS = 1800;

  // Picks the first video MIME type the browser supports, for exporting the journey video.
  // 여정 영상을 내보낼 때 사용할, 브라우저가 지원하는 첫 번째 비디오 MIME 타입을 고른다.
  function pickExportMimeType(): string {
    const candidates = [
      'video/mp4;codecs=avc1.640028',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    for (const type of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'video/webm';
  }

  // Plays back the journey while recording the composited map and icon canvases into a downloadable video file.
  // 여정을 재생하면서 지도와 아이콘 캔버스를 합성해 다운로드 가능한 영상 파일로 녹화한다.
  export function exportVideo() {
    if (!wrapEl || !canvasEl || !iconCanvasEl || $isExporting) return;
    if ($journey.length < 2) return;

    isExporting.set(true);
    isPlaying.set(false);

    zoom = MIN_ZOOM;
    panX = 0;
    panY = 0;
    applyTransform();
    playbackProgress.set(0);

    const width = wrapEl.clientWidth;
    const height = wrapEl.clientHeight;

    const pixelRatio = width > 0 ? canvasEl.width / width : 1;
    const outWidth = Math.round((width * pixelRatio) / 2) * 2;
    const outHeight = Math.round((height * pixelRatio) / 2) * 2;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = outWidth;
    exportCanvas.height = outHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) {
      isExporting.set(false);
      return;
    }
    ctx.imageSmoothingQuality = 'high';
    const scaleX = outWidth / width;
    const scaleY = outHeight / height;

    const outStream = exportCanvas.captureStream(EXPORT_FPS);
    const mimeType = pickExportMimeType();
    const bitrate = Math.round(outWidth * outHeight * EXPORT_FPS * 0.25);
    const recorder = new MediaRecorder(outStream, { mimeType, videoBitsPerSecond: bitrate });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    let compositeRafId = 0;
    let lastTime = 0;
    const durationMs = $playbackDuration;
    const speed = $playbackSpeed;

    // Draws the current map canvas and transport icon onto the export canvas for one frame.
    // 지도 캔버스와 이동 수단 아이콘을 내보내기용 캔버스에 한 프레임 그린다.
    function compositeFrame() {
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.clearRect(0, 0, outWidth, outHeight);
      // 아이콘 위치가 화면과 일치하도록 CSS 픽셀 좌표계로 그리기
      ctx!.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      ctx!.drawImage(canvasEl, 0, 0, width, height);
      if (iconVisible) {
        const size = iconSizePx;
        const anchorBottom = iconAnimMode && TRANSPORT_ANIMATION_ANCHOR[iconAnimMode] === 'bottom';
        ctx!.save();
        ctx!.translate(iconX, iconY);
        ctx!.scale(iconDir, 1);
        ctx!.drawImage(iconCanvasEl, -size / 2, anchorBottom ? -size : -size / 2, size, size);
        ctx!.restore();
      }
      compositeRafId = requestAnimationFrame(compositeFrame);
    }

    // Stops the compositing loop and the media recorder.
    // 합성 루프와 미디어 레코더를 정지한다.
    function finish() {
      cancelAnimationFrame(compositeRafId);
      recorder.stop();
    }

    // Advances playback progress each frame during export, finishing (with a tail delay) once it reaches the end.
    // 내보내기 중 매 프레임 재생 진행률을 진행시키고, 끝에 도달하면 여유 시간 후 종료한다.
    function progressTick(time: number) {
      const elapsed = lastTime === 0 ? 0 : time - lastTime;
      lastTime = time;
      let done = false;
      playbackProgress.update((p) => {
        const next = p + (elapsed * speed) / durationMs;
        if (next >= 1) {
          done = true;
          return 1;
        }
        return next;
      });
      if (done) {
        setTimeout(finish, EXPORT_TAIL_MS);
        return;
      }
      requestAnimationFrame(progressTick);
    }

    recorder.onstop = () => {
      outStream.getTracks().forEach((t) => t.stop());

      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mimeType.includes('mp4') ? '여정.mp4' : '여정.webm';
      a.click();
      URL.revokeObjectURL(url);

      isPlaying.set(false);
      isExporting.set(false);
    };

    isPlaying.set(true);
    recorder.start();
    compositeRafId = requestAnimationFrame(compositeFrame);
    requestAnimationFrame(progressTick);
  }

  onMount(async () => {
    try {
      TVG = await getThorVG();
    } catch {
      initError = '지도를 그릴 수 없어요. 브라우저를 최신 버전으로 업데이트한 뒤 새로고침해 주세요';
      return;
    }
    const width = wrapEl.clientWidth || 1;
    const height = wrapEl.clientHeight || 1;
    canvas = new TVG.Canvas(`#${canvasId}`, { width, height });
    iconCanvas = new TVG.Canvas(`#${iconCanvasId}`, { width: ICON_PX, height: ICON_PX });

    projection = { centerX: 0, centerY: 0, scale: 1 };

    await loadLabelFont(TVG);

    rootScene = new TVG.Scene();
    canvas.add(rootScene);
    handleResize();
    resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(wrapEl);

    pulseRafId = requestAnimationFrame(pulseTick);
  });

  onDestroy(() => {
    if (pulseRafId !== null) cancelAnimationFrame(pulseRafId);
    if (baseMapRafId !== null) cancelAnimationFrame(baseMapRafId);
    if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
    resizeObserver?.disconnect();
    rootScene?.dispose();
    canvas?.destroy();
    iconAnimation?.dispose();
    iconCanvas?.destroy();
  });
</script>

<div class="map-wrap" bind:this={wrapEl}>
  <canvas
    bind:this={canvasEl}
    id={canvasId}
    class="map-canvas"
    on:pointerdown={onPointerDown}
    on:pointermove={onPointerMove}
    on:pointerup={onPointerUp}
    on:pointercancel={onPointerUp}
    on:dblclick={onDoubleTap}
    on:wheel={onWheel}
  ></canvas>
  <canvas
    bind:this={iconCanvasEl}
    id={iconCanvasId}
    class="mode-icon"
    class:mode-icon--hidden={!iconVisible}
    style="width: {ICON_PX}px; height: {ICON_PX}px; transform: translate({iconX}px, {iconY}px) scale({iconSizePx / ICON_PX}) scaleX({iconDir}) translate(-50%, {iconAnimMode && TRANSPORT_ANIMATION_ANCHOR[iconAnimMode] === 'bottom' ? '-100%' : '-50%'});"
  ></canvas>
  {#if initError}
    <div class="init-error" role="alert">{initError}</div>
  {/if}
</div>

<style>
  .map-wrap {
    position: relative;
    width: 100%;
    height: 100%;
  }
  .map-canvas {
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .mode-icon {
    position: absolute;
    left: 0;
    top: 0;
    transform-origin: 0 0;
    pointer-events: none;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
    z-index: 5;
    transition: opacity 0.15s ease;
  }
  .mode-icon--hidden {
    opacity: 0;
  }
  .init-error {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    max-width: min(360px, calc(100% - 32px));
    text-align: center;
    line-height: 1.5;
    font-size: 14px;
    color: #1d1d1f;
    background: rgba(255, 255, 255, 0.9);
    padding: 16px 20px;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
    z-index: 6;
  }
</style>
