<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import ThorVG from '@thorvg/webcanvas';

  type ThorVGModule = Awaited<ReturnType<typeof ThorVG.init>>;

  const canvasId = 'yeojeong-map-canvas';
  let canvasEl: HTMLCanvasElement;
  let TVG: ThorVGModule | undefined;
  let canvas: InstanceType<ThorVGModule['Canvas']> | undefined;

  onMount(async () => {
    TVG = await ThorVG.init({ renderer: 'gl' });
    canvas = new TVG.Canvas(`#${canvasId}`, {
      width: canvasEl.clientWidth,
      height: canvasEl.clientHeight,
    });
    canvas.render();
  });

  onDestroy(() => {
    // WASM memory sits outside JS GC — must release explicitly on unmount.
    canvas?.destroy();
    TVG?.term();
  });
</script>

<canvas bind:this={canvasEl} id={canvasId} class="map-canvas"></canvas>

<style>
  .map-canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
