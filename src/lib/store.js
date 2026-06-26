import { writable } from 'svelte/store'
import FlappyGame from '../games/flappy/index.svelte'
import CounterGame from '../games/counter/index.svelte'
import AutomatonGame from '../games/automaton/index.svelte'

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
  {
    id: 'automaton',
    title: 'Automaton',
    category: 'strategy',
    archived: false,
    component: AutomatonGame,
  },
]

export const activeGame = writable(null)
export const showArchived = writable(false)
