// ============================================================
// components/index.ts — All game components in one place.
// Components are pure data containers; no logic here.
// ============================================================

import type { EntityId } from '../ECS'
import type { ItemId } from '../../data/items'
import type { TaskDescriptor } from '../../tasks/taskTypes'

// ---- Positional --------------------------------------------

export interface PositionComponent {
  readonly type: 'position'
  x: number
  y: number
  systemId: string   // which star system this entity lives in
}
export const mkPosition = (x: number, y: number, systemId: string): PositionComponent =>
  ({ type: 'position', x, y, systemId })

// ---- Velocity (used for moving entities like drones) -------

export interface VelocityComponent {
  readonly type: 'velocity'
  vx: number
  vy: number
  speed: number      // max speed
}
export const mkVelocity = (speed: number): VelocityComponent =>
  ({ type: 'velocity', vx: 0, vy: 0, speed })

// ---- Rotation / heading -----------------------------------

export interface RotationComponent {
  readonly type: 'rotation'
  angle: number           // radians
}
export const mkRotation = (angle = 0): RotationComponent =>
  ({ type: 'rotation', angle })

// ---- Inventory ---------------------------------------------


export type Inventory = Map<ItemId, number>

export interface InventoryComponent {
  readonly type: 'inventory'
  items: Inventory
  maxSlots: number
  maxStack: number
}
export const mkInventory = (maxSlots = 8, maxStack = 100): InventoryComponent =>
  ({ type: 'inventory', items: new Map(), maxSlots, maxStack })

// ---- Health ------------------------------------------------

export interface HealthComponent {
  readonly type: 'health'
  current: number
  max: number
}
export const mkHealth = (max: number): HealthComponent =>
  ({ type: 'health', current: max, max })

// ---- Drone -------------------------------------------------

export type DroneState = 'idle' | 'moving' | 'working' | 'returning' | 'disabled'

export interface DroneComponent {
  readonly type: 'drone'
  state: DroneState
  taskQueue: TaskDescriptor[]
  currentTask: TaskDescriptor | null
  taskProgress: number    // 0-1 fraction through current task action
  cpuCost: number         // how many CPU units this drone uses
  homeStationId: EntityId | null
}
export const mkDrone = (cpuCost = 1): DroneComponent =>
  ({ type: 'drone', state: 'idle', taskQueue: [], currentTask: null, taskProgress: 0, cpuCost, homeStationId: null })

// ---- Mining capability -------------------------------------

export interface MiningComponent {
  readonly type: 'mining'
  miningRate: number      // units/second
  targetEntityId: EntityId | null
}
export const mkMining = (rate: number): MiningComponent =>
  ({ type: 'mining', miningRate: rate, targetEntityId: null })

// ---- Resource Deposit (asteroids, planets) -----------------

export interface ResourceDepositComponent {
  readonly type: 'resourceDeposit'
  resources: Map<ItemId, number>   // remaining amounts
  extractionDifficulty: number      // 0-1; affects mining rate
  depletedAt: number | null         // sim-time when this was exhausted
}
export const mkResourceDeposit = (
  resources: [ItemId, number][],
  difficulty = 0.5
): ResourceDepositComponent => ({
  type: 'resourceDeposit',
  resources: new Map(resources),
  extractionDifficulty: difficulty,
  depletedAt: null
})

// ---- Station -----------------------------------------------

export interface StationComponent {
  readonly type: 'station'
  name: string
  storageCapacity: number          // total item capacity
  storage: Inventory
  activeRecipeId: string | null
  recipeProgress: number           // 0-1
  cpuCapacity: number              // total CPU units for drones
  cpuUsed: number
}
export const mkStation = (name: string, storage = 1000, cpu = 4): StationComponent =>
  ({ type: 'station', name, storageCapacity: storage, storage: new Map(), activeRecipeId: null, recipeProgress: 0, cpuCapacity: cpu, cpuUsed: cpu === 0 ? 0 : 0 })

// ---- Printer / Factory -------------------------------------

export interface CraftingComponent {
  readonly type: 'crafting'
  recipeIds: string[]              // which recipes this unit can run
  activeRecipeId: string | null
  progress: number                 // 0-1
  inputBuffer: Inventory
  outputBuffer: Inventory
}
export const mkCrafting = (recipeIds: string[]): CraftingComponent =>
  ({ type: 'crafting', recipeIds, activeRecipeId: null, progress: 0, inputBuffer: new Map(), outputBuffer: new Map() })

// ---- Navigation (destination targeting) --------------------

export interface NavigationComponent {
  readonly type: 'navigation'
  targetX: number | null
  targetY: number | null
  targetEntityId: EntityId | null
  arrivalThreshold: number
}
export const mkNavigation = (arrivalThreshold = 10): NavigationComponent =>
  ({ type: 'navigation', targetX: null, targetY: null, targetEntityId: null, arrivalThreshold })

// ---- Renderable --------------------------------------------

export type ShapeType = 'circle' | 'rect' | 'diamond' | 'hexagon'

export interface RenderableComponent {
  readonly type: 'renderable'
  shape: ShapeType
  color: string
  size: number
  label?: string
  layer: number    // lower = drawn first
}
export const mkRenderable = (shape: ShapeType, color: string, size: number, layer = 1, label?: string): RenderableComponent =>
  ({ type: 'renderable', shape, color, size, layer, label })

// ---- Action State (visual cues) ----------------------------

export interface ActionStateComponent {
  readonly type: 'actionState'
  thrustForward: boolean
  thrustReverse: boolean
  miningTargetId: EntityId | null
  harvestingTargetId: EntityId | null
  attachedToId: EntityId | null
  harvestItemId: ItemId | null
  depositFlashUntil: number
}
export const mkActionState = (): ActionStateComponent =>
  ({
    type: 'actionState',
    thrustForward: false,
    thrustReverse: false,
    miningTargetId: null,
    harvestingTargetId: null,
    attachedToId: null,
    harvestItemId: null,
    depositFlashUntil: 0,
  })

// ---- CPU Uplink (the player probe itself) ------------------


export interface CpuComponent {
  readonly type: 'cpu'
  capacity: number
  used: number
}
export const mkCpu = (capacity: number): CpuComponent =>
  ({ type: 'cpu', capacity, used: 0 })

// ---- Star System membership --------------------------------

export interface SystemMemberComponent {
  readonly type: 'systemMember'
  systemId: string
  orbitRadius: number
  orbitSpeed: number      // radians/sec
  orbitAngle: number      // current angle
}
export const mkSystemMember = (systemId: string, orbitRadius: number, orbitSpeed: number, startAngle = 0): SystemMemberComponent =>
  ({ type: 'systemMember', systemId, orbitRadius, orbitSpeed, orbitAngle: startAngle })

// ---- Export map for easy lookup ----------------------------

export const COMPONENT_TYPES = {
  POSITION: 'position',
  VELOCITY: 'velocity',
  ROTATION: 'rotation',
  INVENTORY: 'inventory',
  HEALTH: 'health',
  DRONE: 'drone',
  MINING: 'mining',
  RESOURCE_DEPOSIT: 'resourceDeposit',
  STATION: 'station',
  CRAFTING: 'crafting',
  NAVIGATION: 'navigation',
  RENDERABLE: 'renderable',
  ACTION_STATE: 'actionState',
  CPU: 'cpu',
  SYSTEM_MEMBER: 'systemMember',
} as const





