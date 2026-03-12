// ============================================================
// generation/universeGenerator.ts — Procedural star systems.
// Uses seeded pseudo-random to ensure deterministic maps.
// ============================================================

export interface StarSystemData {
  id: string
  name: string
  seed: number
  starType: StarType
  starColor: string
  starRadius: number
  x: number          // position in universe space
  y: number
  bodies: CelestialBody[]
  discovered: boolean
  fullyScanned: boolean
}

export type StarType = 'yellow_dwarf' | 'red_dwarf' | 'blue_giant' | 'white_dwarf' | 'neutron'

export interface CelestialBody {
  id: string
  name: string
  bodyType: BodyType
  orbitRadius: number      // distance from star in game units
  orbitSpeed: number       // radians / second
  orbitAngle: number       // initial angle
  radius: number           // visual + collision radius
  color: string
  deposits: DepositSpec[]
}

export type BodyType = 'rocky_planet' | 'gas_giant' | 'asteroid' | 'ice_body' | 'station_remnant'

export interface DepositSpec {
  itemId: string
  amount: number
  difficulty: number   // 0-1
}

// ---- Seeded RNG (mulberry32) -------------------------------

class SeededRng {
  private state: number
  constructor(seed: number) { this.state = seed >>> 0 }
  next(): number {
    this.state |= 0
    this.state = this.state + 0x6D2B79F5 | 0
    let z = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state)
    z = z + Math.imul(z ^ (z >>> 7), 61 | z) ^ z
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296
  }
  range(min: number, max: number): number { return min + this.next() * (max - min) }
  int(min: number, max: number): number { return Math.floor(this.range(min, max + 1)) }
  pick<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length)] }
  bool(prob = 0.5): boolean { return this.next() < prob }
}

// ---- Name generation tables --------------------------------

const STAR_PREFIXES = ['Sol', 'Kepler', 'Tau', 'Psi', 'Alpha', 'Beta', 'Sigma', 'Vega', 'Lyra', 'Orion', 'Cygnus', 'Draco']
const STAR_SUFFIXES = ['Prime', 'Minor', 'Majoris', 'IV', 'VII', 'B', 'C', 'Tertius', 'Secundus', 'Novus']
const PLANET_NAMES  = ['Proxima', 'Aether', 'Ferros', 'Glacius', 'Pyrene', 'Umbra', 'Lithos', 'Kronos', 'Selene', 'Nyx']

// ---- Star configurations -----------------------------------

const STAR_CONFIGS: Record<StarType, { color: string; radius: number; prob: number }> = {
  yellow_dwarf: { color: '#FFE566', radius: 40,  prob: 0.40 },
  red_dwarf:    { color: '#FF6644', radius: 28,  prob: 0.30 },
  blue_giant:   { color: '#88AAFF', radius: 60,  prob: 0.10 },
  white_dwarf:  { color: '#EEEEFF', radius: 18,  prob: 0.12 },
  neutron:      { color: '#CCFFFF', radius: 10,  prob: 0.08 },
}

function pickStarType(rng: SeededRng): StarType {
  const r = rng.next()
  let cumulative = 0
  for (const [type, cfg] of Object.entries(STAR_CONFIGS)) {
    cumulative += cfg.prob
    if (r < cumulative) return type as StarType
  }
  return 'yellow_dwarf'
}

// ---- Deposit generation ------------------------------------

function generateDeposits(rng: SeededRng, bodyType: BodyType): DepositSpec[] {
  const deposits: DepositSpec[] = []

  if (bodyType === 'asteroid' || bodyType === 'rocky_planet') {
    if (rng.bool(0.9)) deposits.push({ itemId: 'iron_ore',     amount: rng.int(500, 5000),  difficulty: rng.range(0.2, 0.8) })
    if (rng.bool(0.5)) deposits.push({ itemId: 'silicon_ore',  amount: rng.int(200, 2000),  difficulty: rng.range(0.3, 0.7) })
    if (rng.bool(0.3)) deposits.push({ itemId: 'carbon',       amount: rng.int(100, 1500),  difficulty: rng.range(0.2, 0.6) })
  }
  if (bodyType === 'ice_body') {
    deposits.push(         { itemId: 'ice',          amount: rng.int(2000, 20000), difficulty: rng.range(0.1, 0.4) })
    if (rng.bool(0.2)) deposits.push({ itemId: 'silicon_ore',  amount: rng.int(100, 800),   difficulty: 0.6 })
  }
  if (bodyType === 'gas_giant') {
    // Gas giants don't have direct deposits but can be skimmed later
  }
  if (bodyType === 'station_remnant') {
    if (rng.bool(0.7)) deposits.push({ itemId: 'iron_plate',   amount: rng.int(50, 500),    difficulty: 0.3 })
    if (rng.bool(0.4)) deposits.push({ itemId: 'basic_circuit',amount: rng.int(5, 50),      difficulty: 0.5 })
  }

  return deposits
}

// ---- Body generation ----------------------------------------

function generateBodies(rng: SeededRng, systemId: string, starType: StarType): CelestialBody[] {
  const bodies: CelestialBody[] = []

  // Number of bodies scaled by star type
  const maxBodies = starType === 'blue_giant' ? 12 :
                    starType === 'neutron'     ? 3  : 7

  const bodyCount = rng.int(2, maxBodies)
  const baseOrbit = 150

  for (let i = 0; i < bodyCount; i++) {
    const orbitRadius = baseOrbit + i * rng.range(80, 160)
    const orbitSpeed  = rng.range(0.005, 0.05) * (1 / (i + 1))
    const orbitAngle  = rng.range(0, Math.PI * 2)

    // Decide body type
    let bodyType: BodyType
    const btr = rng.next()
    if      (btr < 0.25) bodyType = 'asteroid'
    else if (btr < 0.45) bodyType = 'ice_body'
    else if (btr < 0.70) bodyType = 'rocky_planet'
    else if (btr < 0.90) bodyType = 'gas_giant'
    else                 bodyType = 'station_remnant'

    const COLORS: Record<BodyType, string[]> = {
      asteroid:        ['#8B7355', '#A09070', '#7A6548'],
      ice_body:        ['#AEE8FF', '#C8F0FF', '#90D0F0'],
      rocky_planet:    ['#CC8844', '#AA6633', '#DD9955', '#887766'],
      gas_giant:       ['#DDAA66', '#CC9955', '#FFBB77'],
      station_remnant: ['#556677', '#445566', '#667788'],
    }

    const name = bodyType === 'asteroid'
      ? `${PLANET_NAMES[i % PLANET_NAMES.length]}-${rng.int(1, 99)}`
      : PLANET_NAMES[i % PLANET_NAMES.length]

    bodies.push({
      id: `${systemId}_body_${i}`,
      name,
      bodyType,
      orbitRadius,
      orbitSpeed,
      orbitAngle,
      radius: bodyType === 'gas_giant'  ? rng.int(30, 60) :
              bodyType === 'rocky_planet'? rng.int(15, 30) : rng.int(8, 18),
      color: rng.pick(COLORS[bodyType]),
      deposits: generateDeposits(rng, bodyType),
    })
  }

  return bodies
}

// ---- Public API --------------------------------------------

export function generateStarSystem(seed: number, id: string, x: number, y: number): StarSystemData {
  const rng  = new SeededRng(seed)
  const type = pickStarType(rng)
  const cfg  = STAR_CONFIGS[type]
  const name = `${rng.pick(STAR_PREFIXES)} ${rng.pick(STAR_SUFFIXES)}`

  return {
    id,
    name,
    seed,
    starType: type,
    starColor: cfg.color,
    starRadius: cfg.radius,
    x, y,
    bodies: generateBodies(rng, id, type),
    discovered: false,
    fullyScanned: false,
  }
}

/** Generate a cluster of N star systems around a center */
export function generateUniverse(
  count: number,
  spreadRadius: number,
  masterSeed: number
): StarSystemData[] {
  const rng = new SeededRng(masterSeed)
  const systems: StarSystemData[] = []

  for (let i = 0; i < count; i++) {
    const angle = rng.range(0, Math.PI * 2)
    const dist  = rng.range(0, spreadRadius)
    const x     = Math.cos(angle) * dist
    const y     = Math.sin(angle) * dist
    const seed  = Math.floor(rng.next() * 0xFFFFFF)
    systems.push(generateStarSystem(seed, `sys_${i}`, x, y))
  }

  // Origin system is always discovered
  systems[0].discovered = true
  return systems
}
