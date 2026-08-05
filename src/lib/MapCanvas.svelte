<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Scene } from '@thorvg/webcanvas';
  import { getThorVG, type ThorVGModule } from './thorvg';
  import { buildWorldMap, buildCountryLabels, loadLabelFont } from './worldMap';
  import { buildJourneyPath, buildPulse, buildArrivalPin, currentMarkerState, type Point } from './journeyPath';
  import { journey, playbackProgress, isPlaying, currentTheme, isExporting } from './journey';
  import { MAP_PALETTES } from './mapTheme';
  import {
    TRANSPORT_ANIMATION,
    TRANSPORT_ANIMATION_BASE_FACING,
    TRANSPORT_ANIMATION_SCALE,
    TRANSPORT_ANIMATION_ANCHOR,
  } from './transportAnimations';
  import type { MapProjection } from './projection';
  import type { JourneyStop, TransportMode } from './types';

  const canvasId = 'yeojeong-map-canvas';
  const iconCanvasId = 'yeojeong-icon-canvas';
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 8;
  const PULSE_PERIOD_MS = 1800;
  const FOLLOW_MIN_ZOOM = 3;
  const FOLLOW_MAX_ZOOM = 40;
  const FOLLOW_FIT_RATIO = 0.8;
  const ICON_DISPLAY_ZOOM_CAP = MAX_ZOOM;
  const ICON_BASE_PX_MIN = 100;
  const ICON_BASE_PX_MAX = 200;
  const MARKER_BASE_PX_MIN = 22;
  const MARKER_BASE_PX_MAX = 56;
  const MARKER_REFERENCE_PX = 48;
  const ICON_PX = ICON_BASE_PX_MAX * ICON_DISPLAY_ZOOM_CAP;
  const FOLLOW_EASE = 0.06;

  let wrapEl: HTMLDivElement;
  let canvasEl: HTMLCanvasElement;
  let iconCanvasEl: HTMLCanvasElement;
  let TVG: ThorVGModule | undefined;
  let canvas: InstanceType<ThorVGModule['Canvas']> | undefined;
  let iconCanvas: InstanceType<ThorVGModule['Canvas']> | undefined;
  let iconAnimation: InstanceType<ThorVGModule['LottieAnimation']> | undefined;
  let iconAnimMode: TransportMode | undefined;
  let rootScene: Scene | undefined;
  let worldMapScene: Scene | undefined;
  let labelScene: Scene | undefined;
  let journeyScene: Scene | undefined;
  let pulseScene: Scene | undefined;
  let pinScene: Scene | undefined;
  let projection: MapProjection | undefined;
  let resizeObserver: ResizeObserver | undefined;

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

  let pulseRafId: number | null = null;

  let iconVisible = false;
  let iconDir: 1 | -1 = 1;
  let iconX = 0;
  let iconY = 0;

  let followZoomTarget = FOLLOW_MIN_ZOOM;

  function distanceFactor(): number {
    const span = FOLLOW_MAX_ZOOM - FOLLOW_MIN_ZOOM;
    return span > 0 ? Math.min(1, Math.max(0, (followZoomTarget - FOLLOW_MIN_ZOOM) / span)) : 0;
  }

  function iconBasePx(): number {
    return ICON_BASE_PX_MAX - (ICON_BASE_PX_MAX - ICON_BASE_PX_MIN) * distanceFactor();
  }

  function iconDisplayPx(): number {
    return iconBasePx() * Math.min(zoom, ICON_DISPLAY_ZOOM_CAP);
  }

  function markerVisualScale(): number {
    const markerBasePx = MARKER_BASE_PX_MAX - (MARKER_BASE_PX_MAX - MARKER_BASE_PX_MIN) * distanceFactor();
    return (markerBasePx * Math.min(zoom, ICON_DISPLAY_ZOOM_CAP)) / MARKER_REFERENCE_PX / zoom;
  }

  function updateFollowZoomTargetForSegment(from: Point, to: Point) {
    if (canvasCenterX === 0 || canvasCenterY === 0) return;
    const spanX = Math.max(Math.abs(to.x - from.x), 1);
    const spanY = Math.max(Math.abs(to.y - from.y), 1);
    const fitZoom = Math.min(
      (canvasCenterX * 2 * FOLLOW_FIT_RATIO) / spanX,
      (canvasCenterY * 2 * FOLLOW_FIT_RATIO) / spanY,
    );
    followZoomTarget = Math.min(FOLLOW_MAX_ZOOM, Math.max(FOLLOW_MIN_ZOOM, fitZoom));
  }

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
    animation.setLoop(true).play(() => iconCanvas?.update().render());
    iconAnimation = animation;
    iconAnimMode = mode;
  }

  function clampPan(x: number, y: number): [number, number] {
    const slackX = mapHalfWidth * zoom - canvasCenterX;
    const slackY = mapHalfHeight * zoom - canvasCenterY;
    const clampedX = slackX > 0 ? Math.min(slackX, Math.max(-slackX, x)) : 0;
    const clampedY = slackY > 0 ? Math.min(slackY, Math.max(-slackY, y)) : 0;
    return [clampedX, clampedY];
  }

  function setCameraTransform() {
    rootScene?.scale(zoom);
    rootScene?.translate(canvasCenterX + panX, canvasCenterY + panY);
  }

  function applyTransform() {
    setCameraTransform();
    canvas?.update().render();
  }

  function followCamera(at: { x: number; y: number }) {
    zoom += (followZoomTarget - zoom) * FOLLOW_EASE;
    const [targetX, targetY] = clampPan(-at.x * zoom, -at.y * zoom);
    panX = targetX;
    panY = targetY;
    setCameraTransform();
  }

  function onPointerDown(e: PointerEvent) {
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartPanX = panX;
    dragStartPanY = panY;
    canvasEl.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const [x, y] = clampPan(dragStartPanX + (e.clientX - dragStartX), dragStartPanY + (e.clientY - dragStartY));
    panX = x;
    panY = y;
    applyTransform();
  }

  function onPointerUp(e: PointerEvent) {
    dragging = false;
    canvasEl.releasePointerCapture(e.pointerId);
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const rect = canvasEl.getBoundingClientRect();
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;

    const localX = (pointerX - canvasCenterX - panX) / zoom;
    const localY = (pointerY - canvasCenterY - panY) / zoom;

    const factor = Math.exp(-e.deltaY * 0.001);
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));

    const [x, y] = clampPan(pointerX - canvasCenterX - localX * newZoom, pointerY - canvasCenterY - localY * newZoom);
    zoom = newZoom;
    panX = x;
    panY = y;
    applyTransform();
  }

  function buildBaseMap(theme: 'light' | 'sepia' | 'dark') {
    if (!TVG || !rootScene || !projection) return;
    const palette = MAP_PALETTES[theme];
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

    buildBaseMap($currentTheme);
    updateJourneyScene($journey, $playbackProgress, MAP_PALETTES[$currentTheme].accent);
    applyTransform();
  }

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

  $: if (rootScene) updateJourneyScene($journey, $playbackProgress, MAP_PALETTES[$currentTheme].accent);

  $: if (rootScene && projection) {
    buildBaseMap($currentTheme);
    applyTransform();
  }

  function pulseTick(time: number) {
    pulseRafId = requestAnimationFrame(pulseTick);
    if (!TVG || !rootScene || !projection) return;
    const state = currentMarkerState($journey, $playbackProgress, projection);
    if (state) updateFollowZoomTargetForSegment(state.from, state.to);

    if ($isPlaying && state) followCamera(state.at);

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
    pulseScene = buildPulse(TVG, state.at, phase, MAP_PALETTES[$currentTheme].accent, markerVisualScale());
    rootScene.add(pulseScene);
    canvas?.update().render();

    ensureIconAnimation(state.mode);
    iconVisible = true;
    iconDir = (state.dirX * TRANSPORT_ANIMATION_BASE_FACING[state.mode]) as 1 | -1;
    iconX = canvasCenterX + panX + state.at.x * zoom;
    iconY = canvasCenterY + panY + state.at.y * zoom;
  }

  const EXPORT_DURATION_MS = 18000;
  const EXPORT_FPS = 30;

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

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) {
      isExporting.set(false);
      return;
    }

    const outStream = exportCanvas.captureStream(EXPORT_FPS);
    const mimeType = pickExportMimeType();
    const recorder = new MediaRecorder(outStream, { mimeType, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    let compositeRafId = 0;
    let lastTime = 0;

    function compositeFrame() {
      ctx!.clearRect(0, 0, width, height);
      ctx!.drawImage(canvasEl, 0, 0, width, height);
      if (iconVisible) {
        const size = iconDisplayPx();
        const anchorBottom = iconAnimMode && TRANSPORT_ANIMATION_ANCHOR[iconAnimMode] === 'bottom';
        ctx!.save();
        ctx!.translate(iconX, iconY);
        ctx!.scale(iconDir, 1);
        ctx!.drawImage(iconCanvasEl, -size / 2, anchorBottom ? -size : -size / 2, size, size);
        ctx!.restore();
      }
      compositeRafId = requestAnimationFrame(compositeFrame);
    }

    function finish() {
      cancelAnimationFrame(compositeRafId);
      recorder.stop();
    }

    function progressTick(time: number) {
      const elapsed = lastTime === 0 ? 0 : time - lastTime;
      lastTime = time;
      let done = false;
      playbackProgress.update((p) => {
        const next = p + elapsed / EXPORT_DURATION_MS;
        if (next >= 1) {
          done = true;
          return 1;
        }
        return next;
      });
      if (done) {
        finish();
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

      isExporting.set(false);
    };

    isPlaying.set(true);
    recorder.start();
    compositeRafId = requestAnimationFrame(compositeFrame);
    requestAnimationFrame(progressTick);
  }

  onMount(async () => {
    TVG = await getThorVG();
    const width = wrapEl.clientWidth || 1;
    const height = wrapEl.clientHeight || 1;
    canvas = new TVG.Canvas(`#${canvasId}`, { width, height });
    iconCanvas = new TVG.Canvas(`#${iconCanvasId}`, { width: ICON_PX, height: ICON_PX });

    projection = { centerX: 0, centerY: 0, scale: 1 };

    await loadLabelFont(TVG);

    rootScene = new TVG.Scene();
    canvas.add(rootScene);
    handleResize();
    resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(wrapEl);

    pulseRafId = requestAnimationFrame(pulseTick);
  });

  onDestroy(() => {
    if (pulseRafId !== null) cancelAnimationFrame(pulseRafId);
    resizeObserver?.disconnect();
    // WASM memory sits outside JS GC — must release explicitly on unmount.
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
    on:wheel={onWheel}
  ></canvas>
  <canvas
    bind:this={iconCanvasEl}
    id={iconCanvasId}
    class="mode-icon"
    class:mode-icon--hidden={!iconVisible}
    style="width: {ICON_PX}px; height: {ICON_PX}px; transform: translate({iconX}px, {iconY}px) scale({iconDisplayPx() / ICON_PX}) scaleX({iconDir}) translate(-50%, {iconAnimMode && TRANSPORT_ANIMATION_ANCHOR[iconAnimMode] === 'bottom' ? '-100%' : '-50%'});"
  ></canvas>
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
</style>
