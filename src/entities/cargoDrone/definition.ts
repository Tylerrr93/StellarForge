// ============================================================
// entities/cargoDrone/definition.ts
// ============================================================
import type { ItemId } from '../../data/items'

export interface CargoDroneDefinition {
  id: 'cargoDrone'
  name: string
  description: string
  buildCost: { itemId: ItemId; amount: number }[]
  health: number
  speed: number
  inventorySlots: number
  cpuCost: number
  color: string
}

export const CARGO_DRONE_DEF: CargoDroneDefinition = {
  id: 'cargoDrone',
  name: 'Cargo Drone Mk.I',
  description: 'Large-capacity drone for ferrying resources between stations.',
  buildCost: [
    { itemId: 'drone_frame',   amount: 2 },
    { itemId: 'basic_circuit', amount: 1 },
    { itemId: 'thruster_unit', amount: 2 },
  ],
  health: 70,
  speed: 60,
  inventorySlots: 24,
  cpuCost: 1,
  color: '#44AAFF',
}
