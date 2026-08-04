<script lang="ts">
  import JourneyPanel from './lib/JourneyPanel.svelte';
  import MapCanvas from './lib/MapCanvas.svelte';
  import PlaybackBar from './lib/PlaybackBar.svelte';
  import { currentTheme } from './lib/journey';
  import { MAP_BACKGROUND_HEX } from './lib/mapTheme';
</script>

<main class="app-layout">
  <JourneyPanel />
  <div class="canvas-area" style="background: {MAP_BACKGROUND_HEX[$currentTheme]}">
    <MapCanvas />
    <PlaybackBar />
  </div>
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
  }
  .app-layout {
    display: flex;
    height: 100vh;
    background: #f8f9fa;
    overflow: hidden;
  }
  .canvas-area {
    flex: 1;
    min-width: 0;
    position: relative;
  }
</style>
