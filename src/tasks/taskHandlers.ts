// ============================================================
// tasks/taskHandlers.ts - One handler per task type.
// Register new handlers here to add new drone behaviors.
// ============================================================

import type { World, EntityId } from '../engine/ECS'
import type { TaskDescriptor, MineTask, TransportTask, IdleTask, ReturnHomeTask } from './taskTypes'
import {
  COMPONENT_TYPES,
  type DroneComponent,
  type InventoryComponent,
  type ResourceDepositComponent,
  type PositionComponent,
  type StationComponent,
  type ActionStateComponent,
} from '../engine/components/index'

// ---- Result returned by each handler ----------------------

export type TaskResult = 'running' | 'completed' | 'failed'

// ---- Handler interface ------------------------------------

export interface TaskHandler<T extends TaskDescriptor = TaskDescriptor> {
  readonly taskType: string
  execute(world: World, droneId: EntityId, task: T, dt: number): TaskResult
}

// ---- Registry ---------------------------------------------

const handlers = new Map<string, TaskHandler<TaskDescriptor>>()

export function registerTaskHandler(handler: TaskHandler<TaskDescriptor>): void {
  handlers.set(handler.taskType, handler)
}

export function getTaskHandler(taskType: string): TaskHandler<TaskDescriptor> | undefined {
  return handlers.get(taskType)
}

// ============================================================
// Built-in handlers
// ============================================================

// ---- Helpers -----------------------------------------------

function moveToward(pos: PositionComponent, tx: number, ty: number, speed: number, dt: number): boolean {
  const dx = tx - pos.x
  const dy = ty - pos.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < speed * dt) {
    pos.x = tx; pos.y = ty
    return true   // arrived
  }
  const nx = dx / dist
  const ny = dy / dist
  pos.x += nx * speed * dt
  pos.y += ny * speed * dt
  return false
}

function inventoryAdd(inv: InventoryComponent, itemId: string, amount: number): number {
  const current = inv.items.get(itemId) ?? 0
  const hasSlot = inv.items.has(itemId) || inv.items.size < inv.maxSlots
  if (!hasSlot) return 0
  const added = Math.min(amount, inv.maxStack - current)
  if (added > 0) inv.items.set(itemId, current + added)
  return added
}

function inventoryRemove(inv: InventoryComponent, itemId: string, amount: number): number {
  const current = inv.items.get(itemId) ?? 0
  const removed = Math.min(amount, current)
  if (removed > 0) {
    const remaining = current - removed
    if (remaining === 0) inv.items.delete(itemId)
    else inv.items.set(itemId, remaining)
  }
  return removed
}

function totalInventoryCount(inv: InventoryComponent): number {
  let total = 0
  for (const v of inv.items.values()) total += v
  return total
}

function dumpInventoryToStation(inv: InventoryComponent, station: StationComponent): void {
  let total = 0
  for (const v of station.storage.values()) total += v

  for (const [itemId, amount] of [...inv.items.entries()]) {
    if (total >= station.storageCapacity) break
    const room = station.storageCapacity - total
    const move = Math.min(room, amount)
    station.storage.set(itemId, (station.storage.get(itemId) ?? 0) + move)
    const remaining = amount - move
    total += move
    if (remaining > 0) inv.items.set(itemId, remaining)
    else inv.items.delete(itemId)
  }
}

// ---- MINE handler ------------------------------------------

const mineHandler: TaskHandler<MineTask> = {
  taskType: 'mine',
  execute(world, droneId, task, dt) {
    const pos     = world.getComponent<PositionComponent>(droneId, COMPONENT_TYPES.POSITION)
    const inv     = world.getComponent<InventoryComponent>(droneId, COMPONENT_TYPES.INVENTORY)
    const mining  = world.getComponent(droneId, COMPONENT_TYPES.MINING) as { miningRate: number } | undefined
    const action  = world.getComponent<ActionStateComponent>(droneId, COMPONENT_TYPES.ACTION_STATE)
    if (!pos || !inv || !mining) return 'failed'

    const deposit = world.getComponent<ResourceDepositComponent>(task.targetId, COMPONENT_TYPES.RESOURCE_DEPOSIT)
    const targetPos = world.getComponent<PositionComponent>(task.targetId, COMPONENT_TYPES.POSITION)
    if (!deposit || !targetPos || deposit.depletedAt !== null) return 'failed'

    if (action) action.miningTargetId = task.targetId

    // 1. Move to target
    const arrived = moveToward(pos, targetPos.x, targetPos.y, 80, dt)
    if (!arrived) return 'running'

    // 2. Check inventory space
    if (totalInventoryCount(inv) >= inv.maxSlots * inv.maxStack) return 'completed'

    // 3. Mine (slower base rate applied by mining component)
    const available = deposit.resources.get(task.itemId) ?? 0
    if (available === 0) return 'completed'

    const canMine = mining.miningRate * dt * (1 - deposit.extractionDifficulty * 0.5)
    const willMine = Math.min(canMine, available, task.maxAmount - task.collected)

    if (willMine <= 0) return 'completed'

    const actual = Math.floor(willMine * 10) / 10  // round to 0.1

    deposit.resources.set(task.itemId, available - actual)
    if ((available - actual) <= 0) {
      deposit.resources.delete(task.itemId)
      if (deposit.resources.size === 0) deposit.depletedAt = Date.now()
    }

    inventoryAdd(inv, task.itemId, actual)
    task.collected += actual

    if (task.collected >= task.maxAmount) return 'completed'
    return 'running'
  }
}

// ---- TRANSPORT handler -------------------------------------

const transportHandler: TaskHandler<TransportTask> = {
  taskType: 'transport',
  execute(world, droneId, task, dt) {
    const pos = world.getComponent<PositionComponent>(droneId, COMPONENT_TYPES.POSITION)
    const inv = world.getComponent<InventoryComponent>(droneId, COMPONENT_TYPES.INVENTORY)
    if (!pos || !inv) return 'failed'

    if (!task.pickedUp) {
      // Go to source and pick up
      const sourcePos = world.getComponent<PositionComponent>(task.sourceId, COMPONENT_TYPES.POSITION)
      if (!sourcePos) return 'failed'

      const arrived = moveToward(pos, sourcePos.x, sourcePos.y, 80, dt)
      if (!arrived) return 'running'

      // Try to pick up from station storage
      const station = world.getComponent<StationComponent>(task.sourceId, COMPONENT_TYPES.STATION)
      if (station) {
        const available = station.storage.get(task.itemId) ?? 0
        const take = Math.min(available, task.amount)
        if (take > 0) {
          station.storage.set(task.itemId, available - take)
          inventoryAdd(inv, task.itemId, take)
          task.pickedUp = true
          // Update amount to what was actually taken
          ;(task as { amount: number }).amount = take
        }
      }
      return 'running'

    } else {
      // Go to destination and drop off
      const destPos = world.getComponent<PositionComponent>(task.destinationId, COMPONENT_TYPES.POSITION)
      if (!destPos) return 'failed'

      const arrived = moveToward(pos, destPos.x, destPos.y, 80, dt)
      if (!arrived) return 'running'

      const station = world.getComponent<StationComponent>(task.destinationId, COMPONENT_TYPES.STATION)
      if (station) {
        const inInv = inv.items.get(task.itemId) ?? 0
        const deposited = Math.min(inInv, task.amount)
        inventoryRemove(inv, task.itemId, deposited)
        const current = station.storage.get(task.itemId) ?? 0
        station.storage.set(task.itemId, current + deposited)
      }
      return 'completed'
    }
  }
}

// ---- IDLE handler ------------------------------------------

const idleHandler: TaskHandler<IdleTask> = {
  taskType: 'idle',
  execute(_world, _droneId, task, dt) {
    task.elapsed += dt
    return task.elapsed >= task.durationSec ? 'completed' : 'running'
  }
}

// ---- RETURN HOME handler -----------------------------------

const returnHomeHandler: TaskHandler<ReturnHomeTask> = {
  taskType: 'return_home',
  execute(world, droneId, _task, dt) {
    const drone = world.getComponent<DroneComponent>(droneId, COMPONENT_TYPES.DRONE)
    const pos   = world.getComponent<PositionComponent>(droneId, COMPONENT_TYPES.POSITION)
    const inv   = world.getComponent<InventoryComponent>(droneId, COMPONENT_TYPES.INVENTORY)
    const act   = world.getComponent<ActionStateComponent>(droneId, COMPONENT_TYPES.ACTION_STATE)
    if (!drone || !pos) return 'failed'
    if (!drone.homeStationId) return 'completed'

    const homePos = world.getComponent<PositionComponent>(drone.homeStationId, COMPONENT_TYPES.POSITION)
    if (!homePos) return 'failed'

    const arrived = moveToward(pos, homePos.x, homePos.y, 80, dt)
    if (!arrived) return 'running'

    // Dump cargo when we reach home
    const station = world.getComponent<StationComponent>(drone.homeStationId, COMPONENT_TYPES.STATION)
    if (station && inv) {
      dumpInventoryToStation(inv, station)
    }
    if (act) act.miningTargetId = null
    return 'completed'
  }
}

// ---- Register all built-in handlers ------------------------

registerTaskHandler(mineHandler as TaskHandler<TaskDescriptor>)
registerTaskHandler(transportHandler as TaskHandler<TaskDescriptor>)
registerTaskHandler(idleHandler as TaskHandler<TaskDescriptor>)
registerTaskHandler(returnHomeHandler as TaskHandler<TaskDescriptor>)
