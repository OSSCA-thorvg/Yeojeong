<script lang="ts">
  import JourneyPanel from './lib/JourneyPanel.svelte';
  import MapCanvas from './lib/MapCanvas.svelte';
  import PlaybackBar from './lib/PlaybackBar.svelte';
  import WrappedCard from './lib/WrappedCard.svelte';
  import { mapPalette, isWrappedOpen } from './lib/journey';
  import { toHex } from './lib/mapTheme';

  let mapCanvas: MapCanvas;
</script>

<main class="app-layout">
  <JourneyPanel onExport={() => mapCanvas?.exportVideo()} />
  <div class="canvas-area" style="background: {toHex($mapPalette.ocean)}">
    <MapCanvas bind:this={mapCanvas} />
    <PlaybackBar />
  </div>
  {#if $isWrappedOpen}
    <WrappedCard />
  {/if}
</main>

<style>
  :global(html, body) {
    margin: 0;
    height: 100%;
  }
  :global(*) {
    box-sizing: border-box;
  }
  :global(body) {
    font-family:
      'Pretendard',
      -apple-system,
      BlinkMacSystemFont,
      system-ui,
      Roboto,
      sans-serif;
    color: #1d1d1f;
    overscroll-behavior: none;
    -webkit-text-size-adjust: 100%;
  }
  .app-layout {
    display: flex;
    height: 100vh;
    height: 100dvh;
    background: #f8f9fa;
    overflow: hidden;
  }
  .canvas-area {
    flex: 1;
    min-width: 0;
    min-height: 0;
    position: relative;
  }

  @media (max-width: 860px) and (orientation: portrait) {
    .app-layout {
      flex-direction: column-reverse;
    }
    .canvas-area {
      min-height: 38dvh;
    }
  }
</style>
