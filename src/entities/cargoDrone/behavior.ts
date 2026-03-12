// ============================================================
// entities/cargoDrone/behavior.ts
// ============================================================

import type { World, EntityId } from '../../engine/ECS'
import { mkPosition, mkHealth, mkDrone, mkInventory, mkNavigation, mkRenderable } from '../../engine/components/index'
import { CARGO_DRONE_DEF } from './definition'
import type { TaskDescriptor } from '../../tasks/taskTypes'

export function spawnCargoDrone(world: World, x: number, y: number, systemId: string, homeStationId?: EntityId, tasks?: TaskDescriptor[]): EntityId {
  const id = world.createEntity()
  world.addComponent(id, mkPosition(x, y, systemId))
  world.addComponent(id, mkHealth(CARGO_DRONE_DEF.health))
  world.addComponent(id, mkInventory(CARGO_DRONE_DEF.inventorySlots))
  world.addComponent(id, mkNavigation(14))
  world.addComponent(id, mkRenderable('rect', CARGO_DRONE_DEF.color, 10, 3, 'CD'))
  const drone = mkDrone(CARGO_DRONE_DEF.cpuCost)
  drone.homeStationId = homeStationId ?? null
  if (tasks) drone.taskQueue.push(...tasks)
  world.addComponent(id, drone)
  world.addTag(id, 'drone')
  world.addTag(id, 'cargoDrone')
  return id
}
