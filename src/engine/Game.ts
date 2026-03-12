// ============================================================
// engine/Game.ts - Top-level game manager.
// Owns the World, Scheduler, and all systems.
// ============================================================

import { World, Scheduler, type EntityId, type System } from './ECS'
import { droneSystem }      from './systems/droneSystem'
import { craftingSystem }   from './systems/craftingSystem'
import { orbitSystem, resourceSystem } from './systems/orbitSystem'
import { navigationSystem, movementSystem } from './systems/navigationSystem'
import { createPlayerControlSystem, type InputState } from './systems/playerControlSystem'
import { Renderer }         from '../rendering/renderer'
import { generateUniverse, type StarSystemData, type CelestialBody } from '../generation/universeGenerator'
import {
  mkPosition,
  mkRenderable,
  mkResourceDeposit,
  mkSystemMember,
  mkHealth,
  mkVelocity,
  mkRotation,
  mkNavigation,
  mkInventory,
  mkActionState,
  COMPONENT_TYPES,
  type PositionComponent,
  type SystemMemberComponent,
  type DroneComponent,
  type InventoryComponent,
  type StationComponent,
  type ActionStateComponent,
  type CraftingComponent,
  type ResourceDepositComponent,
  type RenderableComponent,
  type NavigationComponent,
  type VelocityComponent,
} from './components/index'
import { mkMineTask, mkReturnHomeTask, mkIdleTask } from '../tasks/taskTypes'
import { getRecipe } from '../data/recipes'

// Make sure task handlers are registered
import '../tasks/taskHandlers'

const PLAYER_HARVEST_RATE = 0.5   // units/sec (very slow)
const PLAYER_INTERACT_RANGE = 32

// ---- Persistent game state ---------------------------------

export interface GameState {
  simTime: number
  currentSystemId: string
  discoveredSystems: string[]
  unlockedTechs: string[]
  researchPoints: number
}

// ---- Global event bus (lightweight) -----------------------

type EventHandler<T = unknown> = (data: T) => void
class EventBus {
  private handlers = new Map<string, EventHandler[]>()
  emit<T>(event: string, data?: T): void {
    this.handlers.get(event)?.forEach(h => h(data as unknown))
  }
  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) this.handlers.set(event, [])
    this.handlers.get(event)!.push(handler)
  }
}

export const events = new EventBus()

// ---- Game class --------------------------------------------

export class Game {
  world: World
  scheduler: Scheduler
  renderer: Renderer
  state: GameState
  universe: StarSystemData[]
  playerId: EntityId | null = null
  private bodyDataByEntity = new Map<EntityId, CelestialBody>()
  private autoHarvest: { targetId: EntityId; itemId: string } | null = null
  private input: InputState = { up: false, down: false, left: false, right: false, harvest: false, deposit: false }

  private renderSystem = {
    name: 'renderSystem',
    priority: 999,
    update: (_world: World, _dt: number) => {
      const sys = this.universe.find(s => s.id === this.state.currentSystemId) ?? null
      this.followPlayerWithCamera()
      this.renderer.render(this.world, sys)
    }
  }

  private bodyVisualSync: System = {
    name: 'bodyVisualSync',
    priority: 90,
    update: () => this.syncBodyVisuals()
  }

  private interactionSystem: System = {
    name: 'playerInteraction',
    priority: -4,
    update: (_w: World, dt: number) => this.updatePlayerInteraction(dt)
  }

  constructor(canvas: HTMLCanvasElement) {
    this.world     = new World()
    this.scheduler = new Scheduler(this.world, 16) // a little snappier feel
    this.renderer  = new Renderer(canvas)

    this.state = {
      simTime: 0,
      currentSystemId: 'sys_0',
      discoveredSystems: ['sys_0'],
      unlockedTechs: ['basic_fabrication'],
      researchPoints: 0,
    }

    this.universe = generateUniverse(12, 8000, 42)
    this.universe[0].discovered = true
    this.renderer.setSystem('sys_0')

    this.buildStartingScene()
    this.playerId = this.spawnPlayer()
    this.setupSystems()
    this.setupInput(canvas)
  }

  private setupSystems(): void {
    if (this.playerId !== null) {
      this.scheduler.addSimSystem(createPlayerControlSystem(this.input, this.playerId))
      this.scheduler.addSimSystem(this.interactionSystem)
    }
    this.scheduler.addSimSystem(navigationSystem)
    this.scheduler.addSimSystem(movementSystem)
    this.scheduler.addSimSystem(orbitSystem)
    this.scheduler.addSimSystem(this.bodyVisualSync)
    this.scheduler.addSimSystem(droneSystem)
    this.scheduler.addSimSystem(craftingSystem)
    this.scheduler.addSimSystem({
      name: 'simTimeClock',
      priority: 50,
      update: (_w, dt) => { this.state.simTime += dt }
    })
    this.scheduler.addSimSystem(resourceSystem)

    // Render system (every frame)
    this.scheduler.addRenderSystem(this.renderSystem)
  }

  private buildStartingScene(): void {
    const SYS = 'sys_0'
    const gen  = this.universe[0]

    // Spawn bodies from the procedural system as ECS entities
    for (const body of gen.bodies) {
      const bodyId = this.world.createEntity()
      this.world.addComponent(bodyId, mkPosition(
        Math.cos(body.orbitAngle) * body.orbitRadius,
        Math.sin(body.orbitAngle) * body.orbitRadius,
        SYS
      ))
      this.world.addComponent(bodyId, mkSystemMember(SYS, body.orbitRadius, body.orbitSpeed, body.orbitAngle))
      this.world.addComponent(bodyId, mkHealth(9999))
      const shape = body.bodyType === 'asteroid' ? 'diamond'
        : body.bodyType === 'ice_body' ? 'hexagon'
        : 'circle'
      this.world.addComponent(bodyId, mkRenderable(
        shape as 'circle' | 'rect' | 'diamond' | 'hexagon',
        body.color,
        body.radius,
        body.bodyType === 'gas_giant' ? -1 : 0,
        body.name.slice(0, 4)
      ))

      if (body.deposits.length > 0) {
        this.world.addComponent(bodyId, mkResourceDeposit(
          body.deposits.map(d => [d.itemId, d.amount] as [string, number]),
          body.deposits[0]?.difficulty ?? 0.5
        ))
      }

      this.world.addTag(bodyId, 'celestialBody')
      this.world.addTag(bodyId, body.bodyType)
      ;(this.world as World & { _bodyEntityMap?: Map<string, number> })
        ._bodyEntityMap ??= new Map()
      ;(this.world as World & { _bodyEntityMap: Map<string, number> })
        ._bodyEntityMap.set(body.id, bodyId)
      this.bodyDataByEntity.set(bodyId, body)
    }
    events.emit('sceneReady', { stationId: null })
  }

  private spawnPlayer(): EntityId {
    const id = this.world.createEntity()
    this.world.addComponent(id, mkPosition(0, 0, this.state.currentSystemId))
    this.world.addComponent(id, mkVelocity(140))
    this.world.addComponent(id, mkRotation(-Math.PI / 2))
    this.world.addComponent(id, mkNavigation(10))
    this.world.addComponent(id, mkHealth(50))
    this.world.addComponent(id, mkInventory(6, 50))
    this.world.addComponent(id, mkActionState())
    this.world.addComponent(id, mkRenderable('rect', '#55aaff', 10, 5, 'YOU'))
    this.world.addTag(id, 'player')
    return id
  }

  private setupInput(canvas: HTMLCanvasElement): void {
    const setKey = (key: string, down: boolean) => {
      if (['w', 'arrowup'].includes(key)) this.input.up = down
      if (['s', 'arrowdown'].includes(key)) this.input.down = down
      if (['a', 'arrowleft'].includes(key)) this.input.left = down
      if (['d', 'arrowright'].includes(key)) this.input.right = down
      if (key === 'e') this.input.harvest = down
      if (key === 'f' && down) this.input.deposit = true
    }

    window.addEventListener('keydown', (e) => { setKey(e.key.toLowerCase(), true) })
    window.addEventListener('keyup',   (e) => { setKey(e.key.toLowerCase(), false) })

    canvas.addEventListener('click', (e) => {
      if (!e.shiftKey) this.handleBodyClick(e.offsetX, e.offsetY)
      if (e.shiftKey)  this.commandNearestMiningDrone(e.offsetX, e.offsetY)
    })

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      this.commandNearestMiningDrone(e.offsetX, e.offsetY)
    })
  }

  private commandNearestMiningDrone(sx: number, sy: number): void {
    const { x, y } = this.renderer.screenToWorld(sx, sy)
    const deposits = this.world.query(COMPONENT_TYPES.RESOURCE_DEPOSIT, COMPONENT_TYPES.POSITION)

    let targetId: EntityId | null = null
    let nearest = Infinity
    for (const id of deposits) {
      const pos = this.world.getComponent<PositionComponent>(id, COMPONENT_TYPES.POSITION)
      if (!pos || pos.systemId !== this.state.currentSystemId) continue
      const dx = pos.x - x
      const dy = pos.y - y
      const d2 = dx * dx + dy * dy
      if (d2 < nearest && d2 < 120 * 120) {
        nearest = d2
        targetId = id
      }
    }
    if (targetId === null) return

    const deposit = this.world.getComponent<ResourceDepositComponent>(targetId, COMPONENT_TYPES.RESOURCE_DEPOSIT)
    if (!deposit || deposit.resources.size === 0) return
    const itemId = deposit.resources.keys().next().value as string

    const drones = this.world.queryWithTag('miningDrone', COMPONENT_TYPES.DRONE)
    if (drones.length === 0) return

    const droneId = drones[0]
    const drone = this.world.getComponent<DroneComponent>(droneId, COMPONENT_TYPES.DRONE)
    if (!drone) return

    drone.taskQueue.length = 0
    drone.currentTask = null
    drone.taskQueue.push(mkMineTask(targetId, itemId, 500))
    drone.taskQueue.push(mkReturnHomeTask())
    drone.taskQueue.push(mkIdleTask(1))
    drone.state = 'working'
  }

  private handleBodyClick(sx: number, sy: number): void {
    const { x, y } = this.renderer.screenToWorld(sx, sy)
    const picked = this.pickCelestialAt(x, y)
    if (picked !== null) {
      const body = this.bodyDataByEntity.get(picked) ?? null
      events.emit('bodySelected', { entityId: picked, body })
      return
    }
    this.commandPlayerTo(x, y)
  }

  private commandPlayerTo(x: number, y: number): void {
    if (this.playerId === null) return
    const nav = this.world.getComponent<NavigationComponent>(this.playerId, COMPONENT_TYPES.NAVIGATION)
    const vel = this.world.getComponent<VelocityComponent>(this.playerId, COMPONENT_TYPES.VELOCITY)
    if (!nav || !vel) return
    nav.targetEntityId = null
    nav.targetX = x
    nav.targetY = y
    vel.vx = 0
    vel.vy = 0
  }

  private pickCelestialAt(x: number, y: number): EntityId | null {
    const ids = this.world.queryWithTag('celestialBody', COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RENDERABLE)
    let closest: EntityId | null = null
    let best = Infinity
    for (const id of ids) {
      const pos = this.world.getComponent<PositionComponent>(id, COMPONENT_TYPES.POSITION)
      const ren = this.world.getComponent<RenderableComponent>(id, COMPONENT_TYPES.RENDERABLE)
      if (!pos || !ren || pos.systemId !== this.state.currentSystemId) continue
      const dx = pos.x - x
      const dy = pos.y - y
      const d2 = dx * dx + dy * dy
      const hitRadius = ren.size + 10
      if (d2 <= hitRadius * hitRadius && d2 < best) {
        best = d2
        closest = id
      }
    }
    return closest
  }

  attachToBody(targetId: EntityId, itemId: string): void {
    const pos = this.world.getComponent<PositionComponent>(targetId, COMPONENT_TYPES.POSITION)
    if (!pos || pos.systemId !== this.state.currentSystemId) return
    this.autoHarvest = { targetId, itemId }
    if (this.playerId !== null) {
      const nav = this.world.getComponent(this.playerId, COMPONENT_TYPES.NAVIGATION) as NavigationComponent | null
      const act = this.world.getComponent<ActionStateComponent>(this.playerId, COMPONENT_TYPES.ACTION_STATE)
      if (nav && act) {
        nav.targetEntityId = targetId
        nav.targetX = nav.targetY = null
        act.harvestItemId = itemId
        act.attachedToId = null
      }
    }
  }

  detachFromBody(): void {
    this.autoHarvest = null
    if (this.playerId !== null) {
      const act = this.world.getComponent<ActionStateComponent>(this.playerId, COMPONENT_TYPES.ACTION_STATE)
      if (act) {
        act.attachedToId = null
        act.harvestItemId = null
        act.harvestingTargetId = null
      }
    }
  }

  private followPlayerWithCamera(): void {
    if (this.playerId === null) return
    const pos = this.world.getComponent<PositionComponent>(this.playerId, COMPONENT_TYPES.POSITION)
    if (!pos) return
    this.renderer.camera.x = pos.x
    this.renderer.camera.y = pos.y
  }

  private syncBodyVisuals(): void {
    const map = (this.world as World & { _bodyEntityMap?: Map<string, number> })._bodyEntityMap
    if (!map) return

    for (const [bodyId, entityId] of map.entries()) {
      const pos = this.world.getComponent<PositionComponent>(entityId, COMPONENT_TYPES.POSITION)
      const orbit = this.world.getComponent<SystemMemberComponent>(entityId, COMPONENT_TYPES.SYSTEM_MEMBER)
      if (!pos || !orbit) continue
      const system = this.universe.find(s => s.id === orbit.systemId)
      const body = system?.bodies.find(b => b.id === bodyId)
      if (!body) continue
      body.orbitAngle  = Math.atan2(pos.y, pos.x)
      body.orbitRadius = Math.sqrt(pos.x * pos.x + pos.y * pos.y)
      body.orbitSpeed  = orbit.orbitSpeed
    }
  }

  private findNearestDeposit(pos: PositionComponent, maxDist: number): EntityId | null {
    const deposits = this.world.query(COMPONENT_TYPES.RESOURCE_DEPOSIT, COMPONENT_TYPES.POSITION)
    let best: EntityId | null = null
    let bestD2 = maxDist * maxDist
    for (const id of deposits) {
      const dPos = this.world.getComponent<PositionComponent>(id, COMPONENT_TYPES.POSITION)
      if (!dPos || dPos.systemId !== this.state.currentSystemId) continue
      const dx = dPos.x - pos.x
      const dy = dPos.y - pos.y
      const d2 = dx * dx + dy * dy
      if (d2 <= bestD2) { bestD2 = d2; best = id }
    }
    return best
  }

  private canPlayerHarvest(entityId: EntityId): boolean {
    const body = this.bodyDataByEntity.get(entityId)
    if (!body) return true
    return body.bodyType === 'asteroid' || body.bodyType === 'ice_body' || body.bodyType === 'station_remnant'
  }

  private findNearestStation(pos: PositionComponent, maxDist: number): EntityId | null {
    const stations = this.world.query(COMPONENT_TYPES.STATION, COMPONENT_TYPES.POSITION)
    let best: EntityId | null = null
    let bestD2 = maxDist * maxDist
    for (const id of stations) {
      const sPos = this.world.getComponent<PositionComponent>(id, COMPONENT_TYPES.POSITION)
      if (!sPos || sPos.systemId !== this.state.currentSystemId) continue
      const dx = sPos.x - pos.x
      const dy = sPos.y - pos.y
      const d2 = dx * dx + dy * dy
      if (d2 <= bestD2) { bestD2 = d2; best = id }
    }
    return best
  }

  private addToInventory(inv: InventoryComponent, itemId: string, amount: number): number {
    const current = inv.items.get(itemId) ?? 0
    const hasSlot = inv.items.has(itemId) || inv.items.size < inv.maxSlots
    if (!hasSlot || amount <= 0) return 0
    const added = Math.min(amount, inv.maxStack - current)
    if (added <= 0) return 0
    inv.items.set(itemId, current + added)
    return added
  }

  private transferAll(from: InventoryComponent, to: StationComponent['storage'], capacity: number, allowed: Set<string> | null = null): void {
    let total = 0
    for (const v of to.values()) total += v

    for (const [itemId, amt] of [...from.items.entries()]) {
      if (total >= capacity) break
      const room = capacity - total
      if (allowed && !allowed.has(itemId)) continue
      const move = Math.min(room, amt)
      to.set(itemId, (to.get(itemId) ?? 0) + move)
      const remaining = amt - move
      total += move
      if (remaining > 0) from.items.set(itemId, remaining)
      else from.items.delete(itemId)
    }
  }

  private updatePlayerInteraction(dt: number): void {
    if (this.playerId === null) return
    const pos = this.world.getComponent<PositionComponent>(this.playerId, COMPONENT_TYPES.POSITION)
    const inv = this.world.getComponent<InventoryComponent>(this.playerId, COMPONENT_TYPES.INVENTORY)
    const act = this.world.getComponent<ActionStateComponent>(this.playerId, COMPONENT_TYPES.ACTION_STATE)
    if (!pos || !inv || !act) return

    const auto = this.autoHarvest
    let targetId: EntityId | null = null
    if (auto) targetId = auto.targetId
    else if (this.input.harvest) targetId = this.findNearestDeposit(pos, PLAYER_INTERACT_RANGE)

    const canHarvest = targetId !== null && this.canPlayerHarvest(targetId)

    if (canHarvest && (this.input.harvest || auto)) {
      act.harvestingTargetId = targetId
      const deposit = this.world.getComponent<ResourceDepositComponent>(targetId!, COMPONENT_TYPES.RESOURCE_DEPOSIT)
      const targetPos = this.world.getComponent<PositionComponent>(targetId!, COMPONENT_TYPES.POSITION)
      if (deposit && targetPos && deposit.resources.size > 0) {
        const itemId = auto?.itemId ?? deposit.resources.keys().next().value as string
        act.harvestItemId = itemId
        const available = deposit.resources.get(itemId) ?? 0
        const mined = Math.min(available, PLAYER_HARVEST_RATE * dt)
        const stored = this.addToInventory(inv, itemId, mined)
        if (stored > 0) {
          deposit.resources.set(itemId, available - stored)
          if ((available - stored) <= 0) {
            deposit.resources.delete(itemId)
            if (deposit.resources.size === 0) deposit.depletedAt = Date.now()
          }
        }
      }
    } else {
      if (!auto) act.harvestItemId = null
      act.harvestingTargetId = null
    }

    // Auto-attach when close to target body
    if (auto && targetId !== null) {
      const tpos = this.world.getComponent<PositionComponent>(targetId, COMPONENT_TYPES.POSITION)
      if (tpos) {
        const dx = tpos.x - pos.x
        const dy = tpos.y - pos.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 8) {
          const nav = this.world.getComponent(this.playerId!, COMPONENT_TYPES.NAVIGATION) as NavigationComponent | null
          if (nav) { nav.targetEntityId = null; nav.targetX = nav.targetY = null }
          const vel = this.world.getComponent<VelocityComponent>(this.playerId!, COMPONENT_TYPES.VELOCITY)
          if (vel) { vel.vx = 0; vel.vy = 0 }
          act.attachedToId = targetId
        }
      }
    } else {
      act.attachedToId = null
    }

    if (this.input.deposit) {
      this.input.deposit = false
      const stationId = this.findNearestStation(pos, PLAYER_INTERACT_RANGE + 10)
      if (stationId !== null) {
        const station = this.world.getComponent<StationComponent>(stationId, COMPONENT_TYPES.STATION)
        if (station) {
          const allowed = this.autoHarvest?.itemId ? new Set([this.autoHarvest.itemId]) : null
          this.transferAll(inv, station.storage, station.storageCapacity, allowed)
          act.depositFlashUntil = Date.now() + 300
        }
      }
    }
  }

  start(): void {
    this.scheduler.start()
  }

  stop(): void {
    this.scheduler.stop()
  }

  startCrafting(recipeId: string): { ok: boolean; message: string } {
    const recipe = getRecipe(recipeId)
    const stations = this.world.query(COMPONENT_TYPES.STATION, COMPONENT_TYPES.POSITION, COMPONENT_TYPES.CRAFTING)
    if (stations.length === 0) return { ok: false, message: 'No stations available.' }

    let targetId: EntityId | null = null
    let best = Infinity
    const playerPos = this.playerId !== null
      ? this.world.getComponent<PositionComponent>(this.playerId, COMPONENT_TYPES.POSITION)
      : null

    for (const id of stations) {
      const pos = this.world.getComponent<PositionComponent>(id, COMPONENT_TYPES.POSITION)
      if (!pos || pos.systemId !== this.state.currentSystemId) continue
      const d2 = playerPos ? ((pos.x - playerPos.x) ** 2 + (pos.y - playerPos.y) ** 2) : 0
      if (d2 < best) { best = d2; targetId = id }
    }

    if (targetId === null) return { ok: false, message: 'No station in this system.' }

    const station = this.world.getComponent<StationComponent>(targetId, COMPONENT_TYPES.STATION)
    const crafting = this.world.getComponent<CraftingComponent>(targetId, COMPONENT_TYPES.CRAFTING)
    if (!station || !crafting) return { ok: false, message: 'Station unavailable.' }

    if (!crafting.recipeIds.includes(recipeId)) {
      return { ok: false, message: 'This station cannot run that recipe.' }
    }
    if (crafting.activeRecipeId) {
      return { ok: false, message: 'Station busy. Wait for current job to finish.' }
    }

    for (const input of recipe.inputs) {
      const have = station.storage.get(input.itemId) ?? 0
      if (have < input.amount) {
        return { ok: false, message: `Need ${input.amount} ${input.itemId}, have ${Math.floor(have)}.` }
      }
    }

    for (const input of recipe.inputs) {
      const have = station.storage.get(input.itemId) ?? 0
      station.storage.set(input.itemId, have - input.amount)
    }

    crafting.activeRecipeId = recipeId
    crafting.progress = 0
    return { ok: true, message: `Fabricating ${recipe.name}` }
  }
}

