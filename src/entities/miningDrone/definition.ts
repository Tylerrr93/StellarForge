// ============================================================
// entities/miningDrone/definition.ts
// ============================================================

import type { ItemId } from '../../data/items'

export interface MiningDroneDefinition {
  id: 'miningDrone'
  name: string
  description: string
  buildCost: { itemId: ItemId; amount: number }[]
  health: number
  speed: number
  inventorySlots: number
  miningRate: number         // units/second base
  cpuCost: number
  color: string
}

export const MINING_DRONE_DEF: MiningDroneDefinition = {
  id: 'miningDrone',
  name: 'Mining Drone Mk.I',
  description: 'A small autonomous unit equipped with laser cutters for resource extraction.',
  buildCost: [
    { itemId: 'drone_frame',   amount: 1 },
    { itemId: 'basic_circuit', amount: 1 },
    { itemId: 'thruster_unit', amount: 1 },
  ],
  health: 50,
  speed: 80,
  inventorySlots: 8,
  miningRate: 1,
  cpuCost: 1,
  color: '#FF9944',
}

