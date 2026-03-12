// ============================================================
// engine/systems/craftingSystem.ts - Runs station recipes.
// ============================================================

import type { System, World } from '../ECS'
import { COMPONENT_TYPES, type CraftingComponent, type StationComponent } from '../components/index'
import { getRecipe } from '../../data/recipes'

function stationCraft(world: World, entityId: number, dt: number): void {
  const crafting = world.getComponent<CraftingComponent>(entityId, COMPONENT_TYPES.CRAFTING)
  const station  = world.getComponent<StationComponent>(entityId, COMPONENT_TYPES.STATION)
  if (!crafting || !station) return

  if (!crafting.activeRecipeId) return

  let recipe
  try {
    recipe = getRecipe(crafting.activeRecipeId)
  } catch {
    crafting.activeRecipeId = null
    crafting.progress = 0
    return
  }

  crafting.progress += dt / recipe.processingTimeSec

  if (crafting.progress >= 1) {
    crafting.progress = 0
    for (const out of recipe.outputs) {
      const current = station.storage.get(out.itemId) ?? 0
      station.storage.set(out.itemId, current + out.amount)
    }
    crafting.activeRecipeId = null
  }
}

export const craftingSystem: System = {
  name: 'craftingSystem',
  priority: 20,

  update(world: World, dt: number): void {
    const entities = world.query(COMPONENT_TYPES.CRAFTING)
    for (const id of entities) stationCraft(world, id, dt)
  }
}
