<script>
  let { onBack } = $props()

  let count = $state(0)
  let bouncing = $state(false)
  let ripples = $state([])
  let nextId = 0

  function tap(e) {
    count++
    bouncing = true
    setTimeout(() => { bouncing = false }, 300)

    const rect = e.currentTarget.getBoundingClientRect()
    const cx = e.type === 'touchstart'
      ? e.touches[0].clientX - rect.left
      : e.clientX - rect.left
    const cy = e.type === 'touchstart'
      ? e.touches[0].clientY - rect.top
      : e.clientY - rect.top

    const id = nextId++
    ripples = [...ripples, { id, x: cx, y: cy }]
    setTimeout(() => {
      ripples = ripples.filter(r => r.id !== id)
    }, 600)
  }

  function reset() {
    count = 0
  }
</script>

<div class="wrapper">
  <button class="back" onclick={onBack}>← back</button>

  <div class="content">
    <div class="label">Tap count</div>
    <div class="number" class:bounce={bouncing}>{count}</div>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="tap-btn"
      onclick={tap}
      ontouchstart={(e) => { e.preventDefault(); tap(e) }}
      role="button"
      tabindex="0"
      onkeydown={(e) => e.key === 'Enter' || e.key === ' ' ? tap(e) : null}
    >
      TAP
      {#each ripples as r (r.id)}
        <span class="ripple" style="left:{r.x}px;top:{r.y}px"></span>
      {/each}
    </div>

    <button class="reset" onclick={reset}>reset</button>
  </div>
</div>

<style>
  .wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: #0a0a0a;
    position: relative;
  }
  .back {
    position: absolute;
    top: 12px;
    left: 12px;
    background: transparent;
    border: 1px solid #333;
    color: #888;
    font-family: monospace;
    font-size: 14px;
    padding: 6px 14px;
    border-radius: 6px;
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s;
  }
  .back:hover {
    color: #e8e8e8;
    border-color: #7c3aed;
  }
  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
  }
  .label {
    font-family: monospace;
    font-size: 16px;
    color: #666;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .number {
    font-family: monospace;
    font-size: clamp(72px, 20vw, 120px);
    font-weight: 700;
    color: #e8e8e8;
    line-height: 1;
    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
    will-change: transform;
    min-width: 3ch;
    text-align: center;
  }
  .number.bounce {
    transform: scale(1.18);
  }
  .tap-btn {
    position: relative;
    overflow: hidden;
    width: 180px;
    height: 180px;
    border-radius: 50%;
    background: #7c3aed;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: monospace;
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.1em;
    cursor: pointer;
    user-select: none;
    touch-action: none;
    transition: background 0.15s, transform 0.1s;
    box-shadow: 0 0 0 0 rgba(124,58,237,0.4);
  }
  .tap-btn:active {
    background: #6d28d9;
    transform: scale(0.96);
  }
  .ripple {
    position: absolute;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.45);
    transform: translate(-50%, -50%) scale(0);
    animation: ripple-out 0.6s ease-out forwards;
    pointer-events: none;
  }
  @keyframes ripple-out {
    to {
      transform: translate(-50%, -50%) scale(22);
      opacity: 0;
    }
  }
  .reset {
    background: transparent;
    border: 1px solid #333;
    color: #555;
    font-family: monospace;
    font-size: 14px;
    padding: 8px 24px;
    border-radius: 6px;
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s;
  }
  .reset:hover {
    color: #e8e8e8;
    border-color: #555;
  }
</style>
