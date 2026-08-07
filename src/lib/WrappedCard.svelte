<!-- "Wrapped" recap card component: renders the animated journey summary scene (distance, stats, mode-share chart). -->
<!-- '여정 요약(Wrapped)' 리캡 카드 컴포넌트. 거리, 통계, 이동 수단 비중 차트를 애니메이션 장면으로 렌더링한다. -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Scene } from '@thorvg/webcanvas';
  import { getThorVG, type ThorVGModule } from './thorvg';
  import { loadLabelFont } from './worldMap';
  import { buildWrappedScene } from './wrappedScene';
  import { computeJourneyStats } from './journeyStats';
  import { transportColor } from './journeyPath';
  import { journey, mapPalette, isWrappedOpen } from './journey';
  import { TRANSPORT_LABEL } from './transportIcons';

  const CANVAS_ID = 'wrapped-canvas';
  const WIDTH = 320;
  const HEIGHT = 400;
  const DRAW_DURATION_MS = 1300;

  let canvasEl: HTMLCanvasElement;
  let TVG: ThorVGModule | undefined;
  let canvas: InstanceType<ThorVGModule['Canvas']> | undefined;
  let scene: Scene | undefined;
  let rafId: number | null = null;
  let initError = '';

  $: stats = computeJourneyStats($journey);
  $: accent = $mapPalette.accent;

  // Rebuilds and renders the wrapped card scene for a given animation progress, replacing the previous scene.
  // 주어진 애니메이션 진행률에 맞춰 리캡 카드 씬을 다시 만들어 렌더링하고, 기존 씬은 교체한다.
  function renderFrame(progress: number) {
    if (!TVG || !canvas) return;
    const next = buildWrappedScene(TVG, stats, progress, accent, WIDTH, HEIGHT);
    if (scene) {
      canvas.remove(scene);
      scene.dispose();
    }
    scene = next;
    canvas.add(scene);
    canvas.update().render();
  }

  // Runs the wrapped card's draw-in animation from 0 to 1 progress over a fixed duration.
  // 리캡 카드가 그려지는 애니메이션을 정해진 시간 동안 진행률 0에서 1까지 실행한다.
  function animate() {
    const start = performance.now();
    const step = (time: number) => {
      const progress = Math.min(1, (time - start) / DRAW_DURATION_MS);
      renderFrame(progress);
      rafId = progress < 1 ? requestAnimationFrame(step) : null;
    };
    rafId = requestAnimationFrame(step);
  }

  onMount(async () => {
    try {
      TVG = await getThorVG();
    } catch {
      initError = '리캡 카드를 그릴 수 없어요. 브라우저를 최신 버전으로 업데이트한 뒤 새로고침해 주세요';
      return;
    }
    await loadLabelFont(TVG);
    canvas = new TVG.Canvas(`#${CANVAS_ID}`, { width: WIDTH, height: HEIGHT });
    animate();
  });

  onDestroy(() => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    scene?.dispose();
    canvas?.destroy();
  });

  // Closes the wrapped card modal.
  // 리캡 카드 모달을 닫는다.
  function close() {
    isWrappedOpen.set(false);
  }

  // Saves the wrapped card canvas as a downloadable PNG image.
  // 리캡 카드 캔버스를 다운로드 가능한 PNG 이미지로 저장한다.
  function saveImage() {
    canvas?.update().render();
    const url = canvasEl.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = '여행_리캡.png';
    a.click();
  }
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && close()} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="backdrop" on:click={close} role="presentation">
  <div class="card" on:click|stopPropagation role="dialog" aria-modal="true" aria-label="여행 리캡" tabindex="-1">
    <div class="card-header">
      <span>🎁 나의 여행, 요약</span>
      <button type="button" class="close-btn" on:click={close} aria-label="닫기">✕</button>
    </div>
    {#if initError}
      <p class="init-error" role="alert">{initError}</p>
    {/if}
    <canvas bind:this={canvasEl} id={CANVAS_ID} width={WIDTH} height={HEIGHT}></canvas>
    <ul class="legend">
      {#each stats.modeShares as share (share.mode)}
        <li>
          <span class="dot" style="background: rgb({transportColor(share.mode, accent).join(',')})"></span>
          <span class="label">{TRANSPORT_LABEL[share.mode]}</span>
          <span class="pct">{Math.round(share.pct * 100)}%</span>
        </li>
      {/each}
    </ul>
    <button type="button" class="save-btn" on:click={saveImage}>📥 이미지로 저장</button>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 100;
  }
  .card {
    width: min(360px, 100%);
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
    overscroll-behavior: contain;
    background: #16161c;
    border-radius: 20px;
    padding: 20px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .init-error {
    margin: 0;
    color: #ffb4a8;
    font-size: 13px;
    line-height: 1.5;
  }
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #fff;
    font-weight: 700;
    font-size: 15px;
  }
  .close-btn {
    background: none;
    border: none;
    color: #8e8e93;
    font-size: 14px;
    cursor: pointer;
    padding: 4px;
  }
  .close-btn:hover {
    color: #fff;
  }
  canvas {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 14px;
  }
  .legend {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #e5e5ea;
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .legend .pct {
    color: #8e8e93;
  }
  .save-btn {
    background: #007aff;
    color: #fff;
    border: none;
    border-radius: 12px;
    padding: 12px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
</style>
