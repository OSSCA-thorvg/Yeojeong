<script lang="ts">
  import { journey, currentTheme, isExporting, playbackProgress, isWrappedOpen } from './journey';
  import cities from '../data/cities.json';
  import { TRANSPORT_MODES, TRANSPORT_ICON, TRANSPORT_LABEL } from './transportIcons';
  import type { City, JourneyStop, TransportMode } from './types';

  export let onExport: () => void = () => {};

  const themes: { id: 'light' | 'sepia' | 'dark'; label: string; class: string }[] = [
    { id: 'light', label: '기본', class: '' },
    { id: 'sepia', label: '빈티지', class: 'vintage' },
    { id: 'dark', label: '네온', class: 'neon' },
  ];

  const transportModes = TRANSPORT_MODES.map((id) => ({
    id,
    icon: TRANSPORT_ICON[id],
    label: TRANSPORT_LABEL[id],
  }));

  let query = '';
  let dragIndex: number | null = null;
  let dragOverIndex: number | null = null;

  $: trimmedQuery = query.trim().toLowerCase();
  $: results = trimmedQuery
    ? (cities as City[])
        .filter((c) => c.name.toLowerCase().includes(trimmedQuery) || c.country.toLowerCase().includes(trimmedQuery))
        .slice(0, 8)
    : [];

  function addStop(city: City) {
    journey.update((stops) => [...stops, { city, arrivalMode: stops.length === 0 ? null : 'plane' }]);
    query = '';
  }

  function normalizeArrivalModes(stops: JourneyStop[]) {
    return stops.map((stop, i) => ({
      ...stop,
      arrivalMode: i === 0 ? null : stop.arrivalMode ?? 'plane',
    }));
  }

  function setArrivalMode(index: number, mode: TransportMode) {
    journey.update((stops) => stops.map((stop, i) => (i === index ? { ...stop, arrivalMode: mode } : stop)));
  }

  function removeStop(index: number) {
    journey.update((stops) => normalizeArrivalModes(stops.filter((_, i) => i !== index)));
  }

  function moveStop(from: number, to: number) {
    journey.update((stops) => {
      if (to < 0 || to >= stops.length || from === to) return stops;
      const next = [...stops];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return normalizeArrivalModes(next);
    });
  }

  function handleDragStart(index: number) {
    dragIndex = index;
  }

  function handleDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    dragOverIndex = index;
  }

  function handleDrop(index: number) {
    if (dragIndex !== null) moveStop(dragIndex, index);
    dragIndex = null;
    dragOverIndex = null;
  }

  function handleDragEnd() {
    dragIndex = null;
    dragOverIndex = null;
  }
</script>

<aside class="sidebar">
  <div class="logo">📔 여정</div>
  <div class="sidebar-content" class:locked={$isExporting} inert={$isExporting}>
  <div class="search-wrap">
    <input class="search-box" type="text" placeholder="🔍 다녀온 도시 검색..." bind:value={query} />
    {#if results.length > 0}
      <ul class="search-results">
        {#each results as city (city.id)}
          <li>
            <button type="button" on:mousedown|preventDefault={() => addStop(city)}>
              {city.name} <span class="country">{city.country}</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else if query.trim()}
      <div class="search-empty">일치하는 도시가 없어요</div>
    {/if}
  </div>

  <ul class="route-list">
    {#each $journey as stop, i (stop.city.id)}
      <li
        class="route-item"
        class:dragging={dragIndex === i}
        class:drag-over={dragOverIndex === i && dragIndex !== i}
        draggable="true"
        on:dragstart={() => handleDragStart(i)}
        on:dragover={(e) => handleDragOver(e, i)}
        on:drop={() => handleDrop(i)}
        on:dragend={handleDragEnd}
      >
        <div class="route-item-top">
          <span class="drag-icon" title="드래그해서 순서 변경">≡</span>
          <div class="city-info">
            <span class="city">{i + 1}. {stop.city.name}{i === 0 ? ' (출발)' : ''}</span>
            <span class="country">{stop.city.country}</span>
          </div>
          <div class="item-actions">
            <button
              type="button"
              class="move-btn"
              disabled={i === 0}
              title="위로 이동"
              on:click={() => moveStop(i, i - 1)}
            >
              ▲
            </button>
            <button
              type="button"
              class="move-btn"
              disabled={i === $journey.length - 1}
              title="아래로 이동"
              on:click={() => moveStop(i, i + 1)}
            >
              ▼
            </button>
            <button type="button" class="remove-btn" title="삭제" on:click={() => removeStop(i)}>
              ✕
            </button>
          </div>
        </div>
        {#if i > 0}
          <div class="mode-picker">
            {#each transportModes as mode (mode.id)}
              <button
                type="button"
                class="mode-btn"
                class:active={stop.arrivalMode === mode.id}
                title={mode.label}
                on:click={() => setArrivalMode(i, mode.id)}
              >
                {mode.icon}
              </button>
            {/each}
          </div>
        {/if}
      </li>
    {:else}
      <li class="empty">도시를 검색해 추가하세요</li>
    {/each}
  </ul>

  <div class="theme-section">
    <div class="theme-title">테마 선택</div>
    <div class="theme-buttons">
      {#each themes as theme (theme.id)}
        <button
          type="button"
          class="theme-btn {theme.class}"
          class:active={$currentTheme === theme.id}
          on:click={() => currentTheme.set(theme.id)}
        >
          {theme.label}
        </button>
      {/each}
    </div>
  </div>
  </div>

  <button
    type="button"
    class="wrapped-btn"
    disabled={$isExporting || $journey.length < 2}
    on:click={() => isWrappedOpen.set(true)}
  >
    🎁 여행 리캡 보기
  </button>

  <button
    type="button"
    class="export-btn"
    disabled={$isExporting || $journey.length < 2}
    on:click={onExport}
  >
    {#if $isExporting}
      ⏳ 내보내는 중... {Math.round($playbackProgress * 100)}%
    {:else}
      💾 영상으로 내보내기
    {/if}
  </button>
</aside>

<style>
  .sidebar {
    width: 340px;
    flex-shrink: 0;
    background-color: #ffffff;
    box-shadow: 2px 0 20px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    padding: 24px;
    z-index: 10;
  }
  .logo {
    font-size: 24px;
    font-weight: 800;
    margin-bottom: 30px;
    color: #007aff;
  }
  .sidebar-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    transition: opacity 0.15s ease;
  }
  .sidebar-content.locked {
    opacity: 0.5;
  }
  .search-wrap {
    position: relative;
    margin-bottom: 24px;
  }
  .search-box {
    width: 100%;
    background: #f2f2f7;
    border: none;
    border-radius: 12px;
    padding: 12px 16px;
    color: #1d1d1f;
    font-size: 14px;
    font-family: inherit;
  }
  .search-box::placeholder {
    color: #8e8e93;
  }
  .search-box:focus {
    outline: 2px solid #007aff;
    outline-offset: 1px;
  }
  .search-results {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    background: #ffffff;
    border: 1px solid #e5e5ea;
    border-radius: 12px;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
    list-style: none;
    margin: 0;
    padding: 6px;
    z-index: 20;
    max-height: 220px;
    overflow-y: auto;
  }
  .search-results button {
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 14px;
    font-family: inherit;
    color: #1d1d1f;
    cursor: pointer;
  }
  .search-results .country {
    color: #8e8e93;
    font-size: 12px;
  }
  .search-results button:hover {
    background: #f2f2f7;
  }
  .search-empty {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    background: #ffffff;
    border: 1px solid #e5e5ea;
    border-radius: 12px;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
    padding: 12px 16px;
    color: #8e8e93;
    font-size: 13px;
    z-index: 20;
  }
  .route-list {
    flex: 1;
    overflow-y: auto;
    list-style: none;
    margin: 0 0 12px;
    padding: 0;
  }
  .route-item {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: #ffffff;
    border: 1px solid #e5e5ea;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
    transition: opacity 0.15s, border-color 0.15s;
  }
  .route-item.dragging {
    opacity: 0.4;
  }
  .route-item.drag-over {
    border-color: #007aff;
  }
  .route-item-top {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .mode-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding-left: 22px;
  }
  .mode-btn {
    border: 1px solid #e5e5ea;
    background: #f9f9fb;
    border-radius: 8px;
    font-size: 13px;
    padding: 4px 6px;
    line-height: 1.3;
    cursor: pointer;
  }
  .mode-btn:hover {
    background: #f2f2f7;
  }
  .mode-btn.active {
    border-color: #007aff;
    background: #eaf3ff;
  }
  .city-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .city {
    font-weight: 600;
    font-size: 15px;
  }
  .route-item .country {
    color: #8e8e93;
    font-size: 12px;
  }
  .drag-icon {
    color: #c7c7cc;
    cursor: grab;
    flex-shrink: 0;
  }
  .item-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }
  .move-btn,
  .remove-btn {
    border: none;
    background: none;
    color: #8e8e93;
    cursor: pointer;
    font-size: 12px;
    border-radius: 6px;
    padding: 4px 6px;
    line-height: 1;
  }
  .move-btn:hover:not(:disabled),
  .remove-btn:hover {
    background: #f2f2f7;
    color: #1d1d1f;
  }
  .move-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .remove-btn:hover {
    color: #ff3b30;
  }
  .empty {
    color: #8e8e93;
    font-size: 13px;
    text-align: center;
    padding: 16px 0;
  }
  .theme-section {
    margin-bottom: 24px;
  }
  .theme-title {
    font-size: 13px;
    font-weight: 600;
    color: #8e8e93;
    margin-bottom: 10px;
  }
  .theme-buttons {
    display: flex;
    gap: 8px;
  }
  .theme-btn {
    flex: 1;
    padding: 10px;
    border-radius: 8px;
    border: 2px solid transparent;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    background: #000;
    color: #fff;
  }
  .theme-btn.vintage {
    background: #f4ecd8;
    color: #8b5a2b;
  }
  .theme-btn.neon {
    background: #1a1a24;
    color: #00ffcc;
  }
  .theme-btn.active {
    border-color: #007aff;
  }
  .wrapped-btn {
    background: #1d1d1f;
    color: white;
    border: none;
    border-radius: 12px;
    padding: 14px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    margin-bottom: 10px;
  }
  .wrapped-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .export-btn {
    background: #007aff;
    color: white;
    border: none;
    border-radius: 12px;
    padding: 16px;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
  }
  .export-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
