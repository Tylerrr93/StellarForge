// ============================================================
// tasks/taskTypes.ts — Task descriptor interfaces.
// A TaskDescriptor is plain data — no logic.
// Task Handlers (in individual files) contain the logic.
// ============================================================

import type { EntityId } from '../engine/ECS'
import type { ItemId } from '../data/items'

// ---- Base Task --------------------------------------------

export type TaskType =
  | 'mine'
  | 'transport'
  | 'explore'
  | 'build'
  | 'idle'
  | 'return_home'

export interface BaseTask {
  readonly taskType: TaskType
  id: string          // unique instance id
}

// ---- Mine -------------------------------------------------

export interface MineTask extends BaseTask {
  readonly taskType: 'mine'
  targetId: EntityId        // resource deposit entity
  itemId: ItemId            // what to mine
  maxAmount: number         // stop when collected this much
  collected: number
}

// ---- Transport --------------------------------------------

export interface TransportTask extends BaseTask {
  readonly taskType: 'transport'
  sourceId: EntityId
  destinationId: EntityId
  itemId: ItemId
  amount: number
  pickedUp: boolean
}

// ---- Explore ----------------------------------------------

export interface ExploreTask extends BaseTask {
  readonly taskType: 'explore'
  targetSystemId: string | null   // null = pick nearest unknown
  scanRadius: number
}

// ---- Build ------------------------------------------------

export interface BuildTask extends BaseTask {
  readonly taskType: 'build'
  entityType: string         // e.g. 'station'
  targetX: number
  targetY: number
  requiredItems: { itemId: ItemId; amount: number }[]
  progress: number
}

// ---- Idle / Return ----------------------------------------

export interface IdleTask extends BaseTask {
  readonly taskType: 'idle'
  durationSec: number
  elapsed: number
}

export interface ReturnHomeTask extends BaseTask {
  readonly taskType: 'return_home'
}

// ---- Union type -------------------------------------------

export type TaskDescriptor =
  | MineTask
  | TransportTask
  | ExploreTask
  | BuildTask
  | IdleTask
  | ReturnHomeTask

// ---- Factory helpers --------------------------------------

let _taskIdCounter = 0
const nextTaskId = () => `task_${++_taskIdCounter}`

export function mkMineTask(targetId: EntityId, itemId: ItemId, maxAmount = 50): MineTask {
  return { taskType: 'mine', id: nextTaskId(), targetId, itemId, maxAmount, collected: 0 }
}

export function mkTransportTask(sourceId: EntityId, destinationId: EntityId, itemId: ItemId, amount: number): TransportTask {
  return { taskType: 'transport', id: nextTaskId(), sourceId, destinationId, itemId, amount, pickedUp: false }
}

export function mkExploreTask(targetSystemId: string | null = null): ExploreTask {
  return { taskType: 'explore', id: nextTaskId(), targetSystemId, scanRadius: 500 }
}

export function mkIdleTask(durationSec: number): IdleTask {
  return { taskType: 'idle', id: nextTaskId(), durationSec, elapsed: 0 }
}

export function mkReturnHomeTask(): ReturnHomeTask {
  return { taskType: 'return_home', id: nextTaskId() }
}
