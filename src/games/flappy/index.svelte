<script>
  import { onMount, onDestroy } from 'svelte'

  let { onBack } = $props()

  let canvas
  let ctx
  let animFrame
  let gameState = $state('waiting') // waiting | playing | dead

  const W = 400
  const H = 600
  const GRAVITY = 0.5
  const FLAP = -9
  const PIPE_W = 52
  const GAP = 160
  const PIPE_SPEED = 2.5
  const PIPE_INTERVAL = 90

  let bird = $state({ x: 80, y: H / 2, vy: 0, r: 14 })
  let pipes = $state([])
  let score = $state(0)
  let bestScore = $state(0)
  let frame = 0

  function reset() {
    bird = { x: 80, y: H / 2, vy: 0, r: 14 }
    pipes = []
    score = 0
    frame = 0
    gameState = 'waiting'
  }

  function flap() {
    if (gameState === 'dead') {
      reset()
      return
    }
    if (gameState === 'waiting') gameState = 'playing'
    bird.vy = FLAP
  }

  function spawnPipe() {
    const topH = 60 + Math.random() * (H - GAP - 120)
    pipes = [...pipes, { x: W, topH, passed: false }]
  }

  function tick() {
    if (gameState !== 'playing') {
      animFrame = requestAnimationFrame(tick)
      draw()
      return
    }

    frame++
    bird.vy += GRAVITY
    bird.y += bird.vy

    if (frame % PIPE_INTERVAL === 0) spawnPipe()

    pipes = pipes
      .map(p => ({ ...p, x: p.x - PIPE_SPEED }))
      .filter(p => p.x > -PIPE_W)

    for (const p of pipes) {
      if (!p.passed && p.x + PIPE_W < bird.x) {
        p.passed = true
        score++
      }
      const birdRight = bird.x + bird.r
      const birdLeft = bird.x - bird.r
      const birdTop = bird.y - bird.r
      const birdBottom = bird.y + bird.r
      if (birdRight > p.x && birdLeft < p.x + PIPE_W) {
        if (birdTop < p.topH || birdBottom > p.topH + GAP) {
          die()
          return
        }
      }
    }

    if (bird.y + bird.r > H || bird.y - bird.r < 0) {
      die()
      return
    }

    draw()
    animFrame = requestAnimationFrame(tick)
  }

  function die() {
    gameState = 'dead'
    if (score > bestScore) bestScore = score
    draw()
    animFrame = requestAnimationFrame(tick)
  }

  function draw() {
    if (!ctx) return
    ctx.clearRect(0, 0, W, H)

    // background
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, W, H)

    // pipes
    for (const p of pipes) {
      ctx.fillStyle = '#7c3aed'
      ctx.fillRect(p.x, 0, PIPE_W, p.topH)
      ctx.fillStyle = '#6d28d9'
      ctx.fillRect(p.x, p.topH + GAP, PIPE_W, H - p.topH - GAP)
      // pipe caps
      ctx.fillStyle = '#8b5cf6'
      ctx.fillRect(p.x - 4, p.topH - 12, PIPE_W + 8, 12)
      ctx.fillRect(p.x - 4, p.topH + GAP, PIPE_W + 8, 12)
    }

    // bird
    ctx.beginPath()
    ctx.arc(bird.x, bird.y, bird.r, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    // score
    ctx.fillStyle = '#e8e8e8'
    ctx.font = 'bold 28px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(score, W / 2, 48)

    if (gameState === 'waiting') {
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.font = '18px monospace'
      ctx.fillText('tap to start', W / 2, H / 2 + 52)
    }

    if (gameState === 'dead') {
      ctx.fillStyle = 'rgba(10,10,10,0.72)'
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#e8e8e8'
      ctx.font = 'bold 32px monospace'
      ctx.fillText('game over', W / 2, H / 2 - 36)
      ctx.font = '22px monospace'
      ctx.fillStyle = '#7c3aed'
      ctx.fillText(`score: ${score}`, W / 2, H / 2 + 4)
      ctx.fillStyle = '#888'
      ctx.font = '16px monospace'
      ctx.fillText(`best: ${bestScore}`, W / 2, H / 2 + 32)
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '16px monospace'
      ctx.fillText('tap to restart', W / 2, H / 2 + 68)
    }
  }

  onMount(() => {
    ctx = canvas.getContext('2d')
    animFrame = requestAnimationFrame(tick)
  })

  onDestroy(() => {
    if (animFrame) cancelAnimationFrame(animFrame)
  })
</script>

<div class="wrapper">
  <button class="back" onclick={onBack}>← back</button>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <canvas
    bind:this={canvas}
    width={W}
    height={H}
    onclick={flap}
    ontouchstart={(e) => { e.preventDefault(); flap() }}
  ></canvas>
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
    z-index: 10;
    transition: color 0.2s, border-color 0.2s;
  }
  .back:hover {
    color: #e8e8e8;
    border-color: #7c3aed;
  }
  canvas {
    display: block;
    max-width: 100%;
    max-height: calc(100vh - 60px);
    border-radius: 8px;
    touch-action: none;
    cursor: pointer;
  }
</style>
