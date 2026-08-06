<script lang="ts">
  import { onDestroy } from 'svelte';
  import { journey, isPlaying, playbackProgress, playbackDuration, playbackSpeed, isExporting } from './journey';

  const SPEEDS = [0.5, 1, 1.5, 2];
  const NOTICE_MS = 2400;

  let rafId: number | null = null;
  let lastTime = 0;
  let notice = '';
  let noticeTimer: ReturnType<typeof setTimeout> | null = null;

  function showNotice(message: string) {
    notice = message;
    if (noticeTimer !== null) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      notice = '';
      noticeTimer = null;
    }, NOTICE_MS);
  }

  function tick(time: number) {
    const elapsed = lastTime === 0 ? 0 : time - lastTime;
    lastTime = time;
    playbackProgress.update((p) => {
      const next = p + (elapsed * $playbackSpeed) / $playbackDuration;
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

  onDestroy(() => {
    stop();
    if (noticeTimer !== null) clearTimeout(noticeTimer);
  });

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
    if ($journey.length < 2) {
      showNotice('도시 2개 이상 등록해주세요');
      return;
    }
    if ($playbackProgress >= 1) playbackProgress.set(0);
    start();
  }

  function cycleSpeed() {
    playbackSpeed.set(SPEEDS[(SPEEDS.indexOf($playbackSpeed) + 1) % SPEEDS.length]);
  }
</script>

{#if notice}
  <div class="notice" role="status" aria-live="polite">{notice}</div>
{/if}

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
  <button type="button" class="speed-btn" disabled={$isExporting} on:click={cycleSpeed}>{$playbackSpeed}x</button>
</div>

<style>
  .notice {
    position: absolute;
    left: 50%;
    bottom: 112px;
    transform: translateX(-50%);
    max-width: calc(100% - 32px);
    background: rgba(0, 0, 0, 0.82);
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    padding: 10px 18px;
    border-radius: 999px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
    white-space: nowrap;
    pointer-events: none;
    z-index: 11;
  }
  .player-controls {
    position: absolute;
    left: 50%;
    bottom: 40px;
    transform: translateX(-50%);
    width: min(600px, calc(100% - 32px));
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
    padding: 8px;
  }

  @media (max-width: 860px), (max-height: 520px) {
    .notice {
      bottom: 72px;
      font-size: 13px;
      padding: 8px 14px;
    }
    .player-controls {
      bottom: 12px;
      padding: 10px 14px;
      gap: 12px;
      border-radius: 16px;
    }
    .play-btn {
      width: 36px;
      height: 36px;
    }
    .progress-input {
      inset: -14px 0;
    }
  }
</style>
