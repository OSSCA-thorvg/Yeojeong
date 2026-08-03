<script lang="ts">
  import JourneyPanel from './lib/JourneyPanel.svelte';
  import MapCanvas from './lib/MapCanvas.svelte';
  import PlaybackBar from './lib/PlaybackBar.svelte';
</script>

<main class="app-layout">
  <div class="body">
    <JourneyPanel />
    <div class="map-area">
      <MapCanvas />
    </div>
  </div>
  <PlaybackBar />
</main>

<style>
  :global(html, body) {
    margin: 0;
    height: 100%;
  }
  .app-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  .body {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .map-area {
    flex: 1;
  }
</style>
