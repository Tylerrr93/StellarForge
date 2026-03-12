// ============================================================
// data/items.ts — All item definitions.
// To add a new item: add an entry here. Nothing else required.
// ============================================================

export type ItemId = string

export interface ItemDefinition {
  id: ItemId
  name: string
  description: string
  stackSize: number
  category: 'raw' | 'processed' | 'component' | 'fuel' | 'special'
  color: string         // for rendering in UI
  icon: string          // emoji fallback
}

export const ITEMS: Record<ItemId, ItemDefinition> = {
  // ---- Raw Materials ----------------------------------------
  iron_ore: {
    id: 'iron_ore',
    name: 'Iron Ore',
    description: 'Raw iron ore extracted from asteroids.',
    stackSize: 200,
    category: 'raw',
    color: '#8B6F47',
    icon: '🪨',
  },
  silicon_ore: {
    id: 'silicon_ore',
    name: 'Silicon Ore',
    description: 'Raw silicon ore. Essential for computing and solar components.',
    stackSize: 200,
    category: 'raw',
    color: '#C0C0A0',
    icon: '🪨',
  },
  ice: {
    id: 'ice',
    name: 'Ice',
    description: 'Water ice. Can be processed into fuel or life support.',
    stackSize: 500,
    category: 'raw',
    color: '#AEE8FF',
    icon: '🧊',
  },
  carbon: {
    id: 'carbon',
    name: 'Carbon',
    description: 'Carbon deposits. Used in alloys and filters.',
    stackSize: 300,
    category: 'raw',
    color: '#333333',
    icon: '⬛',
  },

  // ---- Processed Materials ----------------------------------
  iron_plate: {
    id: 'iron_plate',
    name: 'Iron Plate',
    description: 'Smelted iron plate. Basic construction material.',
    stackSize: 100,
    category: 'processed',
    color: '#A0A0A8',
    icon: '🔩',
  },
  steel: {
    id: 'steel',
    name: 'Steel',
    description: 'High-strength alloy. Required for advanced structures.',
    stackSize: 100,
    category: 'processed',
    color: '#6080A0',
    icon: '⚙️',
  },
  silicon_wafer: {
    id: 'silicon_wafer',
    name: 'Silicon Wafer',
    description: 'Refined silicon wafer. Used in circuits.',
    stackSize: 50,
    category: 'processed',
    color: '#E0E0FF',
    icon: '💿',
  },
  water: {
    id: 'water',
    name: 'Water',
    description: 'Processed water. Used for fuel and life support.',
    stackSize: 400,
    category: 'processed',
    color: '#4488FF',
    icon: '💧',
  },

  // ---- Components -------------------------------------------
  basic_circuit: {
    id: 'basic_circuit',
    name: 'Basic Circuit',
    description: 'Simple computing component.',
    stackSize: 20,
    category: 'component',
    color: '#00CC44',
    icon: '🔌',
  },
  drone_frame: {
    id: 'drone_frame',
    name: 'Drone Frame',
    description: 'Structural chassis for a small autonomous drone.',
    stackSize: 10,
    category: 'component',
    color: '#AA8844',
    icon: '🤖',
  },
  thruster_unit: {
    id: 'thruster_unit',
    name: 'Thruster Unit',
    description: 'Ion thruster pack for drone propulsion.',
    stackSize: 10,
    category: 'component',
    color: '#FF6600',
    icon: '🚀',
  },

  // ---- Fuel -------------------------------------------------
  fuel_cell: {
    id: 'fuel_cell',
    name: 'Fuel Cell',
    description: 'Compact hydrogen fuel cell.',
    stackSize: 50,
    category: 'fuel',
    color: '#FFDD00',
    icon: '⚡',
  },
}

/** Helper: get item def, throw on unknown id */
export function getItem(id: ItemId): ItemDefinition {
  const def = ITEMS[id]
  if (!def) throw new Error(`Unknown item: ${id}`)
  return def
}

export const ALL_ITEM_IDS = Object.keys(ITEMS) as ItemId[]
