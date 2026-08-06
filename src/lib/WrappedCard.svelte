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

  $: stats = computeJourneyStats($journey);
  $: accent = $mapPalette.accent;

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
    TVG = await getThorVG();
    await loadLabelFont(TVG);
    canvas = new TVG.Canvas(`#${CANVAS_ID}`, { width: WIDTH, height: HEIGHT });
    animate();
  });

  onDestroy(() => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    scene?.dispose();
    canvas?.destroy();
  });

  function close() {
    isWrappedOpen.set(false);
  }

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
