// ============================================================
// ECS.ts — Entity Component System Core
// ============================================================
// Entities are just IDs. Components hold data. Systems hold logic.
// Adding new content = adding new components + systems only.
// ============================================================

export type EntityId = number

let _nextEntityId = 1
export function createEntityId(): EntityId {
  return _nextEntityId++
}

// --------------- Component Registry -------------------------

export interface Component {
  readonly type: string
}

type ComponentMap = Map<string, Component>

export class World {
  private entities = new Map<EntityId, ComponentMap>()
  private componentIndex = new Map<string, Set<EntityId>>()
  private systems: System[] = []
  private tags = new Map<EntityId, Set<string>>()

  // ---- Entity lifecycle -----------------------------------

  createEntity(): EntityId {
    const id = createEntityId()
    this.entities.set(id, new Map())
    this.tags.set(id, new Set())
    return id
  }

  destroyEntity(id: EntityId): void {
    const components = this.entities.get(id)
    if (!components) return
    for (const type of components.keys()) {
      this.componentIndex.get(type)?.delete(id)
    }
    this.entities.delete(id)
    this.tags.delete(id)
  }

  entityExists(id: EntityId): boolean {
    return this.entities.has(id)
  }

  // ---- Component management --------------------------------

  addComponent<T extends Component>(id: EntityId, component: T): T {
    const components = this.entities.get(id)
    if (!components) throw new Error(`Entity ${id} does not exist`)
    components.set(component.type, component)
    if (!this.componentIndex.has(component.type)) {
      this.componentIndex.set(component.type, new Set())
    }
    this.componentIndex.get(component.type)!.add(id)
    return component
  }

  removeComponent(id: EntityId, type: string): void {
    this.entities.get(id)?.delete(type)
    this.componentIndex.get(type)?.delete(id)
  }

  getComponent<T extends Component>(id: EntityId, type: string): T | undefined {
    return this.entities.get(id)?.get(type) as T | undefined
  }

  hasComponent(id: EntityId, type: string): boolean {
    return this.entities.get(id)?.has(type) ?? false
  }

  // ---- Tag management (lightweight labels) -----------------

  addTag(id: EntityId, tag: string): void {
    this.tags.get(id)?.add(tag)
  }

  hasTag(id: EntityId, tag: string): boolean {
    return this.tags.get(id)?.has(tag) ?? false
  }

  removeTag(id: EntityId, tag: string): void {
    this.tags.get(id)?.delete(tag)
  }

  // ---- Queries ---------------------------------------------

  /** Returns all entities that have ALL of the given component types */
  query(...types: string[]): EntityId[] {
    if (types.length === 0) return []
    // Start with the smallest set
    let smallest: Set<EntityId> | undefined
    for (const t of types) {
      const set = this.componentIndex.get(t)
      if (!set || set.size === 0) return []
      if (!smallest || set.size < smallest.size) smallest = set
    }
    const result: EntityId[] = []
    for (const id of smallest!) {
      if (types.every(t => this.componentIndex.get(t)?.has(id))) {
        result.push(id)
      }
    }
    return result
  }

  queryWithTag(tag: string, ...types: string[]): EntityId[] {
    return this.query(...types).filter(id => this.hasTag(id, tag))
  }

  // ---- System management -----------------------------------

  registerSystem(system: System): void {
    this.systems.push(system)
    system.onRegister?.(this)
  }

  getSystems(): System[] {
    return this.systems
  }
}

// --------------- System Interface ---------------------------

export interface System {
  readonly name: string
  priority?: number         // lower = runs earlier; default 0
  onRegister?(world: World): void
  update(world: World, dt: number): void
}

// --------------- Scheduler ----------------------------------
// Separates render-rate from simulation-rate updates

export class Scheduler {
  private lastTime = 0
  private accumulator = 0
  private simTickMs: number
  private renderSystems: System[] = []
  private simSystems: System[] = []
  private rafHandle = 0
  private running = false
  private world: World

  constructor(world: World, simHz = 8) {
    this.world = world
    this.simTickMs = 1000 / simHz
  }

  addRenderSystem(s: System): void {
    this.renderSystems.push(s)
    this.renderSystems.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
  }
  addSimSystem(s: System): void    {
    this.simSystems.push(s)
    this.simSystems.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.tick(this.lastTime)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafHandle)
  }

  private tick = (now: number): void => {
    if (!this.running) return
    const wall = now - this.lastTime
    this.lastTime = now
    // Cap to avoid spiral of death after tab is backgrounded
    const clampedWall = Math.min(wall, 200)
    this.accumulator += clampedWall

    // Simulation ticks (fixed timestep)
    while (this.accumulator >= this.simTickMs) {
      const dt = this.simTickMs / 1000
      for (const s of this.simSystems) s.update(this.world, dt)
      this.accumulator -= this.simTickMs
    }

    // Render (variable timestep)
    const renderDt = clampedWall / 1000
    for (const s of this.renderSystems) s.update(this.world, renderDt)

    this.rafHandle = requestAnimationFrame(this.tick)
  }
}

