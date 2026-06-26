import { writable } from 'svelte/store'
import FlappyGame from '../games/flappy/index.svelte'
import CounterGame from '../games/counter/index.svelte'

export const games = [
  {
    id: 'flappy',
    title: 'Flappy Dot',
    category: 'arcade',
    archived: false,
    component: FlappyGame,
  },
  {
    id: 'counter',
    title: 'Tap Counter',
    category: 'casual',
    archived: false,
    component: CounterGame,
  },
]

export const activeGame = writable(null)
export const showArchived = writable(false)
