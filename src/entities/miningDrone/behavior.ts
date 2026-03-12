// ============================================================
// entities/miningDrone/behavior.ts
// Factory function to spawn a mining drone into the ECS world.
// ============================================================

import type { World, EntityId } from '../../engine/ECS'
import {
  mkPosition,
  mkHealth,
  mkDrone,
  mkMining,
  mkInventory,
  mkNavigation,
  mkRenderable,
  mkActionState,
} from '../../engine/components/index'
import { MINING_DRONE_DEF } from './definition'
import type { TaskDescriptor } from '../../tasks/taskTypes'

export interface SpawnMiningDroneOptions {
  x: number
  y: number
  systemId: string
  homeStationId?: EntityId
  initialTasks?: TaskDescriptor[]
}

export function spawnMiningDrone(world: World, opts: SpawnMiningDroneOptions): EntityId {
  const id = world.createEntity()

  world.addComponent(id, mkPosition(opts.x, opts.y, opts.systemId))
  world.addComponent(id, mkHealth(MINING_DRONE_DEF.health))
  world.addComponent(id, mkInventory(MINING_DRONE_DEF.inventorySlots))
  world.addComponent(id, mkMining(MINING_DRONE_DEF.miningRate))
  world.addComponent(id, mkNavigation(12))
  world.addComponent(id, mkRenderable('diamond', MINING_DRONE_DEF.color, 8, 3, 'MD'))
  world.addComponent(id, mkActionState())

  const drone = mkDrone(MINING_DRONE_DEF.cpuCost)
  drone.homeStationId = opts.homeStationId ?? null
  if (opts.initialTasks) drone.taskQueue.push(...opts.initialTasks)
  world.addComponent(id, drone)

  world.addTag(id, 'drone')
  world.addTag(id, 'miningDrone')

  return id
}
