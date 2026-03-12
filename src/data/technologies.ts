// ============================================================
// data/technologies.ts — Tech tree definitions.
// Each tech unlocks capabilities, recipes, entities, or stats.
// ============================================================

export interface TechEffect {
  type: 'unlock_recipe' | 'unlock_entity' | 'stat_boost' | 'unlock_tech_branch'
  target: string
  value?: number
}

export interface TechDefinition {
  id: string
  name: string
  description: string
  tier: number
  researchCost: number   // in abstract "research points"
  prerequisites: string[]
  effects: TechEffect[]
  icon: string
}

export const TECHNOLOGIES: Record<string, TechDefinition> = {
  // ---- Tier 0 (starting) ------------------------------------
  basic_fabrication: {
    id: 'basic_fabrication',
    name: 'Basic Fabrication',
    description: 'Enables smelting and basic material processing.',
    tier: 0,
    researchCost: 0,
    prerequisites: [],
    effects: [
      { type: 'unlock_recipe', target: 'smelt_iron' },
      { type: 'unlock_recipe', target: 'melt_ice' },
      { type: 'unlock_recipe', target: 'refine_silicon' },
    ],
    icon: '⚙️',
  },

  // ---- Tier 1 -----------------------------------------------
  alloy_metallurgy: {
    id: 'alloy_metallurgy',
    name: 'Alloy Metallurgy',
    description: 'Advanced smelting to produce steel alloys.',
    tier: 1,
    researchCost: 50,
    prerequisites: ['basic_fabrication'],
    effects: [
      { type: 'unlock_recipe', target: 'smelt_steel' },
    ],
    icon: '🔩',
  },
  micro_electronics: {
    id: 'micro_electronics',
    name: 'Micro-Electronics',
    description: 'Fabrication of basic computing circuits.',
    tier: 1,
    researchCost: 80,
    prerequisites: ['basic_fabrication'],
    effects: [
      { type: 'unlock_recipe', target: 'craft_circuit' },
    ],
    icon: '🔌',
  },
  drone_construction: {
    id: 'drone_construction',
    name: 'Drone Construction',
    description: 'Enables printing of mining and cargo drones.',
    tier: 1,
    researchCost: 120,
    prerequisites: ['alloy_metallurgy', 'micro_electronics'],
    effects: [
      { type: 'unlock_recipe', target: 'craft_drone_frame' },
      { type: 'unlock_recipe', target: 'craft_thruster' },
      { type: 'unlock_entity', target: 'miningDrone' },
      { type: 'unlock_entity', target: 'cargoDrone' },
    ],
    icon: '🤖',
  },

  // ---- Tier 2 -----------------------------------------------
  advanced_propulsion: {
    id: 'advanced_propulsion',
    name: 'Advanced Propulsion',
    description: 'Faster drone movement and interplanetary travel.',
    tier: 2,
    researchCost: 200,
    prerequisites: ['drone_construction'],
    effects: [
      { type: 'stat_boost', target: 'drone_speed', value: 1.5 },
    ],
    icon: '🚀',
  },
  distributed_computing: {
    id: 'distributed_computing',
    name: 'Distributed Computing',
    description: 'Expand CPU capacity to manage more drones.',
    tier: 2,
    researchCost: 180,
    prerequisites: ['micro_electronics'],
    effects: [
      { type: 'stat_boost', target: 'cpu_capacity', value: 8 },
    ],
    icon: '💻',
  },
  interstellar_nav: {
    id: 'interstellar_nav',
    name: 'Interstellar Navigation',
    description: 'Enables travel between star systems.',
    tier: 2,
    researchCost: 500,
    prerequisites: ['advanced_propulsion'],
    effects: [
      { type: 'unlock_tech_branch', target: 'exploration' },
    ],
    icon: '🌌',
  },
}

export function getTech(id: string): TechDefinition {
  const t = TECHNOLOGIES[id]
  if (!t) throw new Error(`Unknown technology: ${id}`)
  return t
}

export const ALL_TECH_IDS = Object.keys(TECHNOLOGIES)
