<script>
  import { games } from './lib/store.js'

  let currentGame = $state(null)
  let leaving = $state(false)
  let entering = $state(false)

  const STORAGE_KEY = 'hermes-gamelab-hidden'
  let hiddenIds = $state(new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')))
  let hiddenExpanded = $state(false)

  function persistHidden() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...hiddenIds]))
  }

  function hideGame(id) {
    hiddenIds = new Set([...hiddenIds, id])
    persistHidden()
  }

  function showGame(id) {
    const next = new Set(hiddenIds)
    next.delete(id)
    hiddenIds = next
    persistHidden()
  }

  function launch(game) {
    entering = true
    currentGame = game
    setTimeout(() => { entering = false }, 220)
  }

  function goHome() {
    leaving = true
    setTimeout(() => {
      currentGame = null
      leaving = false
    }, 200)
  }

  const visibleGames = $derived(games.filter(g => !hiddenIds.has(g.id)))
  const hiddenGames = $derived(games.filter(g => hiddenIds.has(g.id)))
</script>

{#if currentGame}
  <div class="game-shell" class:fade-in={entering} class:fade-out={leaving}>
    <currentGame.component onBack={goHome} />
  </div>
{:else}
  <div class="home" class:fade-in={!leaving}>
    <header>
      <span class="logo">hermes<span class="accent">.</span>gamelab</span>
    </header>

    <main>
      <section>
        <h2 class="cat-label">Games</h2>
        <div class="grid">
          {#each visibleGames as game}
            <div class="card-wrap">
              <button class="card" onclick={() => launch(game)}>
                <span class="card-title">{game.title}</span>
                <span class="arrow">▶</span>
              </button>
              <button
                class="hide-btn"
                onclick={() => hideGame(game.id)}
                aria-label="Hide {game.title}"
              >···</button>
            </div>
          {/each}
        </div>
      </section>

      {#if hiddenGames.length > 0}
        <section>
          <button class="hidden-header" onclick={() => (hiddenExpanded = !hiddenExpanded)}>
            <span class="cat-label">Hidden ({hiddenGames.length})</span>
            <span class="chevron" class:open={hiddenExpanded}>▾</span>
          </button>
          {#if hiddenExpanded}
            <div class="grid">
              {#each hiddenGames as game}
                <div class="card card--hidden">
                  <span class="card-title dimmed">{game.title}</span>
                  <button class="show-btn" onclick={() => showGame(game.id)}>show</button>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {/if}
    </main>
  </div>
{/if}

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  :global(html, body, #app) {
    height: 100%;
    background: #0a0a0a;
    color: #e8e8e8;
    font-family: system-ui, sans-serif;
  }

  .game-shell {
    position: fixed;
    inset: 0;
    z-index: 10;
    background: #0a0a0a;
  }

  .home {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    padding: 0 0 40px;
  }

  header {
    padding: 24px 20px 16px;
    border-bottom: 1px solid #1a1a1a;
  }
  .logo {
    font-family: monospace;
    font-size: 18px;
    font-weight: 600;
    color: #e8e8e8;
    letter-spacing: 0.04em;
  }
  .accent {
    color: #7c3aed;
  }

  main {
    flex: 1;
    padding: 24px 16px 0;
    display: flex;
    flex-direction: column;
    gap: 32px;
    max-width: 600px;
    width: 100%;
    margin: 0 auto;
  }

  .cat-label {
    font-family: monospace;
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #555;
    margin-bottom: 12px;
    display: block;
  }

  .grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .card-wrap {
    position: relative;
  }

  .card {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #111;
    border: 1px solid #222;
    border-radius: 10px;
    padding: 18px 20px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    min-height: 64px;
    transition: border-color 0.18s, background 0.18s;
    color: inherit;
  }
  .card:hover, .card:focus-visible {
    border-color: #7c3aed;
    background: #16101f;
    outline: none;
  }
  .card:active {
    background: #1d1030;
  }

  .card.card--hidden {
    cursor: default;
    background: #0d0d0d;
    border-color: #1a1a1a;
  }
  .card.card--hidden:hover,
  .card.card--hidden:focus-visible,
  .card.card--hidden:active {
    border-color: #1a1a1a;
    background: #0d0d0d;
    outline: none;
  }

  .hide-btn {
    position: absolute;
    top: 0;
    right: 0;
    padding: 10px 14px;
    background: transparent;
    border: none;
    color: #383838;
    font-size: 16px;
    letter-spacing: 2px;
    cursor: pointer;
    border-radius: 0 10px 0 8px;
    line-height: 1;
    transition: color 0.15s, background 0.15s;
    z-index: 1;
  }
  .hide-btn:hover {
    color: #7c3aed;
    background: rgba(124, 58, 237, 0.08);
  }

  .card-title {
    flex: 1;
    font-size: 16px;
    font-weight: 500;
    color: #e8e8e8;
  }

  .dimmed {
    color: #444;
  }

  .arrow {
    color: #7c3aed;
    font-size: 12px;
    opacity: 0.8;
  }

  .hidden-header {
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    width: 100%;
    color: inherit;
    margin-bottom: 12px;
  }
  .hidden-header .cat-label {
    margin-bottom: 0;
  }
  .chevron {
    color: #555;
    font-size: 14px;
    transition: transform 0.18s;
    display: block;
  }
  .chevron.open {
    transform: rotate(180deg);
  }

  .show-btn {
    font-family: monospace;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #7c3aed;
    background: transparent;
    border: 1px solid #3b1f6e;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .show-btn:hover {
    background: rgba(124, 58, 237, 0.12);
    border-color: #7c3aed;
  }

  .fade-in {
    animation: fadeIn 0.2s ease both;
  }
  .fade-out {
    animation: fadeOut 0.2s ease both;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeOut {
    from { opacity: 1; transform: translateY(0); }
    to   { opacity: 0; transform: translateY(-8px); }
  }
</style>
