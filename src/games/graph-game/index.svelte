<script>
  import { onMount, onDestroy } from 'svelte'

  let { onBack } = $props()

  // ---- Constants ----
  const TICK_MS = 500
  const NODE_RADIUS = 32
  const RESOURCE_TRAVEL_MS = 300
  const TOOLBAR_HEIGHT = 80

  const NODE_TYPES = {
    worker:   { label: 'Worker',   color: '#3b82f6', emoji: '👷' },
    investor: { label: 'Investor', color: '#f59e0b', emoji: '💼' },
    banker:   { label: 'Banker',   color: '#10b981', emoji: '🏦' },
    lumberjack: { label: 'Lumberjack', color: '#84cc16', emoji: '🪓' },
    merchant: { label: 'Merchant', color: '#f97316', emoji: '🪵' },
  }

  const RESOURCE_COLORS = {
    coin: '#fbbf24',
    wood: '#92400e',
  }

  // ---- State ----
  let svgEl = $state(null)
  let svgWidth = $state(400)
  let svgHeight = $state(600)

  let nodes = $state([])
  let edges = $state([])
  let animations = $state([]) // { id, type, x, y, tx, ty, startTime }
  let bank = $state(0)
  let nodeResources = $state({}) // nodeId -> { coin: n, wood: n }

  // Mode: 'move' | 'connect' | 'delete' | 'place'
  let mode = $state('move')
  let selectedNodeType = $state(null) // for place mode
  let connectSource = $state(null)    // nodeId for connect mode
  let draggingNode = $state(null)     // { id, offsetX, offsetY }
  let dragMoved = $state(false)

  let nextId = 0
  let animNextId = 0

  // ---- Init ----
  onMount(() => {
    resize()
    window.addEventListener('resize', resize)

    // Start with one Worker near center
    const cx = svgWidth / 2
    const cy = (svgHeight - TOOLBAR_HEIGHT) / 2
    addNode('worker', cx, cy)

    // Start tick
    const interval = setInterval(gameTick, TICK_MS)

    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', resize)
    }
  })

  function resize() {
    if (!svgEl) return
    svgWidth = svgEl.clientWidth || window.innerWidth
    svgHeight = svgEl.clientHeight || window.innerHeight
  }

  // ---- Node/Edge helpers ----
  function addNode(type, x, y) {
    const id = `n${nextId++}`
    nodes = [...nodes, { id, type, x, y }]
    nodeResources = { ...nodeResources, [id]: { coin: 0, wood: 0 } }
    return id
  }

  function removeNode(id) {
    nodes = nodes.filter(n => n.id !== id)
    edges = edges.filter(e => e.from !== id && e.to !== id)
    const nr = { ...nodeResources }
    delete nr[id]
    nodeResources = nr
    if (connectSource === id) connectSource = null
  }

  function removeEdge(id) {
    edges = edges.filter(e => e.id !== id)
  }

  function addEdge(from, to) {
    // Don't duplicate
    if (edges.some(e => e.from === from && e.to === to)) return
    if (from === to) return
    const id = `e${nextId++}`
    edges = [...edges, { id, from, to }]
  }

  function getNode(id) {
    return nodes.find(n => n.id === id)
  }

  function outgoingEdges(nodeId) {
    return edges.filter(e => e.from === nodeId)
  }

  // ---- Game Tick ----
  function gameTick() {
    const newResources = {}
    for (const n of nodes) {
      newResources[n.id] = { ...(nodeResources[n.id] || { coin: 0, wood: 0 }) }
    }

    // Process each node
    for (const n of nodes) {
      const res = newResources[n.id]
      const outs = outgoingEdges(n.id)

      if (n.type === 'worker') {
        // Produce 1 coin, send out
        sendResource(n, outs, 'coin', 1, newResources)
      }

      if (n.type === 'lumberjack') {
        // Produce 1 wood, send out
        sendResource(n, outs, 'wood', 1, newResources)
      }

      if (n.type === 'investor') {
        // Convert 1 coin → 3 coins, send out
        if (res.coin >= 1) {
          res.coin -= 1
          sendResource(n, outs, 'coin', 3, newResources)
        }
      }

      if (n.type === 'merchant') {
        // Convert 1 wood → 2 coins, send out
        if (res.wood >= 1) {
          res.wood -= 1
          sendResource(n, outs, 'coin', 2, newResources)
        }
      }

      if (n.type === 'banker') {
        // Absorb all coins into bank
        if (res.coin > 0) {
          bank += res.coin
          res.coin = 0
        }
      }
    }

    nodeResources = newResources
  }

  function sendResource(fromNode, outs, type, amount, newResources) {
    if (outs.length === 0) return
    // Send each unit along a random outgoing edge
    for (let i = 0; i < amount; i++) {
      const edge = outs[Math.floor(Math.random() * outs.length)]
      const toNode = getNode(edge.to)
      if (!toNode) continue
      // Animate
      const animId = `a${animNextId++}`
      const now = performance.now()
      animations = [...animations, {
        id: animId,
        type,
        x: fromNode.x,
        y: fromNode.y,
        tx: toNode.x,
        ty: toNode.y,
        startTime: now,
        duration: RESOURCE_TRAVEL_MS,
        toNodeId: toNode.id,
      }]
      // Schedule arrival
      setTimeout(() => {
        animations = animations.filter(a => a.id !== animId)
        // Deliver resource
        nodeResources = {
          ...nodeResources,
          [toNode.id]: {
            coin: (nodeResources[toNode.id]?.coin || 0) + (type === 'coin' ? 1 : 0),
            wood: (nodeResources[toNode.id]?.wood || 0) + (type === 'wood' ? 1 : 0),
          }
        }
      }, RESOURCE_TRAVEL_MS)
    }
  }

  // ---- Animation frame for resource dots ----
  let animFrame = $state(0)
  let rafId = null

  onMount(() => {
    function loop() {
      animFrame = performance.now()
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  })

  // ---- Toolbar actions ----
  function selectMode(m) {
    mode = m
    selectedNodeType = null
    connectSource = null
  }

  function selectNodeType(t) {
    selectedNodeType = t
    mode = 'place'
    connectSource = null
  }

  // ---- SVG interactions ----
  function getCanvasPoint(e) {
    const rect = svgEl.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : (e.changedTouches ? e.changedTouches[0].clientX : e.clientX)
    const clientY = e.touches ? e.touches[0].clientY : (e.changedTouches ? e.changedTouches[0].clientY : e.clientY)
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  function hitTestNode(x, y) {
    for (const n of [...nodes].reverse()) {
      const dx = n.x - x
      const dy = n.y - y
      if (Math.hypot(dx, dy) <= NODE_RADIUS + 8) return n
    }
    return null
  }

  function hitTestEdge(x, y) {
    for (const e of [...edges].reverse()) {
      const from = getNode(e.from)
      const to = getNode(e.to)
      if (!from || !to) continue
      // Distance from point to line segment
      const d = pointToSegmentDist(x, y, from.x, from.y, to.x, to.y)
      if (d < 12) return e
    }
    return null
  }

  function pointToSegmentDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) return Math.hypot(px - ax, py - ay)
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
  }

  // Touch/pointer handlers on the SVG background
  function onSvgPointerDown(e) {
    if (e.target !== svgEl && !e.target.classList.contains('bg-rect')) return
    if (mode !== 'place') return
    const pt = getCanvasPoint(e)
    if (pt.y > svgHeight - TOOLBAR_HEIGHT) return
    if (selectedNodeType) {
      addNode(selectedNodeType, pt.x, pt.y)
    }
  }

  // Node pointer handlers
  function onNodePointerDown(e, node) {
    e.stopPropagation()
    const pt = getCanvasPoint(e)

    if (mode === 'delete') {
      removeNode(node.id)
      return
    }

    if (mode === 'connect') {
      if (!connectSource) {
        connectSource = node.id
      } else if (connectSource !== node.id) {
        addEdge(connectSource, node.id)
        connectSource = null
      } else {
        connectSource = null
      }
      return
    }

    if (mode === 'move') {
      draggingNode = { id: node.id, offsetX: pt.x - node.x, offsetY: pt.y - node.y }
      dragMoved = false
    }

    if (mode === 'place') {
      // Tap on node in place mode: do nothing special
    }
  }

  function onNodePointerUp(e, node) {
    if (mode === 'move' && draggingNode?.id === node.id && !dragMoved) {
      // It was a tap, not a drag — do nothing extra
    }
    draggingNode = null
  }

  function onSvgPointerMove(e) {
    if (!draggingNode) return
    const pt = getCanvasPoint(e)
    const newY = Math.min(pt.y - draggingNode.offsetY, svgHeight - TOOLBAR_HEIGHT - NODE_RADIUS)
    nodes = nodes.map(n =>
      n.id === draggingNode.id
        ? { ...n, x: pt.x - draggingNode.offsetX, y: newY }
        : n
    )
    dragMoved = true
  }

  function onSvgPointerUp(e) {
    draggingNode = null
  }

  function onEdgeTap(e, edge) {
    e.stopPropagation()
    if (mode === 'delete') {
      removeEdge(edge.id)
    }
  }

  // ---- Arrow geometry ----
  function edgePath(edge) {
    const from = getNode(edge.from)
    const to = getNode(edge.to)
    if (!from || !to) return ''
    const dx = to.x - from.x
    const dy = to.y - from.y
    const len = Math.hypot(dx, dy)
    if (len < 1) return ''
    const ux = dx / len
    const uy = dy / len
    const sx = from.x + ux * NODE_RADIUS
    const sy = from.y + uy * NODE_RADIUS
    const ex = to.x - ux * (NODE_RADIUS + 8)
    const ey = to.y - uy * (NODE_RADIUS + 8)
    return `M${sx},${sy} L${ex},${ey}`
  }

  function arrowHead(edge) {
    const from = getNode(edge.from)
    const to = getNode(edge.to)
    if (!from || !to) return ''
    const dx = to.x - from.x
    const dy = to.y - from.y
    const len = Math.hypot(dx, dy)
    if (len < 1) return ''
    const ux = dx / len
    const uy = dy / len
    const tip = { x: to.x - ux * NODE_RADIUS, y: to.y - uy * NODE_RADIUS }
    const base = { x: tip.x - ux * 12, y: tip.y - uy * 12 }
    const lx = base.x - uy * 6
    const ly = base.y + ux * 6
    const rx = base.x + uy * 6
    const ry = base.y - ux * 6
    return `M${tip.x},${tip.y} L${lx},${ly} L${rx},${ry} Z`
  }

  // ---- Resource dot position during animation ----
  function animDotPos(anim) {
    const elapsed = animFrame - anim.startTime
    const t = Math.min(1, elapsed / anim.duration)
    return {
      x: anim.x + (anim.tx - anim.x) * t,
      y: anim.y + (anim.ty - anim.y) * t,
    }
  }

  // ---- Resource count label ----
  function resLabel(nodeId) {
    const r = nodeResources[nodeId]
    if (!r) return ''
    const parts = []
    if (r.coin > 0) parts.push(`${r.coin}💰`)
    if (r.wood > 0) parts.push(`${r.wood}🪵`)
    return parts.join(' ')
  }

  function totalRes(nodeId) {
    const r = nodeResources[nodeId]
    if (!r) return 0
    return r.coin + r.wood
  }
</script>

<div class="game-wrap">
  <!-- HUD -->
  <div class="hud">
    <button class="back-btn" onclick={onBack}>← Back</button>
    <div class="bank-display">🏦 Bank: <span class="bank-val">{bank}</span> 💰</div>
  </div>

  <!-- SVG Canvas -->
  <svg
    bind:this={svgEl}
    class="canvas"
    onpointerdown={onSvgPointerDown}
    onpointermove={onSvgPointerMove}
    onpointerup={onSvgPointerUp}
  >
    <!-- Background -->
    <rect class="bg-rect" width="100%" height="100%" fill="#0a0a0a" />

    <!-- Defs: arrowhead marker -->
    <defs>
      <marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="#888" />
      </marker>
    </defs>

    <!-- Edges -->
    {#each edges as edge (edge.id)}
      {@const from = getNode(edge.from)}
      {@const to = getNode(edge.to)}
      {#if from && to}
        <!-- Wider invisible hit area for tap/click -->
        <path
          d={edgePath(edge)}
          stroke="transparent"
          stroke-width="20"
          fill="none"
          style="cursor: pointer"
          onpointerdown={(e) => onEdgeTap(e, edge)}
        />
        <path
          d={edgePath(edge)}
          stroke={mode === 'delete' ? '#ef4444' : '#555'}
          stroke-width="2"
          fill="none"
          pointer-events="none"
        />
        <path
          d={arrowHead(edge)}
          fill={mode === 'delete' ? '#ef4444' : '#888'}
          pointer-events="none"
        />
      {/if}
    {/each}

    <!-- Nodes -->
    {#each nodes as node (node.id)}
      {@const ntype = NODE_TYPES[node.type]}
      {@const isConnectSource = connectSource === node.id}
      {@const isDragging = draggingNode?.id === node.id}
      <g
        transform={`translate(${node.x},${node.y})`}
        style="cursor: pointer"
        onpointerdown={(e) => onNodePointerDown(e, node)}
        onpointerup={(e) => onNodePointerUp(e, node)}
      >
        <!-- Glow ring for connect-selected or dragging -->
        {#if isConnectSource}
          <circle r={NODE_RADIUS + 8} fill="none" stroke="#7c3aed" stroke-width="3" opacity="0.9" />
        {/if}
        {#if isDragging}
          <circle r={NODE_RADIUS + 6} fill="none" stroke="#e8e8e8" stroke-width="2" opacity="0.5" />
        {/if}

        <!-- Main circle -->
        <circle
          r={NODE_RADIUS}
          fill={ntype.color}
          stroke={mode === 'delete' ? '#ef4444' : 'none'}
          stroke-width={mode === 'delete' ? 3 : 0}
          opacity="0.92"
        />

        <!-- Emoji -->
        <text
          text-anchor="middle"
          dominant-baseline="central"
          font-size="18"
          pointer-events="none"
        >{ntype.emoji}</text>

        <!-- Resource count -->
        {#if totalRes(node.id) > 0}
          <text
            y={NODE_RADIUS - 10}
            text-anchor="middle"
            dominant-baseline="central"
            font-size="9"
            fill="white"
            pointer-events="none"
            opacity="0.85"
          >{resLabel(node.id)}</text>
        {/if}

        <!-- Label below -->
        <text
          y={NODE_RADIUS + 14}
          text-anchor="middle"
          dominant-baseline="hanging"
          font-size="11"
          fill="#e8e8e8"
          pointer-events="none"
        >{ntype.label}</text>
      </g>
    {/each}

    <!-- Resource animation dots -->
    {#each animations as anim (anim.id)}
      {@const pos = animDotPos(anim)}
      <circle
        cx={pos.x}
        cy={pos.y}
        r="6"
        fill={RESOURCE_COLORS[anim.type]}
        stroke="#0a0a0a"
        stroke-width="1.5"
        pointer-events="none"
      />
    {/each}
  </svg>

  <!-- Toolbar -->
  <div class="toolbar">
    <div class="toolbar-section node-types">
      {#each Object.entries(NODE_TYPES) as [typeKey, typeInfo]}
        <button
          class="tool-btn node-btn"
          class:active={mode === 'place' && selectedNodeType === typeKey}
          style="--node-color: {typeInfo.color}"
          onclick={() => selectNodeType(typeKey)}
          title={typeInfo.label}
        >
          <span class="btn-emoji">{typeInfo.emoji}</span>
          <span class="btn-label">{typeInfo.label.split(' ')[0]}</span>
        </button>
      {/each}
    </div>
    <div class="toolbar-section modes">
      <button
        class="tool-btn mode-btn"
        class:active={mode === 'move'}
        onclick={() => selectMode('move')}
        title="Move nodes"
      >✋ Move</button>
      <button
        class="tool-btn mode-btn"
        class:active={mode === 'connect'}
        onclick={() => selectMode('connect')}
        title="Connect nodes"
      >🔗 Connect</button>
      <button
        class="tool-btn mode-btn"
        class:active={mode === 'delete'}
        onclick={() => selectMode('delete')}
        title="Delete nodes or edges"
      >🗑 Delete</button>
    </div>
  </div>

  <!-- Mode hint -->
  <div class="mode-hint">
    {#if mode === 'move'}
      Drag nodes to reposition
    {:else if mode === 'connect'}
      {#if connectSource}
        Now tap a target node to connect →
      {:else}
        Tap a source node, then a target
      {/if}
    {:else if mode === 'delete'}
      Tap a node or edge to delete it
    {:else if mode === 'place'}
      Tap empty space to place a {NODE_TYPES[selectedNodeType]?.label}
    {/if}
  </div>
</div>

<style>
  .game-wrap {
    position: relative;
    width: 100%;
    height: 100%;
    background: #0a0a0a;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    touch-action: none;
    user-select: none;
  }

  .hud {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
  }

  .back-btn {
    background: transparent;
    border: 1px solid #444;
    color: #e8e8e8;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    font-family: monospace;
    touch-action: manipulation;
  }

  .bank-display {
    font-family: monospace;
    font-size: 15px;
    color: #e8e8e8;
  }

  .bank-val {
    color: #fbbf24;
    font-weight: bold;
  }

  .canvas {
    width: 100%;
    flex: 1;
    display: block;
    touch-action: none;
  }

  .toolbar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 20;
    background: #111;
    border-top: 1px solid #222;
    padding: 8px 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    height: 80px;
    box-sizing: border-box;
  }

  .toolbar-section {
    display: flex;
    gap: 4px;
    justify-content: center;
  }

  .tool-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 48px;
    min-height: 30px;
    padding: 3px 6px;
    border-radius: 8px;
    border: 1.5px solid #333;
    background: #1a1a1a;
    color: #e8e8e8;
    font-size: 10px;
    cursor: pointer;
    touch-action: manipulation;
    transition: background 0.15s, border-color 0.15s;
    gap: 1px;
  }

  .node-btn.active {
    background: color-mix(in srgb, var(--node-color) 30%, #1a1a1a);
    border-color: var(--node-color);
  }

  .mode-btn.active {
    background: #2d1b69;
    border-color: #7c3aed;
  }

  .btn-emoji {
    font-size: 14px;
    line-height: 1;
  }

  .btn-label {
    font-size: 9px;
    color: #aaa;
    line-height: 1;
  }

  .mode-hint {
    position: absolute;
    bottom: 84px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 15;
    background: rgba(0,0,0,0.7);
    color: #888;
    font-size: 11px;
    font-family: monospace;
    padding: 3px 10px;
    border-radius: 12px;
    pointer-events: none;
    white-space: nowrap;
  }
</style>
