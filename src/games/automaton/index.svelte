<script>
  import { onMount, onDestroy } from 'svelte'

  let { onBack } = $props()

  // ---- Constants ----
  const DECK_H = 180
  const AGENT_SPEED = 80
  const WORK_TIME = 0.5
  const INV_CAP = 5
  const ZOOM_MIN = 0.4
  const ZOOM_MAX = 2.0

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

  let agent = $state({
    x: 0, y: 0,
    state: 'IDLE',
    cardIndex: 0,
    inventory: 0,
    workTimer: 0,
  })

  let deck = $state([
    { type: 'extract', target: null },
    { type: 'deposit', target: null },
  ])

  let baseGold = $state(0)
  let isPlaying = $state(false)
  let dragging = $state(null) // { cardIndex, ghostX, ghostY }

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

    // Water
    ctx.fillStyle = '#1a2a3a'
    ctx.fillRect(0, 0, W, H)

    // Island polygon
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

    // Nodes
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

    // Agent
    const [ax, ay] = w2s(agent.x, agent.y)
    const agR = Math.max(6, 10 * cam.zoom)

    // Violet arc around agent
    ctx.beginPath()
    ctx.arc(ax, ay, agR + 5, -Math.PI / 2, Math.PI * 1.5)
    ctx.strokeStyle = '#7c3aed'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(ax, ay, agR, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    // Inventory badge
    if (agent.inventory > 0) {
      const bx = ax
      const by = ay - agR - 14
      const text = `${agent.inventory}🪙`
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
      ctx.fillStyle = '#ffffff'
      ctx.fillText(text, bx, by)
    }
  }

  // ---- Game loop ----
  function tick(ts) {
    const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0
    lastTs = ts
    if (isPlaying) updateAgent(dt)
    draw()
    raf = requestAnimationFrame(tick)
  }

  // ---- Agent state machine ----
  function updateAgent(dt) {
    if (!deck.length) return

    if (agent.state === 'IDLE') {
      // Find next card with a target, starting from current index
      let found = false
      for (let i = 0; i < deck.length; i++) {
        const ni = (agent.cardIndex + i) % deck.length
        if (deck[ni]?.target) {
          agent.cardIndex = ni
          found = true
          break
        }
      }
      if (!found) return
      agent.state = 'MOVING'
      return
    }

    if (agent.state === 'MOVING') {
      const card = deck[agent.cardIndex]
      if (!card?.target) { agent.state = 'IDLE'; return }
      const dx = card.target.x - agent.x
      const dy = card.target.y - agent.y
      const dist = Math.hypot(dx, dy)
      if (dist < 2) {
        agent.x = card.target.x
        agent.y = card.target.y
        agent.state = 'WORKING'
        agent.workTimer = 0
      } else {
        const mv = AGENT_SPEED * dt
        agent.x += (dx / dist) * Math.min(mv, dist)
        agent.y += (dy / dist) * Math.min(mv, dist)
      }
      return
    }

    if (agent.state === 'WORKING') {
      agent.workTimer += dt
      if (agent.workTimer >= WORK_TIME) {
        const card = deck[agent.cardIndex]
        if (card?.type === 'extract') {
          agent.inventory = Math.min(agent.inventory + 1, INV_CAP)
        } else if (card?.type === 'deposit') {
          baseGold += agent.inventory
          agent.inventory = 0
        }
        agent.cardIndex = (agent.cardIndex + 1) % deck.length
        agent.state = 'IDLE'
      }
    }
  }

  // ---- Controls ----
  function doPlay() { isPlaying = true }
  function doStop() { isPlaying = false }
  function doReset() {
    isPlaying = false
    baseGold = 0
    agent = { x: 0, y: 0, state: 'IDLE', cardIndex: 0, inventory: 0, workTimer: 0 }
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
      deck = deck.map((c, i) => i === idx ? { ...c, target: hitNode } : c)
    }
    dragging = null
  }

  function clearTarget(cardIndex, e) {
    e.stopPropagation()
    deck = deck.map((c, i) => i === cardIndex ? { ...c, target: null } : c)
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

  <!-- Map area -->
  <div class="map-area">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <canvas
      bind:this={canvasEl}
      onmousedown={onCanvasMouseDown}
      ontouchstart={onCanvasTouchStart}
    ></canvas>

    <div class="hud">🪙 {baseGold}</div>

    <button class="back-btn" onclick={onBack}>← back</button>

    {#if dragging !== null}
      <div
        class="ghost-card"
        style="left:{dragging.ghostX}px;top:{dragging.ghostY}px"
      >
        <div class="ghost-type">{deck[dragging.cardIndex]?.type === 'extract' ? 'EXTRACT' : 'DEPOSIT'}</div>
        <div class="ghost-target">
          {#if deck[dragging.cardIndex]?.target}
            {deck[dragging.cardIndex].target.emoji} {deck[dragging.cardIndex].target.label}
          {:else}
            — assign target —
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Deck strip -->
  <div class="deck-strip">
    <div class="cards-scroll">
      {#each deck as card, i}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="card"
          class:card-active={agent.cardIndex === i && (isPlaying || agent.state !== 'IDLE')}
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

<style>
  .root {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
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

  .map-area {
    position: relative;
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  .map-area canvas {
    position: absolute;
    inset: 0;
    display: block;
    touch-action: none;
    cursor: grab;
  }
  .map-area canvas:active {
    cursor: grabbing;
  }

  .hud {
    position: absolute;
    top: 12px;
    left: 12px;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    font-size: 1.2rem;
    padding: 6px 12px;
    border-radius: 8px;
    pointer-events: none;
    z-index: 10;
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

  .deck-strip {
    flex-shrink: 0;
    height: 180px;
    background: #111;
    border-top: 1px solid #333;
    display: flex;
    align-items: center;
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
    padding: 8px 6px 8px 6px;
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
    width: 160px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    gap: 6px;
    padding: 12px 14px;
    border-left: 1px solid #222;
    height: 100%;
    box-sizing: border-box;
  }

  .ctrl-btn {
    padding: 9px 0;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 8px;
    color: #e8e8e8;
    font-family: monospace;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    min-height: 44px;
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
