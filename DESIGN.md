# Automaton — Game Design Document

*Working title. Roguelike automation game.*
*Last updated: 2026-06-26*

---

## Concept

A Mini Metro-style idle/automation game where the player programs agents with card decks instead of drawing lines. Agents loop through their deck autonomously. The challenge is composing the right deck to solve each level's resource puzzle before time/resources run out.

**Inspirations:** Mini Metro, Opus Magnum, Zachtronics, Balatro, Slay the Spire, idle games.
**Tone:** Chill but strategic. Roguelike progression. No frantic clicking.

---

## Core Loop

1. **Setup phase** — assign card targets by dragging cards to map nodes
2. **Run phase** — hit Play; agents execute their decks in a loop automatically
3. **End** — stop or reset; future versions will have win/fail conditions per level

---

## Interface

### Layout
- **Landscape orientation only** (rotate prompt in portrait)
- **Top**: map fills most of the screen (pannable, pinch-zoomable)
- **Bottom strip** (~180px, fixed to screen): agent's card deck + Play/Stop/Reset controls
- **Top-left HUD**: resource counters (🪙 gold etc.)
- The deck strip is camera-fixed — the map scrolls beneath it

### Map
- Top-down, canvas-rendered at 60fps
- Procedurally generated island (irregular blob) surrounded by water
- World size ~1200×800 units
- Camera: pan by drag, zoom by pinch; zoom only affects map, not deck strip
- Nodes: filled circles (~24px radius) with emoji + label

### Card Deck
- Up to **10 cards** per agent (Slay the Spire-style)
- Cards are ~80×100px, dark surface, violet border when active/executing
- Currently executing card glows violet during agent loop
- Cards show: type name (top) + assigned target (middle) + clear button

### Target Assignment
- **Drag a card onto a map node** → assigns it as the card's target
- Valid nodes glow violet while dragging
- Drop on empty map → cancel drag
- Each card remembers one target; target name shown on card

### Controls
- ▶ **Play** — start agent loop (requires all cards to have targets)
- ⏹ **Stop** — pause loop
- ↺ **Reset** — return agent to base, clear gold, keep card assignments

---

## Agents

- Small white circles (~10px) on the map
- Start at the Base
- Each agent has its own deck
- Executes cards in order, loops forever
- Shows inventory badge above (e.g. `3🪙`) while carrying resources
- Inventory cap: 5 items (subject to tuning)
- **Starting agent**: 1 agent, deck of 2 cards (1 Extract + 1 Deposit, unassigned)
- Future: craft new agents from resources (von Neumann machine vibes)

---

## Cards

### Prototype cards (v0.1)

| Card | Behaviour |
|------|-----------|
| **Extract** | Agent walks to target node → works 0.5s → gains +1 resource to inventory |
| **Deposit** | Agent walks to target node (base) → transfers all inventory to base counter |

### Future card ideas (not built yet)
- Move (walk to a location, no action)
- Craft (combine resources at a workstation)
- Conditional / branch cards
- Wait
- Upgrade cards (roguelike shop)

---

## Map Nodes (Level 1)

| Node | Emoji | Colour | Notes |
|------|-------|--------|-------|
| Base (Air Balloon) | 🎈 | Violet | Fixed at island centre; agents start here |
| Gold Mine ×3 | ⛏ | Yellow | Yields gold |
| Rock ×3 | 🪨 | Grey | Yields stone (future) |
| Tree ×3 | 🌲 | Green | Yields wood (future) |

- Nodes are placed randomly on land for each level
- Resources on nodes are unlimited for now (no depletion)
- Future: node depletion, rare nodes, unlockable nodes

---

## Resources

- **Gold 🪙** — primary resource, shown top-left HUD
- More resource types planned (stone, wood, crafted items)
- Base accumulates resources; no sink yet (future: taxes, upkeep, crafting costs)

---

## Progression (future, not built)

- Roguelike: play until fail (resource debt, timer, enemy pressure — TBD)
- Score = total resources deposited
- Between levels: card shop / upgrade choices (Slay the Spire style)
- New agents cost resources to create
- Levels = new islands, harder layouts, new resource types

---

## Visual Style

- **Dark theme** throughout (`#0a0a0a` bg, `#111` surfaces, `#222` borders)
- **Accent**: `#7c3aed` violet for active/interactive elements
- Map: water `#1a2a3a`, island `#2d3a2d` (dark green)
- Fonts: system monospace for UI chrome, system sans for labels
- Smooth animations (200–300ms easing); 60fps canvas
- No jarring flashes; `-webkit-tap-highlight-color: transparent` globally

---

## Technical

- **Framework**: Svelte 5 + Vite
- **Rendering**: HTML canvas for map; HTML/CSS for deck strip
- **Deployment**: GitHub Pages at `https://grigorysolomatov.github.io/hermes-gamelab/`
- **Repo**: `github.com/grigorysolomatov/hermes-gamelab`
- **Local path**: `/opt/data/projects/hermes-gamelab`
- Each game lives in `src/games/<id>/index.svelte`
- Registered in `src/lib/store.js`

---

## Game Design Principles

### Core pillars
- **Simplicity of interaction, depth of strategy** — the drag-card-to-node mechanic is the vocabulary; protect it. Every new feature should fit this interaction model.
- **"One more loop" feeling** — the player should always feel one small deck change away from things working better. Immediate feedback from agent behaviour is key.
- **Automation as spectacle** — the joy is watching your system work (or fail spectacularly). Runs that fail visibly and absurdly are often more satisfying than quiet successes.
- **Progress pressure** — idle automation only feels meaningful under pressure. Every run needs a closing loss condition that feels fair and earned (see below).

### Lessons from similar games
- **Mini Metro**: kills you with overcrowding — you feel it coming, you make desperate decisions, you lose and immediately want to retry. Emulate this: loss should feel like *your* fault in a satisfying way.
- **Balatro / Slay the Spire**: small number of card types × combinatorics = enormous viable strategies. You don't need many cards — you need cards that *interact surprisingly*.
- **Vampire Survivors**: respects attention — always something to watch, always a micro-decision. Downtime is dangerous.
- **Opus Magnum**: clean interface, deep puzzles. Never sacrifice interface clarity for feature richness.

### Interaction vocabulary (protect this)
- Drag card → map node = assign target
- Tap agent = view/edit deck
- Play/Stop/Reset = the only global controls needed

### On card design
Current primitives (Extract, Deposit) are good. A third card type that enables *interaction between agents or nodes* would multiply the design space enormously (e.g. Craft, Transfer, Move, Conditional).

## Open Questions / Future Decisions

- **Loss condition** — what kills the run? Options: timer, resource debt/taxes, node depletion, environmental hazard. Should feel telegraphed and fair.
- **Third card type** — what enables surprising combos with Extract + Deposit?
- **New agent creation** — costs resources, von Neumann style. When does this unlock?
- Map size scaling as game progresses
- Card draw / hand mechanic (or always see full deck?)
- Sound design (Mini Metro used minimalist procedural audio — worth exploring)
- Node depletion (finite resources per node, forcing agent reassignment mid-run)
