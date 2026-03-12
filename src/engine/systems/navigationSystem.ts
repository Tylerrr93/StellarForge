// ============================================================
// engine/systems/navigationSystem.ts - Movement + navigation glue.
// - navigationSystem steers entities toward a target point/entity.
// - movementSystem integrates velocities into positions.
// ============================================================

import type { System, World } from '../ECS'
import {
  COMPONENT_TYPES,
  type NavigationComponent,
  type PositionComponent,
  type VelocityComponent,
  type RotationComponent,
  type ActionStateComponent,
} from '../components/index'

function resolveTarget(world: World, nav: NavigationComponent): { x: number; y: number } | null {
  if (nav.targetEntityId !== null) {
    const targetPos = world.getComponent<PositionComponent>(nav.targetEntityId, COMPONENT_TYPES.POSITION)
    if (targetPos) return { x: targetPos.x, y: targetPos.y }
  }
  if (nav.targetX !== null && nav.targetY !== null) {
    return { x: nav.targetX, y: nav.targetY }
  }
  return null
}

export const navigationSystem: System = {
  name: 'navigationSystem',

  update(world: World, _dt: number): void {
    const movers = world.query(COMPONENT_TYPES.NAVIGATION, COMPONENT_TYPES.VELOCITY, COMPONENT_TYPES.POSITION)

    for (const id of movers) {
      const nav = world.getComponent<NavigationComponent>(id, COMPONENT_TYPES.NAVIGATION)
      const pos = world.getComponent<PositionComponent>(id, COMPONENT_TYPES.POSITION)
      const vel = world.getComponent<VelocityComponent>(id, COMPONENT_TYPES.VELOCITY)
      const rot = world.getComponent<RotationComponent>(id, COMPONENT_TYPES.ROTATION)
      const act = world.getComponent<ActionStateComponent>(id, COMPONENT_TYPES.ACTION_STATE)
      if (!nav || !pos || !vel) continue

      const target = resolveTarget(world, nav)
      if (!target) continue

      const dx = target.x - pos.x
      const dy = target.y - pos.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist <= nav.arrivalThreshold) {
        vel.vx = 0
        vel.vy = 0
        nav.targetX = nav.targetY = nav.targetEntityId = null
        if (act) { act.thrustForward = false; act.thrustReverse = false }
        continue
      }

      const nx = dx / dist
      const ny = dy / dist

      if (rot) {
        const desired = Math.atan2(ny, nx)
        const delta = ((desired - rot.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI
        const turnRate = 3.2 * (world.hasTag?.(id, 'player') ? 1 : 0.6)
        rot.angle += Math.max(-turnRate * _dt, Math.min(turnRate * _dt, delta))
      }

      const speed = world.hasTag?.(id, "player") ? vel.speed * 0.1 : vel.speed
      vel.vx = nx * speed
      vel.vy = ny * speed
      if (act && world.hasTag?.(id, "player")) { act.thrustForward = true; act.thrustReverse = false }
    }
  }
}

export const movementSystem: System = {
  name: 'movementSystem',
  priority: 1,

  update(world: World, dt: number): void {
    const moving = world.query(COMPONENT_TYPES.VELOCITY, COMPONENT_TYPES.POSITION)
    for (const id of moving) {
      const pos = world.getComponent<PositionComponent>(id, COMPONENT_TYPES.POSITION)
      const vel = world.getComponent<VelocityComponent>(id, COMPONENT_TYPES.VELOCITY)
      if (!pos || !vel) continue

      pos.x += vel.vx * dt
      pos.y += vel.vy * dt

      // Light space-drift damping to prevent runaway speeds
      const damping = Math.pow(0.92, dt * 60)
      vel.vx *= damping
      vel.vy *= damping
    }
  }
}
