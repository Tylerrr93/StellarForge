// ============================================================
// data/recipes.ts — All crafting/processing recipes.
// To add a recipe: add an entry here. No engine changes needed.
// ============================================================

import type { ItemId } from './items'

export interface RecipeIngredient {
  itemId: ItemId
  amount: number
}

export interface RecipeDefinition {
  id: string
  name: string
  description: string
  category: 'smelting' | 'fabrication' | 'processing' | 'assembly'
  inputs: RecipeIngredient[]
  outputs: RecipeIngredient[]
  processingTimeSec: number   // time per batch in seconds
  requiresStation?: string    // tag/type of station needed (optional)
}

export const RECIPES: Record<string, RecipeDefinition> = {
  // ---- Smelting ---------------------------------------------
  smelt_iron: {
    id: 'smelt_iron',
    name: 'Smelt Iron',
    description: 'Refine iron ore into iron plates.',
    category: 'smelting',
    inputs:  [{ itemId: 'iron_ore',   amount: 4 }],
    outputs: [{ itemId: 'iron_plate', amount: 2 }],
    processingTimeSec: 4,
  },
  smelt_steel: {
    id: 'smelt_steel',
    name: 'Smelt Steel',
    description: 'Alloy iron plates with carbon into steel.',
    category: 'smelting',
    inputs:  [
      { itemId: 'iron_plate', amount: 3 },
      { itemId: 'carbon',     amount: 1 },
    ],
    outputs: [{ itemId: 'steel', amount: 2 }],
    processingTimeSec: 8,
  },
  refine_silicon: {
    id: 'refine_silicon',
    name: 'Refine Silicon',
    description: 'Process silicon ore into wafers.',
    category: 'processing',
    inputs:  [{ itemId: 'silicon_ore',   amount: 3 }],
    outputs: [{ itemId: 'silicon_wafer', amount: 1 }],
    processingTimeSec: 6,
  },
  melt_ice: {
    id: 'melt_ice',
    name: 'Melt Ice',
    description: 'Convert ice into water.',
    category: 'processing',
    inputs:  [{ itemId: 'ice',   amount: 5 }],
    outputs: [{ itemId: 'water', amount: 4 }],
    processingTimeSec: 2,
  },
  craft_circuit: {
    id: 'craft_circuit',
    name: 'Craft Basic Circuit',
    description: 'Fabricate a simple computing circuit.',
    category: 'fabrication',
    inputs: [
      { itemId: 'silicon_wafer', amount: 2 },
      { itemId: 'iron_plate',    amount: 1 },
    ],
    outputs: [{ itemId: 'basic_circuit', amount: 1 }],
    processingTimeSec: 10,
  },
  craft_drone_frame: {
    id: 'craft_drone_frame',
    name: 'Fabricate Drone Frame',
    description: 'Construct a structural drone chassis.',
    category: 'fabrication',
    inputs: [
      { itemId: 'steel',      amount: 4 },
      { itemId: 'iron_plate', amount: 2 },
    ],
    outputs: [{ itemId: 'drone_frame', amount: 1 }],
    processingTimeSec: 15,
  },
  craft_thruster: {
    id: 'craft_thruster',
    name: 'Assemble Thruster Unit',
    description: 'Assemble ion propulsion pack.',
    category: 'assembly',
    inputs: [
      { itemId: 'iron_plate', amount: 3 },
      { itemId: 'fuel_cell',  amount: 2 },
    ],
    outputs: [{ itemId: 'thruster_unit', amount: 1 }],
    processingTimeSec: 12,
  },
  make_fuel_cell: {
    id: 'make_fuel_cell',
    name: 'Produce Fuel Cell',
    description: 'Electrolyse water into hydrogen fuel cells.',
    category: 'processing',
    inputs:  [{ itemId: 'water', amount: 4 }],
    outputs: [{ itemId: 'fuel_cell', amount: 2 }],
    processingTimeSec: 5,
  },
}

export function getRecipe(id: string): RecipeDefinition {
  const r = RECIPES[id]
  if (!r) throw new Error(`Unknown recipe: ${id}`)
  return r
}

export const ALL_RECIPE_IDS = Object.keys(RECIPES)
