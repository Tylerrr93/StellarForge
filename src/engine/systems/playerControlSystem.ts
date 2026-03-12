// ============================================================
// engine/systems/playerControlSystem.ts - Keyboard/controller bridge.
// Rocket-style controls: turn with A/D, thrust with W/S.
// ============================================================

import type { System, World, EntityId } from '../ECS'
import {
  COMPONENT_TYPES,
  type VelocityComponent,
  type NavigationComponent,
  type RotationComponent,
  type ActionStateComponent,
} from '../components/index'

export interface InputState {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  harvest: boolean
  deposit: boolean
}

export function createPlayerControlSystem(input: InputState, playerId: EntityId): System {
  return {
    name: 'playerControlSystem',
    priority: -5,

    update(world: World, dt: number): void {
      const vel = world.getComponent<VelocityComponent>(playerId, COMPONENT_TYPES.VELOCITY)
      const nav = world.getComponent<NavigationComponent>(playerId, COMPONENT_TYPES.NAVIGATION)
      const rot = world.getComponent<RotationComponent>(playerId, COMPONENT_TYPES.ROTATION)
      const act = world.getComponent<ActionStateComponent>(playerId, COMPONENT_TYPES.ACTION_STATE)
      if (!vel || !rot) return

      // Steering
      const turnDir = (input.right ? 1 : 0) + (input.left ? -1 : 0)
      const turnRate = 1.8 // rad/sec
      rot.angle += turnDir * turnRate * dt

      // Thrust
      const thrustForward = input.up
      const thrustReverse = input.down
      const thrustAccel = thrustForward ? 90 : thrustReverse ? -50 : 0

      if (thrustAccel !== 0) {
        if (nav) {
          nav.targetX = null
          nav.targetY = null
          nav.targetEntityId = null
        }
        const ax = Math.cos(rot.angle) * thrustAccel
        const ay = Math.sin(rot.angle) * thrustAccel
        vel.vx += ax * dt
        vel.vy += ay * dt
        const speed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy)
        const max = vel.speed
        if (speed > max) {
          const scale = max / speed
          vel.vx *= scale
          vel.vy *= scale
        }
      }

      if (act) {
        act.thrustForward = thrustForward
        act.thrustReverse = thrustReverse
      }
    }
  }
}
