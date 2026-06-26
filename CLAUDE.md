# hermes-gamelab

A minimalist game prototype lab. Dark theme, Svelte 5 + Vite, GitHub Pages deployment.

## Project Goal
A mobile-friendly game launcher at a single URL. Games are Svelte components. The home screen lists games by category, with archive support.

## Design System
- **Theme:** Dark only. Background `#0a0a0a`, surfaces `#111`, borders `#222`. Text `#e8e8e8`.
- **Accent:** `#7c3aed` (violet) for interactive elements.
- **Font:** System monospace for UI chrome, system sans for game content.
- **Animations:** Smooth, subtle — 200-300ms easing. Nothing jarring.
- **Mobile-first:** Touch targets ≥ 44px. Playable on a phone screen (375px wide).

## Architecture
- `src/games/` — one subfolder per game, each with an `index.svelte` as the main component
- `src/lib/components/` — reusable game components (Card, Token, Button, etc.)
- `src/lib/store.js` — game registry (list of all games with metadata)
- `src/App.svelte` — home screen / router
- `src/main.js` — entry point

## Game Registry Format (src/lib/store.js)
Each game entry:
```js
{
  id: 'flappy',
  title: 'Flappy Dot',
  category: 'arcade',
  archived: false,
  component: FlappyGame  // imported Svelte component
}
```

## Home Screen
- Shows game cards grouped by category
- Toggle to show/hide archived games
- Tap a card → launches the game full-screen
- Back button returns to home

## Key Commands
- `npm run dev` — dev server on :5173
- `npm run build` — build to `dist/`
- `npm run preview` — preview built app

## Deployment
GitHub Pages from `dist/` folder via the `gh-pages` branch (using `gh-pages` npm package).
Base path in vite.config.js must be `/hermes-gamelab/`.
