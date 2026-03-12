// ============================================================
// ui/uiManager.ts - HUD + side panel renderer.
// ============================================================

import type { Game } from '../engine/Game'
import { events } from '../engine/Game'
import { COMPONENT_TYPES, type StationComponent, type CraftingComponent, type InventoryComponent, type PositionComponent, type HealthComponent, type VelocityComponent } from '../engine/components/index'
import { ITEMS } from '../data/items'
import { RECIPES } from '../data/recipes'
import { TECHNOLOGIES } from '../data/technologies'

export class UIManager {
  private game: Game
  private els: Record<string, HTMLElement | null> = {}

  constructor(game: Game) {
    this.game = game
    this.cacheElements()
    this.setupControls()
    events.on('bodySelected', (data) => this.showBodyCard(data as { body: any; entityId: number }))
  }

  private cacheElements(): void {
    const ids = [
      'inventory-list', 'inventory-capacity', 'player-pos', 'player-vel', 'player-system', 'player-health',
      'craft-list', 'craft-active', 'upgrade-list', 'station-list', 'sim-time', 'drone-count', 'system-label',
      'body-info-card', 'body-name', 'body-details'
    ]
    for (const id of ids) this.els[id] = document.getElementById(id)
  }

  private setupControls(): void {
    const tabs = ['inventory', 'craft', 'upgrades', 'systems']
    for (const tab of tabs) {
      const btn = document.getElementById(`tab-${tab}`)
      btn?.addEventListener('click', () => this.switchTab(tab))
    }

    const craftList = document.getElementById('craft-list')
    craftList?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const rid = target?.dataset?.recipe
      if (rid) this.queueRecipe(rid)
    })

    const upgradeList = document.getElementById('upgrade-list')
    upgradeList?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const uid = target?.dataset?.upgrade
      if (uid && window._game?.researchTech) window._game.researchTech(uid)
    })

    const bodyClose = document.getElementById('body-close')
    bodyClose?.addEventListener('click', () => this.hideBodyCard())
    const bodyDetails = document.getElementById('body-details')
    bodyDetails?.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-attach]') as HTMLElement | null
      if (target) {
        const bid = Number(target.dataset.body)
        const item = target.dataset.item || ''
        window._game?.attachHarvest(bid, item)
      }
      const detach = (e.target as HTMLElement).closest('[data-detach]')
      if (detach) window._game?.detach()
    })
  }

  private switchTab(tab: string): void {
    const tabs = ['inventory', 'craft', 'upgrades', 'systems']
    for (const t of tabs) {
      document.getElementById(`tab-${t}`)?.classList.toggle('active', t === tab)
      const panel = document.getElementById(`panel-${t}`)
      if (panel) panel.style.display = t === tab ? 'block' : 'none'
    }
  }

  update(): void {
    this.updateHeader()
    this.updateInventory()
    this.updateCrafting()
    this.updateUpgrades()
    this.updateStations()
  }

  private updateHeader(): void {
    const el = this.els['sim-time']
    if (el) {
      const t = this.game.state.simTime
      const mins = Math.floor(t / 60)
      const secs = Math.floor(t % 60)
      el.textContent = `T+${mins}m ${secs}s`
    }
    const dc = this.els['drone-count']
    if (dc) {
      const drones = this.game.world.query(COMPONENT_TYPES.DRONE)
      dc.textContent = `${drones.length}`
    }
    const sysLabel = this.els['system-label']
    if (sysLabel) sysLabel.textContent = this.game.state.currentSystemId.toUpperCase()
  }

  private updateInventory(): void {
    const invList = this.els['inventory-list']
    const capEl   = this.els['inventory-capacity']
    const posEl   = this.els['player-pos']
    const velEl   = this.els['player-vel']
    const sysEl   = this.els['player-system']
    const hpEl    = this.els['player-health']
    if (!invList) return

    const playerId = this.game.playerId
    const inv = playerId !== null ? this.game.world.getComponent<InventoryComponent>(playerId, COMPONENT_TYPES.INVENTORY) : null
    const pos = playerId !== null ? this.game.world.getComponent<PositionComponent>(playerId, COMPONENT_TYPES.POSITION) : null
    const hp  = playerId !== null ? this.game.world.getComponent<HealthComponent>(playerId, COMPONENT_TYPES.HEALTH) : null
    const vel = playerId !== null ? this.game.world.getComponent<VelocityComponent>(playerId, COMPONENT_TYPES.VELOCITY) : null

    if (capEl && inv) {
      const total = [...inv.items.values()].reduce((a, b) => a + b, 0)
      capEl.textContent = `${Math.floor(total)}/${inv.maxSlots * inv.maxStack}`
    }
    if (hpEl && hp) hpEl.textContent = `${Math.round(hp.current)}/${hp.max}`
    if (pos && posEl) posEl.textContent = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}`
    if (vel && velEl) {
      const speed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy)
      velEl.textContent = `${speed.toFixed(1)} u/s`
    }
    if (sysEl) sysEl.textContent = this.game.state.currentSystemId.toUpperCase()

    if (!inv || inv.items.size === 0) {
      invList.innerHTML = '<div class="empty">No resources collected.</div>'
      return
    }

    let html = ''
    for (const [itemId, amount] of [...inv.items.entries()].sort()) {
      const def = ITEMS[itemId]
      if (!def) continue
      html += `
        <div class="stack-row">
          <div class="icon">${def.icon}</div>
          <div class="label">${def.name}</div>
          <div class="qty">${Math.floor(amount)}</div>
        </div>`
    }
    invList.innerHTML = html || '<div class="empty">No resources collected.</div>'
  }

  private getActiveStation(): { station: StationComponent; crafting: CraftingComponent; id: number } | null {
    const stations = this.game.world.query(COMPONENT_TYPES.STATION, COMPONENT_TYPES.CRAFTING, COMPONENT_TYPES.POSITION)
    let best: { station: StationComponent; crafting: CraftingComponent; id: number; dist: number } | null = null
    const playerPos = this.game.playerId !== null
      ? this.game.world.getComponent<PositionComponent>(this.game.playerId, COMPONENT_TYPES.POSITION)
      : null

    for (const id of stations) {
      const st = this.game.world.getComponent<StationComponent>(id, COMPONENT_TYPES.STATION)
      const cr = this.game.world.getComponent<CraftingComponent>(id, COMPONENT_TYPES.CRAFTING)
      const pos = this.game.world.getComponent<PositionComponent>(id, COMPONENT_TYPES.POSITION)
      if (!st || !cr || !pos || pos.systemId !== this.game.state.currentSystemId) continue

      const d2 = playerPos
        ? ((pos.x - playerPos.x) ** 2 + (pos.y - playerPos.y) ** 2)
        : 0
      if (!best || d2 < best.dist) best = { station: st, crafting: cr, id, dist: d2 }
    }
    return best ? { station: best.station, crafting: best.crafting, id: best.id } : null
  }

  private renderIO(io: { itemId: string; amount: number }[], prefix: string): string {
    return io.map(i => {
      const def = ITEMS[i.itemId]
      const label = def ? `${def.icon} ${def.name}` : i.itemId
      return `${prefix}${i.amount} ${label}`
    }).join(' � ')
  }

  private updateCrafting(): void {
    const activeEl = this.els['craft-active']
    const listEl   = this.els['craft-list']
    if (!activeEl || !listEl) return

    const ctx = this.getActiveStation()

    if (!ctx) {
      activeEl.innerHTML = 'No station online. Build or find a station to fabricate.'
      listEl.innerHTML = '<div class="empty">No station detected.</div>'
      return
    }

    const { station, crafting } = ctx

    if (crafting.activeRecipeId) {
      const recipe = RECIPES[crafting.activeRecipeId]
      const pct = Math.min(1, crafting.progress) * 100
      activeEl.innerHTML = `Running: ${recipe?.name ?? crafting.activeRecipeId}
        <div class="progress-bar"><div class="progress-inner" style="width:${pct}%;"></div></div>`
    } else {
      activeEl.innerHTML = 'Station idle. Choose a recipe below.'
    }

    let html = ''
    for (const recipe of Object.values(RECIPES)) {
      const canRun = station.storage && recipe.inputs.every(inp => (station.storage.get(inp.itemId) ?? 0) >= inp.amount)
      const busy = Boolean(crafting.activeRecipeId)
      html += `
        <div class="recipe-row">
          <div class="recipe-header">
            <div class="recipe-name">${recipe.name}</div>
            <button class="btn" data-recipe="${recipe.id}" ${(!canRun || busy) ? 'disabled' : ''}>Queue</button>
          </div>
          <div class="recipe-desc">${recipe.description}</div>
          <div class="recipe-io">${this.renderIO(recipe.inputs, '- ')} ? ${this.renderIO(recipe.outputs, '+ ')}</div>
          <div class="recipe-io" style="color:#6b82aa">${recipe.processingTimeSec}s</div>
        </div>`
    }
    listEl.innerHTML = html
  }

  private updateUpgrades(): void {
    const el = this.els['upgrade-list']
    if (!el) return

    let html = ''
    for (const [id, tech] of Object.entries(TECHNOLOGIES)) {
      const unlocked = this.game.state.unlockedTechs.includes(id)
      const canResearch = !unlocked && tech.prerequisites.every(p => this.game.state.unlockedTechs.includes(p))
      html += `
        <div class="upgrade-row">
          <div>
            <div class="upgrade-title">${tech.icon} ${tech.name}</div>
            <div class="upgrade-desc">${tech.description}</div>
            <div class="upgrade-meta">Cost: ${tech.researchCost} RP</div>
          </div>
          ${unlocked
            ? '<div class="upgrade-meta">UNLOCKED</div>'
            : `<button class="btn" data-upgrade="${id}" ${canResearch ? '' : 'disabled'}>Research</button>`
          }
        </div>`
    }
    el.innerHTML = html || '<div class="empty">No upgrades available.</div>'
  }

  private updateStations(): void {
    const list = this.els['station-list']
    if (!list) return
    const stationIds = this.game.world.query(COMPONENT_TYPES.STATION)
    if (stationIds.length === 0) {
      list.innerHTML = '<div class="empty">No stations detected.</div>'
      return
    }
    let html = ''
    for (const id of stationIds) {
      const st = this.game.world.getComponent<StationComponent>(id, COMPONENT_TYPES.STATION)
      if (!st) continue
      let storage = ''
      for (const [itemId, amount] of st.storage) {
        const def = ITEMS[itemId]
        if (def && amount > 0) storage += `${def.icon}${Math.floor(amount)} `
      }
      html += `
        <div class="station-row">
          <div><strong>${st.name}</strong> � CPU ${st.cpuUsed}/${st.cpuCapacity}</div>
          <div class="station-storage">${storage || 'empty'}</div>
        </div>`
    }
    list.innerHTML = html
  }

  private queueRecipe(recipeId: string): void {
    const result = this.game.startCrafting(recipeId)
    this.flashActive(result.message, result.ok)
  }

  private flashActive(message: string, ok: boolean): void {
    const el = this.els['craft-active']
    if (!el) return
    el.textContent = message
    el.style.borderColor = ok ? '#2f9d78' : '#c75f5f'
    setTimeout(() => { if (el) el.style.borderColor = '#1e6b4d' }, 600)
  }

  private showBodyCard(data: { body: any; entityId: number } | null): void {
    const card = this.els['body-info-card']
    const nameEl = this.els['body-name']
    const detailEl = this.els['body-details']
    if (!card || !detailEl) return

    if (!data || !data.body) {
      card.classList.remove('visible')
      return
    }

    const body = data.body
    if (nameEl) nameEl.textContent = body.name ?? 'Unclassified'

    let deposits = ''
    const depositComp = this.game.world.getComponent(data.entityId, COMPONENT_TYPES.RESOURCE_DEPOSIT) as { resources?: Map<string, number> } | null
    if (depositComp && depositComp.resources) {
      deposits = [...depositComp.resources.entries()].map(([itemId, amount]) => {
        const def = ITEMS[itemId]
        const label = def ? `${def.icon} ${def.name}` : itemId
        return `<span class="deposit-chip">${label} � ${Math.floor(amount)}</span>`
      }).join('')
    } else if (body.deposits && body.deposits.length > 0) {
      deposits = body.deposits.map((d: any) => {
        const def = ITEMS[d.itemId]
        const label = def ? `${def.icon} ${def.name}` : d.itemId
        return `<span class="deposit-chip">${label} � ${Math.floor(d.amount)}</span>`
      }).join('')
    }

    detailEl.innerHTML = `
      <div><span class="body-field">Type:</span> <span class="body-value">${body.bodyType}</span></div>
      <div><span class="body-field">Orbit:</span> <span class="body-value">${Math.floor(body.orbitRadius)}u @ ${body.orbitSpeed.toFixed(3)} rad/s</span></div>
      <div><span class="body-field">Radius:</span> <span class="body-value">${Math.floor(body.radius)}u</span></div>
      <div style="margin-top:6px;"><span class="body-field">Resources:</span><br>${deposits || '<span class="body-value">No detected deposits</span>'}</div>
    `

    card.classList.add('visible')
  }

  private hideBodyCard(): void {
    const card = this.els['body-info-card']
    if (card) card.classList.remove('visible')
  }
}

// Expose research callback
declare global {
  interface Window { _game?: { researchTech: (id: string) => void; attachHarvest: (id: number, itemId: string) => void; detach: () => void } }
}
