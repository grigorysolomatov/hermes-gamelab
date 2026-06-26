<script>
  import { games, activeGame, showArchived } from './lib/store.js'

  let currentGame = $state(null)
  let leaving = $state(false)
  let entering = $state(false)

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

  const categories = $derived.by(() => {
    const visible = games.filter(g => $showArchived || !g.archived)
    const cats = {}
    for (const g of visible) {
      if (!cats[g.category]) cats[g.category] = []
      cats[g.category].push(g)
    }
    return cats
  })

  const hasArchived = games.some(g => g.archived)
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
      {#each Object.entries(categories) as [cat, list]}
        <section>
          <h2 class="cat-label">{cat}</h2>
          <div class="grid">
            {#each list as game}
              <button class="card" onclick={() => launch(game)}>
                <span class="card-title">{game.title}</span>
                {#if game.archived}
                  <span class="badge">archived</span>
                {/if}
                <span class="arrow">▶</span>
              </button>
            {/each}
          </div>
        </section>
      {/each}
    </main>

    {#if hasArchived}
      <footer>
        <label class="toggle">
          <input
            type="checkbox"
            bind:checked={$showArchived}
          />
          <span class="toggle-label">show archived</span>
        </label>
      </footer>
    {/if}
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
  }

  .grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
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

  .card-title {
    flex: 1;
    font-size: 16px;
    font-weight: 500;
    color: #e8e8e8;
  }

  .badge {
    font-family: monospace;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #555;
    border: 1px solid #333;
    border-radius: 4px;
    padding: 2px 6px;
  }

  .arrow {
    color: #7c3aed;
    font-size: 12px;
    opacity: 0.8;
  }

  footer {
    margin-top: 40px;
    display: flex;
    justify-content: center;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    user-select: none;
  }
  .toggle input {
    appearance: none;
    width: 36px;
    height: 20px;
    background: #222;
    border-radius: 10px;
    position: relative;
    cursor: pointer;
    transition: background 0.2s;
  }
  .toggle input::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #555;
    transition: left 0.2s, background 0.2s;
  }
  .toggle input:checked {
    background: #3b1f6e;
  }
  .toggle input:checked::after {
    left: 19px;
    background: #7c3aed;
  }
  .toggle-label {
    font-family: monospace;
    font-size: 13px;
    color: #555;
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
