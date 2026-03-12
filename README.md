# StellarForge

A browser-based incremental space automation game. You are a sentient self-replicating probe awakening in a ruined solar system. Survive. Build. Expand. Automate.

---

## Architecture

StellarForge is built as a **content-driven engine** using an **Entity Component System (ECS)**. The goal is that adding new game content never requires modifying core engine code.

```
src/
├── engine/
│   ├── ECS.ts              ← World, Entity, Component, System, Scheduler
│   ├── Game.ts             ← Top-level: boots world, systems, starting scene
│   ├── components/
│   │   └── index.ts        ← All component types (pure data structs)
│   └── systems/
│       ├── droneSystem.ts  ← Processes drone task queues
│       ├── craftingSystem.ts ← Runs station recipes
│       └── orbitSystem.ts  ← Orbital mechanics + resource aggregation
│
├── data/
│   ├── items.ts            ← Item definitions (add items here)
│   ├── recipes.ts          ← Crafting recipes (add recipes here)
│   └── technologies.ts     ← Tech tree (add techs here)
│
├── entities/
│   ├── miningDrone/        ← definition.ts + behavior.ts (spawn fn)
│   ├── cargoDrone/
│   └── station/
│
├── tasks/
│   ├── taskTypes.ts        ← Task descriptor interfaces + factory fns
│   └── taskHandlers.ts     ← One handler per task type; register new ones here
│
├── generation/
│   └── universeGenerator.ts ← Seeded procedural star systems
│
├── rendering/
│   └── renderer.ts         ← Canvas 2D; shape-based; camera + zoom
│
├── ui/
│   └── uiManager.ts        ← HTML panel updater (resources/drones/stations/tech)
│
└── main.ts                 ← Boot
```

---

## How to Add New Content

### New Item
Open `src/data/items.ts` and add an entry to `ITEMS`. Done.

### New Recipe
Open `src/data/recipes.ts` and add an entry to `RECIPES`. Done.

### New Technology
Open `src/data/technologies.ts`. Add a `TechDefinition` with prerequisites and effects. Done.

### New Drone Type
```
src/entities/myDrone/
    definition.ts   ← stats, build cost
    behavior.ts     ← spawnMyDrone(world, ...) factory
```
No engine changes required.

### New Task Type
1. Add descriptor interface to `src/tasks/taskTypes.ts`
2. Implement handler in `src/tasks/taskHandlers.ts` and call `registerTaskHandler()`
3. Done — drones can now be assigned this task.

### New System
Implement `System` interface and register with the scheduler in `Game.ts`:
```ts
scheduler.addSimSystem(myNewSystem)
```

---

## ECS Quick Reference

```ts
// Create an entity
const id = world.createEntity()

// Attach data
world.addComponent(id, mkPosition(x, y, systemId))

// Read data
const pos = world.getComponent<PositionComponent>(id, 'position')

// Query all entities with specific components
const miners = world.query('drone', 'mining', 'position')

// Tags (lightweight labels, no data)
world.addTag(id, 'miningDrone')
world.queryWithTag('miningDrone', 'drone')
```

---

## Simulation Architecture

- **Render loop**: runs at ~60 FPS via `requestAnimationFrame`
- **Simulation loop**: fixed-timestep at 8 Hz (configurable); handles drones, crafting, orbits
- Simulation uses an **accumulator** to decouple render rate from sim rate
- Each sim tick: `orbitSystem` → `droneSystem` → `craftingSystem` → `resourceSystem`

---

## Procedural Generation

```ts
// Generate a universe cluster
const universe = generateUniverse(count, spreadRadius, masterSeed)

// Or a single system
const system = generateStarSystem(seed, id, x, y)
```

Each system is fully deterministic from its seed. Bodies have typed deposits that drive mining targets.

---

## Development Setup

```bash
npm install
npm run dev
```

Open `http://localhost:5173`

```bash
npm run build     # production build → dist/
npm run typecheck # type-check without emitting
```

---

## GitHub Pages Deployment

1. Push your repo to GitHub with a `main` branch
2. Go to **Settings → Pages → Source → GitHub Actions**
3. The workflow at `.github/workflows/deploy.yml` handles build and deploy automatically on every push to `main`

Your game will be live at `https://<username>.github.io/<repo-name>/`

---

## Controls

| Input | Action |
|-------|--------|
| Scroll | Zoom in/out |
| Click + Drag | Pan camera |
| UI Tabs | Switch between Resources / Drones / Stations / Tech |

---

## Roadmap Ideas

- [ ] Click-to-assign drone tasks from canvas
- [ ] Interstellar travel + star map view
- [ ] Save/load via localStorage or IndexedDB
- [ ] More drone types (scout, constructor, repair)
- [ ] Resource pipelines / logistics automation
- [ ] Planet surface regions with tile maps
- [ ] Research queue + auto-research
- [ ] Achievements / milestones system
