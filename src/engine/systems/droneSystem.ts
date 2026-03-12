// ============================================================
// engine/systems/droneSystem.ts — Processes drone task queues.
// ============================================================

import type { System, World } from '../ECS'
import { COMPONENT_TYPES, type DroneComponent, type ActionStateComponent } from '../components/index'
import { getTaskHandler } from '../../tasks/taskHandlers'

export const droneSystem: System = {
  name: 'droneSystem',
  priority: 10,

  update(world: World, dt: number): void {
    const drones = world.query(COMPONENT_TYPES.DRONE)

    for (const droneId of drones) {
      const drone = world.getComponent<DroneComponent>(droneId, COMPONENT_TYPES.DRONE)
      const action = world.getComponent<ActionStateComponent>(droneId, COMPONENT_TYPES.ACTION_STATE)
      if (!drone || drone.state === 'disabled') continue

      // If no current task, pull next from queue
      if (!drone.currentTask) {
        if (drone.taskQueue.length === 0) {
          drone.state = 'idle'
          if (action) action.miningTargetId = null
          continue
        }
        drone.currentTask = drone.taskQueue.shift()!
        drone.taskProgress = 0
        drone.state = 'working'
      }

      const task = drone.currentTask
      const handler = getTaskHandler(task.taskType)

      if (!handler) {
        console.warn(`No handler for task type: ${task.taskType}`)
        drone.currentTask = null
        if (action) action.miningTargetId = null
        continue
      }

      const result = handler.execute(world, droneId, task, dt)

      if (result === 'completed' || result === 'failed') {
        drone.currentTask = null
        drone.taskProgress = 0
        if (action) action.miningTargetId = null
        if (drone.taskQueue.length === 0) drone.state = 'idle'
      }
    }
  }
}

