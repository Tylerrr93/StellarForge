// ============================================================
// engine/systems/orbitSystem.ts - Updates orbital positions.
// ============================================================

import type { System, World } from '../ECS'
import { COMPONENT_TYPES, type SystemMemberComponent, type PositionComponent } from '../components/index'

export const orbitSystem: System = {
  name: 'orbitSystem',
  priority: 5,

  update(world: World, dt: number): void {
    const members = world.query(COMPONENT_TYPES.SYSTEM_MEMBER, COMPONENT_TYPES.POSITION)

    for (const id of members) {
      const orbit = world.getComponent<SystemMemberComponent>(id, COMPONENT_TYPES.SYSTEM_MEMBER)
      const pos   = world.getComponent<PositionComponent>(id, COMPONENT_TYPES.POSITION)
      if (!orbit || !pos) continue

      const wobble = 1 + Math.sin((Date.now() * 0.001) + id * 0.37) * 0.06
      orbit.orbitAngle += orbit.orbitSpeed * wobble * dt
      pos.x = Math.cos(orbit.orbitAngle) * orbit.orbitRadius
      pos.y = Math.sin(orbit.orbitAngle) * orbit.orbitRadius
    }
  }
}

// ============================================================
// engine/systems/resourceSystem.ts - Tracks global resource totals.
// This is a lightweight aggregation system for UI display.
// ============================================================

import type { InventoryComponent, StationComponent } from '../components/index'

export interface ResourceTotals {
  items: Map<string, number>
  lastUpdated: number
}

export const globalResources: ResourceTotals = {
  items: new Map(),
  lastUpdated: 0,
}

export const resourceSystem: System = {
  name: 'resourceSystem',
  priority: 99,  // runs last so totals reflect current frame

  update(world: World, _dt: number): void {
    const totals = new Map<string, number>()

    // Sum drone inventories
    const droneInvs = world.query(COMPONENT_TYPES.INVENTORY, COMPONENT_TYPES.DRONE)
    for (const id of droneInvs) {
      const inv = world.getComponent<InventoryComponent>(id, COMPONENT_TYPES.INVENTORY)
      if (!inv) continue
      for (const [itemId, amount] of inv.items) {
        totals.set(itemId, (totals.get(itemId) ?? 0) + amount)
      }
    }

    // Sum station storage
    const stations = world.query(COMPONENT_TYPES.STATION)
    for (const id of stations) {
      const station = world.getComponent<StationComponent>(id, COMPONENT_TYPES.STATION)
      if (!station) continue
      for (const [itemId, amount] of station.storage) {
        totals.set(itemId, (totals.get(itemId) ?? 0) + amount)
      }
    }

    globalResources.items = totals
    globalResources.lastUpdated = Date.now()
  }
}
