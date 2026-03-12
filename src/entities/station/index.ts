// ============================================================
// entities/station/definition.ts + behavior.ts (combined)
// ============================================================

import type { ItemId } from '../../data/items'
import type { World, EntityId } from '../../engine/ECS'
import {
  mkPosition, mkHealth, mkStation, mkCrafting, mkRenderable, mkInventory
} from '../../engine/components/index'

export interface StationDefinition {
  id: string
  name: string
  description: string
  buildCost: { itemId: ItemId; amount: number }[]
  health: number
  storageCapacity: number
  cpuCapacity: number
  allowedRecipes: string[]
  color: string
  size: number
}

export const STATION_DEF: StationDefinition = {
  id: 'station',
  name: 'Processing Station',
  description: 'Hub for smelting, fabrication, and drone coordination.',
  buildCost: [
    { itemId: 'iron_plate', amount: 20 },
    { itemId: 'steel',      amount: 10 },
  ],
  health: 200,
  storageCapacity: 5000,
  cpuCapacity: 8,
  allowedRecipes: ['smelt_iron', 'smelt_steel', 'refine_silicon', 'melt_ice', 'craft_circuit', 'make_fuel_cell'],
  color: '#88CCAA',
  size: 20,
}

export function spawnStation(world: World, x: number, y: number, systemId: string, name?: string, recipeIds?: string[]): EntityId {
  const id = world.createEntity()
  const def = STATION_DEF

  world.addComponent(id, mkPosition(x, y, systemId))
  world.addComponent(id, mkHealth(def.health))
  world.addComponent(id, mkStation(name ?? def.name, def.storageCapacity, def.cpuCapacity))
  world.addComponent(id, mkInventory(50))
  world.addComponent(id, mkCrafting(recipeIds ?? def.allowedRecipes))
  world.addComponent(id, mkRenderable('hexagon', def.color, def.size, 1, name ?? 'STA'))

  world.addTag(id, 'station')
  return id
}
