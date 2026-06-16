# 🗡️ Dungeon Explorer — The Goblin Slayers
> Final project for the **Interactive Graphics** course — Sapienza University of Rome

***

## 🎮 Play the Game

**[▶ Click here to play](https://sapienzainteractivegraphicscourse.github.io/final-project-thegoblinslayers/)**

> ⏳ The game may take a while to load — assets are heavy and patience is the virtue of the strong. Hang tight, it's worth it.

***

### Description

**Dungeon Explorer** is a first-person action-adventure game set in a medieval dungeon. The player must explore interconnected rooms, solve environmental puzzles, and defeat an enemy to reach the exit.

### Gameplay

Each room requires completing a specific interaction to unlock the passage to the next:

- **Room 1** — Pick up the axe, destroy the barrel (3 hits), pull the lever, light the unlit wall torch
- **Corridor** — Dodge the swinging pendulum traps in the first section; avoid the rolling boulder in the second
- **Room 2** — Step on the pressure plate (which locks the entrance door), defeat the ogre to open the exit

### Controls

| Key | Action |
|-----|--------|
| `W A S D` | Move |
| Mouse | Look around |
| `E` | Interact / Pick up item |
| `Left click` | Attack (axe) / Block (shield) |
| `1` / `2` | Switch equipped item (axe / torch / shield) |

### Technical Features

#### Hierarchical Models
- **Procedural axe** — cylindrical handle + box blade + box beard, composed as a `THREE.Group` hierarchy; swing animation implemented manually via root node rotation
- **Portable torch** — handle + flame + ember particle system hierarchy, all animated in the render loop
- **Corridor pendulums** — pivot–shaft–head hierarchical model with sinusoidal animation in JavaScript
- **Chandelier** — hierarchy of candles and lights with individual flicker animation

#### Lights and Textures
- **Full PBR textures** on floors, walls, and ceilings: albedo, normal map, roughness map, displacement map
- Dynamic **PointLights** on wall torches with randomized flicker (intensity and color variation per frame)
- Dark **AmbientLight** for dungeon atmosphere
- **SpotLight** on key scene elements

#### User Interaction
- **Raycast** interaction system (key `E`) for picking up objects and activating mechanisms
- **Torch system**: proximity-based ignition from ignition sources (lit wall torch → portable torch and vice versa)
- **AABB collision detection** with walls for player movement
- **Combat system**: axe hitbox via raycast, timed damage windows, shield parry system
- **Pressure plate trigger** that locks the Room 2 entrance door on contact
- **Respawn system** after player death

#### Animations (all implemented in JavaScript)
- **Axe swing** animation (eased rotation on root node)
- **Torch flame** animation (scaling + sinusoidal rotation + ember particles)
- **Torch lighting** animation (`_litProgress` with ease-out curve `Math.pow(p, 0.55)`, clamped deltaTime)
- **Pendulum** animation (sinusoidal oscillation using `Math.sin(t)` and deltaTime)
- **Rolling boulder** animation (translation + self-axis rotation)
- **Door opening** animation (gradual translation with lerp)
- **Lever** animation (rotation on pivot node)
- **Barrel destruction** animation (progressive deformation over 3 hit stages)
- **Mob death and dissolve** animation (opacity fade on `transparent` materials)
- ⚠️ *Locomotion and attack animations of the ogre (mob) are imported from GLTF/FBX files*

#### Procedurally Generated Objects
- **Dungeon** (rooms, corridors, geometry) — `THREE.BoxGeometry` / `PlaneGeometry`
- **Barrel** — procedural cylinder + staves
- **Pendulums** — spheres + cylinders
- **Boulder** — `THREE.SphereGeometry` with displacement

### Libraries Used
- [Three.js](https://threejs.org/) — WebGL rendering, scene management, materials, lights, animations
- [GLTFLoader](https://threejs.org/docs/#examples/en/loaders/GLTFLoader) — ogre model loading
- Web Audio API — ambient and gameplay audio system

***

*Sapienza Università di Roma — Interactive Graphics 2024/25*
