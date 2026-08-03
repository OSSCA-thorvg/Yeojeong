<script lang="ts">
  import { journey } from './journey';
</script>

<aside class="journey-panel">
  <h1>여정</h1>
  <ul>
    {#each $journey as stop (stop.city.id)}
      <li>{stop.city.name}</li>
    {:else}
      <li class="empty">도시를 검색해 추가하세요</li>
    {/each}
  </ul>
</aside>

<style>
  .journey-panel {
    width: 280px;
    height: 100%;
    padding: 16px;
    background: #fafafa;
    border-right: 1px solid #e5e5e5;
    box-sizing: border-box;
  }
  h1 {
    font-size: 18px;
    margin: 0 0 12px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .empty {
    color: #999;
    font-size: 13px;
  }
</style>
