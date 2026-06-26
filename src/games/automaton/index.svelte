<script>
  import { onMount, onDestroy } from 'svelte'

  let { onBack } = $props()

  // ---- Constants ----
  const AGENT_SPEED = 80
  const WORK_TIME = 0.5
  const INV_CAP = 5
  const ZOOM_MIN = 0.4
  const ZOOM_MAX = 2.0
  const AGENT_COLORS = ['#ffffff', '#00bcd4', '#ff9800']
  const NODE_RESOURCE = { mine: 'gold', rock: 'stone', tree: 'wood' }

  // ---- DOM refs ----
  let canvasEl
  let ctx

  // ---- RAF ----
  let raf
  let lastTs = 0

  // ---- State ----
  let isPortrait = $state(false)
  let cam = $state({ x: 0, y: 0, zoom: 1.0 })
  let islandPoly = $state([])
  let nodes = $state([])

  function makeAgent() {
    return { x: 0, y: 0, state: 'IDLE', cardIndex: 0, inventory: { gold: 0, wood: 0, stone: 0 }, workTimer: 0 }
  }

  let agents = $state([makeAgent(), makeAgent(), makeAgent()])

  let decks = $state([
    [{ type: 'extract', target: null }, { type: 'deposit', target: null }],
    [{ type: 'extract', target: null }, { type: 'deposit', target: null }],
    [{ type: 'extract', target: null }, { type: 'deposit', target: null }],
  ])

  let baseResources = $state({ gold: 0, wood: 0, stone: 0 })
  let isPlaying = $state(false)
  let dragging = $state(null) // { cardIndex, ghostX, ghostY }
  let selectedAgent = $state(0)
  let deckCollapsed = $state(false)

  // ---- Non-reactive interaction refs ----
  let panRef = { active: false, startX: 0, startY: 0, camX: 0, camY: 0 }
  let pinchRef = { active: false, startDist: 0, startZoom: 1 }
  let onResize

  // ---- Utils ----
  function pointInPoly(px, py, poly) {
    let inside = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y
      const xj = poly[j].x, yj = poly[j].y
      if (((yi > py) !== (yj > py)) && px < (xj - xi) * (py - yi) / (yj - yi) + xi)
        inside = !inside
    }
    return inside
  }

  function inventoryTotal(inv) {
    return inv.gold + inv.wood + inv.stone
  }

  // ---- Generation ----
  function generateIsland() {
    const n = 12 + Math.floor(Math.random() * 5)
    const poly = []
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2
      const r = 300 * (0.7 + Math.random() * 0.6)
      poly.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r })
    }
    return poly
  }

  function generateNodes(poly) {
    const list = [
      { id: 'base', type: 'base', emoji: '🎈', color: '#7c3aed', radius: 28, label: 'Base', x: 0, y: 0 },
    ]
    const templates = [
      { type: 'mine', emoji: '⛏', color: '#c9a227', radius: 22, label: 'Gold Mine' },
      { type: 'mine', emoji: '⛏', color: '#c9a227', radius: 22, label: 'Gold Mine' },
      { type: 'mine', emoji: '⛏', color: '#c9a227', radius: 22, label: 'Gold Mine' },
      { type: 'rock', emoji: '🪨', color: '#888888', radius: 20, label: 'Rock' },
      { type: 'rock', emoji: '🪨', color: '#888888', radius: 20, label: 'Rock' },
      { type: 'rock', emoji: '🪨', color: '#888888', radius: 20, label: 'Rock' },
      { type: 'tree', emoji: '🌲', color: '#4a7c4e', radius: 20, label: 'Tree' },
      { type: 'tree', emoji: '🌲', color: '#4a7c4e', radius: 20, label: 'Tree' },
      { type: 'tree', emoji: '🌲', color: '#4a7c4e', radius: 20, label: 'Tree' },
    ]
    let uid = 0
    for (const tmpl of templates) {
      for (let tries = 0; tries < 300; tries++) {
        const x = (Math.random() - 0.5) * 500
        const y = (Math.random() - 0.5) * 500
        if (!pointInPoly(x, y, poly)) continue
        const minD = list.reduce((m, n) => Math.min(m, Math.hypot(n.x - x, n.y - y)), Infinity)
        if (minD > 80) {
          list.push({ ...tmpl, id: `n${uid++}`, x, y })
          break
        }
      }
    }
    return list
  }

  // ---- Coordinate transform ----
  function w2s(wx, wy) {
    if (!canvasEl) return [0, 0]
    return [
      (wx - cam.x) * cam.zoom + canvasEl.width / 2,
      (wy - cam.y) * cam.zoom + canvasEl.height / 2,
    ]
  }

  // ---- Draw ----
  function draw() {
    if (!ctx || !canvasEl) return
    const W = canvasEl.width
    const H = canvasEl.height

    ctx.fillStyle = '#1a2a3a'
    ctx.fillRect(0, 0, W, H)

    if (islandPoly.length) {
      ctx.beginPath()
      const [fx, fy] = w2s(islandPoly[0].x, islandPoly[0].y)
      ctx.moveTo(fx, fy)
      for (let i = 1; i < islandPoly.length; i++) {
        const [sx, sy] = w2s(islandPoly[i].x, islandPoly[i].y)
        ctx.lineTo(sx, sy)
      }
      ctx.closePath()
      ctx.fillStyle = '#2d3a2d'
      ctx.fill()
    }

    const isDragging = dragging !== null
    for (const node of nodes) {
      const [sx, sy] = w2s(node.x, node.y)
      const r = node.radius * cam.zoom

      if (isDragging) {
        ctx.beginPath()
        ctx.arc(sx, sy, r + 7, 0, Math.PI * 2)
        ctx.strokeStyle = '#7c3aed'
        ctx.lineWidth = 2.5
        ctx.stroke()
      }

      ctx.beginPath()
      ctx.arc(sx, sy, r, 0, Math.PI * 2)
      ctx.fillStyle = node.color
      ctx.fill()

      ctx.font = `${Math.max(14, r * 1.1)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(node.emoji, sx, sy)

      ctx.font = `${Math.max(9, 11 * cam.zoom)}px monospace`
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.textBaseline = 'top'
      ctx.fillText(node.label, sx, sy + r + 3)
    }

    for (let ai = 0; ai < agents.length; ai++) {
      const ag = agents[ai]
      const [ax, ay] = w2s(ag.x, ag.y)
      const agR = Math.max(6, 10 * cam.zoom)
      const color = AGENT_COLORS[ai]

      ctx.beginPath()
      ctx.arc(ax, ay, agR + 5, -Math.PI / 2, Math.PI * 1.5)
      ctx.strokeStyle = '#7c3aed'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(ax, ay, agR, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()

      const total = inventoryTotal(ag.inventory)
      if (total > 0) {
        const bx = ax
        const by = ay - agR - 14
        const text = `${total}`
        ctx.font = '11px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const tw = ctx.measureText(text).width
        const pw = tw + 10
        const ph = 16
        ctx.fillStyle = 'rgba(0,0,0,0.8)'
        ctx.beginPath()
        if (ctx.roundRect) {
          ctx.roundRect(bx - pw / 2, by - ph / 2, pw, ph, 8)
        } else {
          ctx.rect(bx - pw / 2, by - ph / 2, pw, ph)
        }
        ctx.fill()
        ctx.fillStyle = color
        ctx.fillText(text, bx, by)
      }
    }
  }

  // ---- Game loop ----
  function tick(ts) {
    const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0
    lastTs = ts
    if (isPlaying) {
      for (let ai = 0; ai < agents.length; ai++) {
        updateAgent(ai, dt)
      }
    }
    draw()
    raf = requestAnimationFrame(tick)
  }

  // ---- Agent state machine ----
  function updateAgent(agentIndex, dt) {
    const ag = agents[agentIndex]
    const dk = decks[agentIndex]
    if (!dk.length) return

    if (ag.state === 'IDLE') {
      let found = false
      for (let i = 0; i < dk.length; i++) {
        const ni = (ag.cardIndex + i) % dk.length
        if (dk[ni]?.target) {
          ag.cardIndex = ni
          found = true
          break
        }
      }
      if (!found) return
      ag.state = 'MOVING'
      return
    }

    if (ag.state === 'MOVING') {
      const card = dk[ag.cardIndex]
      if (!card?.target) { ag.state = 'IDLE'; return }
      const dx = card.target.x - ag.x
      const dy = card.target.y - ag.y
      const dist = Math.hypot(dx, dy)
      if (dist < 2) {
        ag.x = card.target.x
        ag.y = card.target.y
        ag.state = 'WORKING'
        ag.workTimer = 0
      } else {
        const mv = AGENT_SPEED * dt
        ag.x += (dx / dist) * Math.min(mv, dist)
        ag.y += (dy / dist) * Math.min(mv, dist)
      }
      return
    }

    if (ag.state === 'WORKING') {
      ag.workTimer += dt
      if (ag.workTimer >= WORK_TIME) {
        const card = dk[ag.cardIndex]
        if (card?.type === 'extract' && card.target) {
          const resource = NODE_RESOURCE[card.target.type]
          if (resource && inventoryTotal(ag.inventory) < INV_CAP) {
            ag.inventory = { ...ag.inventory, [resource]: ag.inventory[resource] + 1 }
          }
        } else if (card?.type === 'deposit') {
          baseResources = {
            gold: baseResources.gold + ag.inventory.gold,
            wood: baseResources.wood + ag.inventory.wood,
            stone: baseResources.stone + ag.inventory.stone,
          }
          ag.inventory = { gold: 0, wood: 0, stone: 0 }
        }
        ag.cardIndex = (ag.cardIndex + 1) % dk.length
        ag.state = 'IDLE'
      }
    }
  }

  // ---- Controls ----
  function doPlay() { isPlaying = true }
  function doStop() { isPlaying = false }
  function doReset() {
    isPlaying = false
    baseResources = { gold: 0, wood: 0, stone: 0 }
    agents = [makeAgent(), makeAgent(), makeAgent()]
  }

  // ---- Canvas pointer: pan / pinch-zoom ----
  function onCanvasMouseDown(e) {
    if (dragging !== null) return
    panRef.active = true
    panRef.startX = e.clientX
    panRef.startY = e.clientY
    panRef.camX = cam.x
    panRef.camY = cam.y
  }

  function onCanvasTouchStart(e) {
    e.preventDefault()
    if (e.touches.length === 2) {
      pinchRef.active = true
      panRef.active = false
      const t0 = e.touches[0], t1 = e.touches[1]
      pinchRef.startDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY)
      pinchRef.startZoom = cam.zoom
    } else if (e.touches.length === 1 && dragging === null) {
      panRef.active = true
      pinchRef.active = false
      panRef.startX = e.touches[0].clientX
      panRef.startY = e.touches[0].clientY
      panRef.camX = cam.x
      panRef.camY = cam.y
    }
  }

  // ---- Global pointer events ----
  function onGlobalMouseMove(e) {
    if (dragging !== null) {
      dragging = { ...dragging, ghostX: e.clientX, ghostY: e.clientY }
      return
    }
    if (!panRef.active) return
    const dx = (e.clientX - panRef.startX) / cam.zoom
    const dy = (e.clientY - panRef.startY) / cam.zoom
    cam = { ...cam, x: panRef.camX - dx, y: panRef.camY - dy }
  }

  function onGlobalMouseUp(e) {
    if (dragging !== null) { handleDrop(e.clientX, e.clientY); return }
    panRef.active = false
  }

  function onGlobalTouchMove(e) {
    e.preventDefault()
    if (dragging !== null && e.touches.length === 1) {
      dragging = { ...dragging, ghostX: e.touches[0].clientX, ghostY: e.touches[0].clientY }
      return
    }
    if (e.touches.length === 2 && pinchRef.active) {
      const t0 = e.touches[0], t1 = e.touches[1]
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY)
      cam = { ...cam, zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchRef.startZoom * dist / pinchRef.startDist)) }
      return
    }
    if (e.touches.length === 1 && panRef.active && dragging === null) {
      const dx = (e.touches[0].clientX - panRef.startX) / cam.zoom
      const dy = (e.touches[0].clientY - panRef.startY) / cam.zoom
      cam = { ...cam, x: panRef.camX - dx, y: panRef.camY - dy }
    }
  }

  function onGlobalTouchEnd(e) {
    if (dragging !== null && e.changedTouches.length > 0) {
      handleDrop(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
    }
    if (e.touches.length < 2) pinchRef.active = false
    if (e.touches.length === 0) panRef.active = false
  }

  // ---- Card drag-to-assign ----
  function startDrag(cardIndex, e) {
    panRef.active = false
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    dragging = { cardIndex, ghostX: clientX, ghostY: clientY }
  }

  function handleDrop(clientX, clientY) {
    if (!dragging || !canvasEl) { dragging = null; return }
    const rect = canvasEl.getBoundingClientRect()
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      dragging = null; return
    }
    const scaleX = canvasEl.width / rect.width
    const scaleY = canvasEl.height / rect.height
    const cx = (clientX - rect.left) * scaleX
    const cy = (clientY - rect.top) * scaleY

    let hitNode = null
    for (const node of nodes) {
      const [sx, sy] = w2s(node.x, node.y)
      if (Math.hypot(cx - sx, cy - sy) <= node.radius * cam.zoom + 10) {
        hitNode = node; break
      }
    }

    if (hitNode) {
      const idx = dragging.cardIndex
      const ai = selectedAgent
      decks = decks.map((dk, di) => di === ai ? dk.map((c, i) => i === idx ? { ...c, target: hitNode } : c) : dk)
    }
    dragging = null
  }

  function clearTarget(cardIndex, e) {
    e.stopPropagation()
    const ai = selectedAgent
    decks = decks.map((dk, di) => di === ai ? dk.map((c, i) => i === cardIndex ? { ...c, target: null } : c) : dk)
  }

  // ---- Resize / orientation ----
  function resizeCanvas() {
    if (!canvasEl?.parentElement) return
    const p = canvasEl.parentElement
    if (!p.clientWidth) return
    canvasEl.width = p.clientWidth
    canvasEl.height = p.clientHeight
  }

  function checkOrientation() {
    isPortrait = window.innerWidth < window.innerHeight
  }

  // ---- Lifecycle ----
  onMount(() => {
    islandPoly = generateIsland()
    nodes = generateNodes(islandPoly)
    checkOrientation()
    resizeCanvas()
    ctx = canvasEl.getContext('2d')
    lastTs = 0
    raf = requestAnimationFrame(tick)

    window.addEventListener('mousemove', onGlobalMouseMove)
    window.addEventListener('mouseup', onGlobalMouseUp)
    window.addEventListener('touchmove', onGlobalTouchMove, { passive: false })
    window.addEventListener('touchend', onGlobalTouchEnd)
    onResize = () => { checkOrientation(); resizeCanvas() }
    window.addEventListener('resize', onResize)
  })

  onDestroy(() => {
    if (raf) cancelAnimationFrame(raf)
    window.removeEventListener('mousemove', onGlobalMouseMove)
    window.removeEventListener('mouseup', onGlobalMouseUp)
    window.removeEventListener('touchmove', onGlobalTouchMove)
    window.removeEventListener('touchend', onGlobalTouchEnd)
    window.removeEventListener('resize', onResize)
  })
</script>

<div class="root">
  {#if isPortrait}
    <div class="rotate-overlay">
      <span>↻ Please rotate your device</span>
    </div>
  {/if}

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <canvas
    bind:this={canvasEl}
    onmousedown={onCanvasMouseDown}
    ontouchstart={onCanvasTouchStart}
  ></canvas>

  <div class="hud">
    🪙 {baseResources.gold}&nbsp;&nbsp;🪵 {baseResources.wood}&nbsp;&nbsp;🪨 {baseResources.stone}
  </div>

  <button class="back-btn" onclick={onBack}>← back</button>

  {#if dragging !== null}
    <div
      class="ghost-card"
      style="left:{dragging.ghostX}px;top:{dragging.ghostY}px"
    >
      <div class="ghost-type">
        {decks[selectedAgent][dragging.cardIndex]?.type === 'extract' ? 'EXTRACT' : 'DEPOSIT'}
      </div>
      <div class="ghost-target">
        {#if decks[selectedAgent][dragging.cardIndex]?.target}
          {decks[selectedAgent][dragging.cardIndex].target.emoji} {decks[selectedAgent][dragging.cardIndex].target.label}
        {:else}
          — assign target —
        {/if}
      </div>
    </div>
  {/if}

  <!-- Deck overlay (glassmorphism, floats above canvas) -->
  <div class="deck-overlay">
    <button class="deck-toggle" onclick={() => deckCollapsed = !deckCollapsed}>
      {deckCollapsed ? '▲' : '▼'}
    </button>

    {#if !deckCollapsed}
      <div class="deck-content">
        <div class="agent-tabs">
          {#each agents as _, ai}
            <button
              class="agent-tab"
              class:active={selectedAgent === ai}
              style="--agent-color: {AGENT_COLORS[ai]}"
              onclick={() => selectedAgent = ai}
            >
              Agent {ai + 1}
            </button>
          {/each}
        </div>

        <div class="deck-row">
          <div class="cards-scroll">
            {#each decks[selectedAgent] as card, i}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="card"
                class:card-active={agents[selectedAgent].cardIndex === i && (isPlaying || agents[selectedAgent].state !== 'IDLE')}
                onmousedown={(e) => startDrag(i, e)}
                ontouchstart={(e) => { e.preventDefault(); startDrag(i, e) }}
              >
                <button class="card-clear" onclick={(e) => clearTarget(i, e)}>×</button>
                <div class="card-type">{card.type === 'extract' ? 'EXTRACT' : 'DEPOSIT'}</div>
                {#if card.target}
                  <div class="card-node">{card.target.emoji} {card.target.label}</div>
                {:else}
                  <div class="card-node no-target">— assign<br/>target —</div>
                {/if}
              </div>
            {/each}
          </div>

          <div class="ctrl-panel">
            <button class="ctrl-btn" onclick={doPlay} disabled={isPlaying}>▶ Play</button>
            <button class="ctrl-btn" onclick={doStop} disabled={!isPlaying}>⏹ Stop</button>
            <button class="ctrl-btn" onclick={doReset}>↺ Reset</button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .root {
    position: relative;
    width: 100%;
    height: 100%;
    background: #0a0a0a;
    overflow: hidden;
    font-family: monospace;
  }

  .rotate-overlay {
    position: absolute;
    inset: 0;
    background: #0a0a0a;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #e8e8e8;
    font-size: 1.2rem;
    z-index: 100;
  }

  canvas {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: grab;
  }
  canvas:active {
    cursor: grabbing;
  }

  .hud {
    position: absolute;
    top: 12px;
    left: 12px;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    font-size: 1.1rem;
    padding: 6px 12px;
    border-radius: 8px;
    pointer-events: none;
    z-index: 10;
    white-space: nowrap;
  }

  .back-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    background: transparent;
    border: 1px solid #333;
    color: #888;
    font-family: monospace;
    font-size: 14px;
    padding: 6px 14px;
    border-radius: 6px;
    cursor: pointer;
    z-index: 10;
    transition: color 0.2s, border-color 0.2s;
  }
  .back-btn:hover {
    color: #e8e8e8;
    border-color: #7c3aed;
  }

  .ghost-card {
    position: fixed;
    width: 72px;
    background: #1a1a1a;
    border: 1px solid #7c3aed;
    border-radius: 10px;
    padding: 8px 6px;
    pointer-events: none;
    opacity: 0.88;
    z-index: 200;
    transform: translate(-50%, -50%);
    text-align: center;
    box-shadow: 0 0 12px rgba(124, 58, 237, 0.4);
  }
  .ghost-type {
    font-size: 9px;
    letter-spacing: 0.08em;
    color: #aaa;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .ghost-target {
    font-size: 10px;
    color: #e8e8e8;
  }

  .deck-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(10, 10, 10, 0.88);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-top: 1px solid #222;
    z-index: 20;
    display: flex;
    flex-direction: column;
  }

  .deck-toggle {
    align-self: center;
    background: transparent;
    border: none;
    color: #666;
    font-size: 14px;
    cursor: pointer;
    padding: 4px 24px;
    height: 32px;
    line-height: 1;
    transition: color 0.15s;
  }
  .deck-toggle:hover {
    color: #e8e8e8;
  }

  .deck-content {
    display: flex;
    flex-direction: column;
  }

  .agent-tabs {
    display: flex;
    gap: 6px;
    padding: 0 12px 6px;
  }

  .agent-tab {
    padding: 4px 14px;
    background: transparent;
    border: 1px solid #333;
    border-radius: 6px;
    color: #666;
    font-family: monospace;
    font-size: 12px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
    min-height: 32px;
  }
  .agent-tab.active {
    border-color: var(--agent-color);
    color: var(--agent-color);
    background: rgba(255, 255, 255, 0.04);
  }

  .deck-row {
    display: flex;
    align-items: center;
    height: 136px;
    overflow: hidden;
  }

  .cards-scroll {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    overflow-x: auto;
    overflow-y: hidden;
    height: 100%;
    scrollbar-width: thin;
    scrollbar-color: #333 transparent;
  }

  .card {
    flex-shrink: 0;
    width: 80px;
    height: 110px;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 10px;
    padding: 8px 6px;
    position: relative;
    cursor: grab;
    user-select: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .card:active {
    cursor: grabbing;
  }

  .card-active {
    border-color: #7c3aed;
    box-shadow: 0 0 12px rgba(124, 58, 237, 0.27);
  }

  .card-clear {
    position: absolute;
    top: 3px;
    right: 4px;
    background: transparent;
    border: none;
    color: #555;
    font-size: 14px;
    cursor: pointer;
    line-height: 1;
    padding: 2px 3px;
    border-radius: 3px;
    transition: color 0.15s;
  }
  .card-clear:hover {
    color: #e8e8e8;
  }

  .card-type {
    font-size: 8.5px;
    letter-spacing: 0.08em;
    color: #666;
    text-transform: uppercase;
    text-align: center;
    margin-top: 2px;
  }

  .card-node {
    font-size: 11px;
    color: #e8e8e8;
    text-align: center;
    word-break: break-word;
    padding: 0 2px;
    line-height: 1.3;
  }
  .card-node.no-target {
    color: #444;
    font-style: italic;
    font-size: 10px;
  }

  .ctrl-panel {
    flex-shrink: 0;
    width: 150px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    gap: 6px;
    padding: 10px 12px;
    border-left: 1px solid #222;
    height: 100%;
    box-sizing: border-box;
  }

  .ctrl-btn {
    padding: 8px 0;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 8px;
    color: #e8e8e8;
    font-family: monospace;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    min-height: 38px;
  }
  .ctrl-btn:hover:not(:disabled) {
    background: #7c3aed;
    border-color: #7c3aed;
    color: #fff;
  }
  .ctrl-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
</style>
