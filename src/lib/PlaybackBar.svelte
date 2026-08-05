<script lang="ts">
  import { onDestroy } from 'svelte';
  import { isPlaying, playbackProgress, isExporting } from './journey';

  const DURATION_MS = 18000;
  const SPEEDS = [1, 1.5, 2];

  let rafId: number | null = null;
  let lastTime = 0;
  let speed = 1;

  function tick(time: number) {
    const elapsed = lastTime === 0 ? 0 : time - lastTime;
    lastTime = time;
    playbackProgress.update((p) => {
      const next = p + (elapsed * speed) / DURATION_MS;
      if (next >= 1) {
        stop();
        return 1;
      }
      return next;
    });
    if (rafId !== null) rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (rafId !== null) return;
    lastTime = 0;
    isPlaying.set(true);
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    isPlaying.set(false);
  }

  onDestroy(stop);

  $: if ($isExporting && rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  function togglePlay() {
    if ($isExporting) return;
    if ($isPlaying) {
      stop();
      return;
    }
    if ($playbackProgress >= 1) playbackProgress.set(0);
    start();
  }

  function cycleSpeed() {
    speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
  }
</script>

<div class="player-controls">
  <button type="button" class="play-btn" disabled={$isExporting} on:click={togglePlay}>{$isPlaying ? '⏸' : '▶'}</button>
  <div class="progress-bar">
    <div class="progress-fill" style="width: {$playbackProgress * 100}%"></div>
    <input
      class="progress-input"
      type="range"
      min="0"
      max="1"
      step="0.001"
      disabled={$isExporting}
      bind:value={$playbackProgress}
      aria-label="재생 진행률"
    />
  </div>
  <button type="button" class="speed-btn" disabled={$isExporting} on:click={cycleSpeed}>{speed}x</button>
</div>

<style>
  .player-controls {
    position: absolute;
    left: 50%;
    bottom: 40px;
    transform: translateX(-50%);
    width: min(600px, calc(100% - 48px));
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(10px);
    border-radius: 20px;
    padding: 16px 24px;
    display: flex;
    align-items: center;
    gap: 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.5);
    z-index: 10;
    box-sizing: border-box;
  }
  .play-btn {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    background: #000;
    border: none;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 14px;
    cursor: pointer;
  }
  .progress-bar {
    position: relative;
    flex: 1;
    height: 6px;
    background: #e5e5ea;
    border-radius: 3px;
  }
  .progress-fill {
    position: absolute;
    inset: 0 auto 0 0;
    height: 100%;
    background: #007aff;
    border-radius: 3px;
    pointer-events: none;
  }
  .progress-input {
    position: absolute;
    inset: 0;
    width: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .speed-btn {
    flex-shrink: 0;
    font-size: 14px;
    font-weight: 600;
    color: #8e8e93;
    background: none;
    border: none;
    cursor: pointer;
  }
</style>
