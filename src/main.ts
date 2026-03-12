// ============================================================
// main.ts — Entry point. Boot the game.
// ============================================================

import { Game } from './engine/Game'
import { UIManager } from './ui/uiManager'
import { TECHNOLOGIES } from './data/technologies'

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
if (!canvas) throw new Error('Canvas not found')

const game = new Game(canvas)
const ui   = new UIManager(game)

// Expose research hook for UI
window._game = {
  researchTech(id: string) {
    const tech = TECHNOLOGIES[id]
    if (!tech) return
    if (game.state.researchPoints < tech.researchCost) {
      alert(`Need ${tech.researchCost} research points (have ${game.state.researchPoints})`)
      return
    }
    if (game.state.unlockedTechs.includes(id)) return
    game.state.researchPoints -= tech.researchCost
    game.state.unlockedTechs.push(id)
    console.log(`Researched: ${tech.name}`)
  },
  attachHarvest(targetId: number, itemId: string) {
    game.attachToBody(targetId, itemId)
  },
  detach() { game.detachFromBody() },
}

// Start the engine
game.start()

// UI update loop (independent of game loop)
function uiLoop() {
  ui.update()
  requestAnimationFrame(uiLoop)
}
uiLoop()

console.log('🚀 StellarForge initialized. Good luck out there.')
