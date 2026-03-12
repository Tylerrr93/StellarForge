// ============================================================
// rendering/renderer.ts � Canvas 2D renderer.
// Only depends on ECS components, not game logic.
// ============================================================

import type { World } from '../engine/ECS'
import {
  COMPONENT_TYPES,
  type PositionComponent,
  type RenderableComponent,
  type ResourceDepositComponent,
  type RotationComponent,
  type ActionStateComponent,
} from '../engine/components/index'
import type { StarSystemData } from '../generation/universeGenerator'

export interface Camera {
  x: number
  y: number
  zoom: number
}

export class Renderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  camera: Camera = { x: 0, y: 0, zoom: 1 }
  private currentSystemId = 'sys_0'

  // Dragging
  private dragging = false
  private dragStart = { x: 0, y: 0 }
  private cameraStart = { x: 0, y: 0 }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.setupEventListeners()
    this.resize()
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', () => this.resize())

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      this.camera.zoom = Math.max(0.2, Math.min(5, this.camera.zoom * factor))
    }, { passive: false })

    this.canvas.addEventListener('mousedown', (e) => {
      this.dragging = true
      this.dragStart = { x: e.clientX, y: e.clientY }
      this.cameraStart = { x: this.camera.x, y: this.camera.y }
    })

    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return
      const dx = (e.clientX - this.dragStart.x) / this.camera.zoom
      const dy = (e.clientY - this.dragStart.y) / this.camera.zoom
      this.camera.x = this.cameraStart.x - dx
      this.camera.y = this.cameraStart.y - dy
    })

    window.addEventListener('mouseup', () => { this.dragging = false })
  }

  resize(): void {
    const panel = document.getElementById('ui-panel')
    const panelWidth = panel ? panel.offsetWidth : 280
    this.canvas.width  = window.innerWidth - panelWidth
    this.canvas.height = window.innerHeight
  }

  setSystem(systemId: string): void {
    this.currentSystemId = systemId
  }

  render(world: World, system: StarSystemData | null): void {
    const ctx  = this.ctx
    const W    = this.canvas.width
    const H    = this.canvas.height

    ctx.fillStyle = '#050510'
    ctx.fillRect(0, 0, W, H)

    // Transform to world space
    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.scale(this.camera.zoom, this.camera.zoom)
    ctx.translate(-this.camera.x, -this.camera.y)

    this.drawStars(ctx, W, H)

    if (system) {
      this.drawSystemBackground(ctx, system)
    }

    this.drawEntities(ctx, world)

    ctx.restore()
  }

  private drawStars(ctx: CanvasRenderingContext2D, _W: number, _H: number): void {
    // Static background stars (deterministic by position)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    for (let i = 0; i < 200; i++) {
      const sx = ((i * 1237 + 331) % 3000) - 1500
      const sy = ((i * 997  + 113) % 3000) - 1500
      const sz = ((i * 7)   % 3) * 0.5 + 0.5
      ctx.beginPath()
      ctx.arc(sx, sy, sz, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawSystemBackground(ctx: CanvasRenderingContext2D, system: StarSystemData): void {
    // Draw star
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, system.starRadius * 2)
    grad.addColorStop(0,   system.starColor)
    grad.addColorStop(0.5, system.starColor + '88')
    grad.addColorStop(1,   'transparent')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(0, 0, system.starRadius * 2, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = system.starColor
    ctx.beginPath()
    ctx.arc(0, 0, system.starRadius, 0, Math.PI * 2)
    ctx.fill()

    // Orbit rings
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    for (const body of system.bodies) {
      ctx.beginPath()
      ctx.arc(0, 0, body.orbitRadius, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Celestial bodies
    for (const body of system.bodies) {
      const bx = Math.cos(body.orbitAngle) * body.orbitRadius
      const by = Math.sin(body.orbitAngle) * body.orbitRadius

      ctx.fillStyle = body.color
      ctx.beginPath()
      ctx.arc(bx, by, body.radius, 0, Math.PI * 2)
      ctx.fill()

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = '8px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(body.name, bx, by - body.radius - 4)
    }
  }

  private drawEntities(ctx: CanvasRenderingContext2D, world: World): void {
    // Collect renderables in this system, sorted by layer
    const ids = world.query(COMPONENT_TYPES.RENDERABLE, COMPONENT_TYPES.POSITION)
    const inSystem = ids.filter(id => {
      const pos = world.getComponent<PositionComponent>(id, COMPONENT_TYPES.POSITION)
      return pos?.systemId === this.currentSystemId
    })

    inSystem.sort((a, b) => {
      const ra = world.getComponent<RenderableComponent>(a, COMPONENT_TYPES.RENDERABLE)
      const rb = world.getComponent<RenderableComponent>(b, COMPONENT_TYPES.RENDERABLE)
      return (ra?.layer ?? 0) - (rb?.layer ?? 0)
    })

    for (const id of inSystem) {
      const pos = world.getComponent<PositionComponent>(id, COMPONENT_TYPES.POSITION)!
      const ren = world.getComponent<RenderableComponent>(id, COMPONENT_TYPES.RENDERABLE)!
      const rot = world.getComponent<RotationComponent>(id, COMPONENT_TYPES.ROTATION)
      const act = world.getComponent<ActionStateComponent>(id, COMPONENT_TYPES.ACTION_STATE)

      ctx.save()
      ctx.translate(pos.x, pos.y)

      // Action beams (mining/harvesting) are drawn before rotation
      if (act) {
        const targetId = act.harvestingTargetId ?? act.miningTargetId
        if (targetId) {
          const tPos = world.getComponent<PositionComponent>(targetId, COMPONENT_TYPES.POSITION)
          if (tPos && tPos.systemId === this.currentSystemId) {
            ctx.strokeStyle = act.harvestingTargetId ? 'rgba(80,200,255,0.8)' : 'rgba(255,180,80,0.8)'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(0, 0)
            ctx.lineTo(tPos.x - pos.x, tPos.y - pos.y)
            ctx.stroke()
          }
        }
      }

      // Ship rotation (applies to visuals below)
      if (rot) ctx.rotate(rot.angle)
      // Deposit flash
      if (act && act.depositFlashUntil > Date.now()) {
        const alpha = (act.depositFlashUntil - Date.now()) / 300
        ctx.strokeStyle = `rgba(120,255,200,${Math.max(0, alpha)})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(0, 0, ren.size + 6, 0, Math.PI * 2)
        ctx.stroke()
      }

      if (act && (act.thrustForward || act.thrustReverse)) {
        this.drawThrusters(ctx, ren.size, act.thrustReverse)
      }

      this.drawShape(ctx, ren)

      // Resource deposit overlay
      const deposit = world.getComponent<ResourceDepositComponent>(id, COMPONENT_TYPES.RESOURCE_DEPOSIT)
      if (deposit && deposit.resources.size > 0) {
        const total = [...deposit.resources.values()].reduce((a, b) => a + b, 0)
        const maxTotal = 10000
        const fraction = Math.min(1, total / maxTotal)
        ctx.strokeStyle = `rgba(80,255,120,${fraction * 0.8})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(0, 0, ren.size + 4, 0, Math.PI * 2)
        ctx.stroke()
      }

      ctx.restore()
    }
  }

  private drawShape(ctx: CanvasRenderingContext2D, ren: RenderableComponent): void {
    const s = ren.size
    ctx.fillStyle = ren.color

    switch (ren.shape) {
      case 'circle':
        ctx.beginPath()
        ctx.arc(0, 0, s, 0, Math.PI * 2)
        ctx.fill()
        break

      case 'rect':
        ctx.fillRect(-s, -s * 0.6, s * 2, s * 1.2)
        break

      case 'diamond':
        ctx.beginPath()
        ctx.moveTo(0, -s)
        ctx.lineTo(s, 0)
        ctx.lineTo(0, s)
        ctx.lineTo(-s, 0)
        ctx.closePath()
        ctx.fill()
        break

      case 'hexagon': {
        ctx.beginPath()
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6
          const x = Math.cos(angle) * s
          const y = Math.sin(angle) * s
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'
        ctx.lineWidth = 1
        ctx.stroke()
        break
      }
    }

    // Label
    if (ren.label) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.font = `${Math.max(6, s * 0.7)}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(ren.label, 0, 0)
    }
  }

private drawThrusters(ctx: CanvasRenderingContext2D, size: number, reverse = false): void {
  // Anchor slightly behind the rect center
  const anchorX = -size * 1.1;
  const spreadY = size * 0.55;
  const flameLen = size * (reverse ? 0.7 : 1.3);
  const wobble = Math.sin(Date.now() / 90) * (size * 0.15);

  const drawFlame = (sign: number) => {
    const y0 = sign * spreadY * 0.6;
    const y1 = sign * spreadY;
    const y2 = sign * spreadY * 1.35;
    ctx.fillStyle = reverse ? 'rgba(120,190,255,0.9)' : 'rgba(255,180,90,0.9)';
    ctx.beginPath();
    ctx.moveTo(anchorX, y0);
    ctx.lineTo(anchorX - flameLen - wobble, y1);
    ctx.lineTo(anchorX, y2);
    ctx.closePath();
    ctx.fill();
  };

  drawFlame(1);
  drawFlame(-1);
}


  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.canvas.width / 2) / this.camera.zoom + this.camera.x,
      y: (sy - this.canvas.height / 2) / this.camera.zoom + this.camera.y,
    }
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.camera.x) * this.camera.zoom + this.canvas.width / 2,
      y: (wy - this.camera.y) * this.camera.zoom + this.canvas.height / 2,
    }
  }
}






