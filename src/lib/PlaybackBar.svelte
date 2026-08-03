<script lang="ts">
  import { isPlaying, playbackProgress } from './journey';

  function togglePlay() {
    isPlaying.update((v) => !v);
  }
</script>

<footer class="playback-bar">
  <button on:click={togglePlay}>{$isPlaying ? '⏸' : '▶'}</button>
  <input type="range" min="0" max="1" step="0.001" bind:value={$playbackProgress} />
</footer>

<style>
  .playback-bar {
    height: 56px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 16px;
    background: #fafafa;
    border-top: 1px solid #e5e5e5;
    box-sizing: border-box;
  }
  input[type='range'] {
    flex: 1;
  }
</style>
