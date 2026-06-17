# 🗡️ Dungeon Explorer — The Goblin Slayers
> Final project for the **Interactive Graphics** course, Sapienza University of Rome

***

## 🎮 Play the Game

**[▶ Click here to play](https://sapienzainteractivegraphicscourse.github.io/final-project-thegoblinslayers/)**

> ⏳ The game may take a while to load, assets are heavy and patience is the virtue of the strong. Hang tight, it's worth it.

***

### Game Description

**[▶ Click here to read the presentation](https://github.com/SapienzaInteractiveGraphicsCourse/final-project-thegoblinslayers/blob/main/project_presentation.pdf)**

**Dungeon Explorer** is a first-person action-adventure game set in a medieval dungeon. The player must explore interconnected rooms,
solve environmental puzzles by interacting with the surrounding world (pulling levers, lighting torches, and destroying obstacles) and defeat a guardian enemy to reach the exit



### 🗂️ Project Structure

The codebase is organized into **5 modules**, each with a clear and distinct responsibility.

```
js/
├── core/           # Engine bootstrap and global state
├── player/         # Player controller, input and collision
├── systems/        # Game logic per area / room
├── ui/             # HUD, inventory and overlays
└── world/          # 3D objects, props and interactive elements
```

***

### Gameplay

Each room requires completing a specific interaction to unlock the passage to the next:

- **Room 1** — Pick up the axe, destroy the barrel, pull the lever, light the unlit wall torch
- **Corridor** — Dodge the swinging pendulum traps in the first section; avoid the rolling boulder in the second
- **Room 2** — Step on the pressure plate (which locks the entrance door), defeat the ogre to open the exit

### Controls

| Key / Input | Action |
|------------|--------|
| `W A S D` | Move |
| `Shift` | Sprint |
| Mouse | Look around |
| `E` | Interact / Pick up item |
| `Left click` | Attack (only with axe or sword equipped) |
| `Right click` (hold) | Block with shield (only with shield equipped) |
| `F` | Open / Close inventory |
| Mouse (in inventory) | Drag items between slots |

### Technical Features

#### Hierarchical Models
- **Corridor pendulums** — `root` (ceiling anchor) → `pendulumGroup` (chain + blade) hierarchy; sinusoidal animation implemented in JavaScript rotates only the parent node, propagating to all children
- **Double door** — `door.group` → `leftPivot` / `rightPivot` → door leaves; the opening animation rotates only the pivot nodes, the leaves follow through transform inheritance
- **Procedural barrel** — `root` → `barrelCore` + `staveGroup` + `middleRingGroup` + rings + rivets; progressive destruction acts on specific hierarchical layers (`staveGroup.visible`, `middleRingGroup.visible`)

#### Lights and Textures
- **Full PBR textures** on floors, walls, and ceilings: albedo, normal map, roughness map; 
  displacement map on floors only (96×96 vertex subdivision)
- **PointLights** on all wall torches and chandelier with multi-frequency flicker 
- **SpotLight** on the held torch (hand-carried pickup), providing a directional warm cone of light

#### User Interaction
- **Raycast** interaction system (key `E`) for picking up objects and activating mechanisms
- **Torch system**: proximity-based ignition from ignition sources (lit wall torch → portable torch and vice versa)
- **AABB collision detection** with walls for player movement
- **Combat system**: axe/sword hitbox via raycast, timed damage windows, shield block system
- **Inventory** with typed slots and drag-and-drop between slots
- **Pressure plate trigger** that locks the Room 2 entrance door on contact
- **Respawn system** after player death

#### Animations (all implemented in JavaScript)
- **Axe swing** animation (eased rotation on root node)
- **Sword swing** animation (eased rotation on root node)
- **Torch flame** animation (scaling + sinusoidal rotation + ember particles)
- **Torch lighting** animation (`_litProgress` with ease-out curve `Math.pow(p, 0.55)`, clamped deltaTime)
- **Pendulum** animation (sinusoidal oscillation using `Math.sin(t)` and deltaTime)
- **Rolling boulder** animation (translation + self-axis rotation)
- **Door opening** animation (gradual pivot rotation using `moveTowards`)
- **Lever** animation (rotation on pivot node)
- **Barrel destruction** animation (progressive layer-based deformation over hit stages)
- **Mob death and dissolve** animation (opacity fade on `transparent` materials)

*⚠️Locomotion and attack animations of the ogre (mob) are imported from GLTF/FBX files*

#### Procedurally Generated Objects
- **Dungeon** (rooms, corridors, geometry) — `THREE.BoxGeometry` / `PlaneGeometry`
- **Barrel** — cylinder + staves + rings + rivets, entirely built with `THREE.CylinderGeometry` / `BoxGeometry` / `TorusGeometry`
- **Pendulums** — ceiling anchor + chain links + blade using `THREE.ExtrudeGeometry`
- **Boulder** — `THREE.SphereGeometry`

### Libraries Used
- [Three.js](https://threejs.org/) — WebGL rendering, scene management, materials, lights, animations
- [GLTFLoader](https://threejs.org/docs/#examples/en/loaders/GLTFLoader) — 3D model loading (ogre, door, torches, ecc...)
- Web Audio API — ambient and gameplay audio system

### 👥 Authors

| Name | Student ID | Email |
|------|-----------|-------|
| Agostini Antonio | 1995653 | agostini.1995653@studenti.uniroma1.it |
| Istoc Julia Claudia | 2058878 | istoc.2058878@studenti.uniroma1.it |

### 📄 Asset Licenses

The source code is released under the [MIT License](LICENSE).  
Third-party assets (3D models, textures, audio) and their respective licenses are listed in [CREDITS.md](CREDITS.md).

***

