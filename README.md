# 🗡️ Dungeon Explorer — The Goblin Slayers
> Final project for the **Interactive Graphics** course, Sapienza University of Rome

***

## 🎮 Play the Game

**[▶ Click here to play](https://sapienzainteractivegraphicscourse.github.io/final-project-thegoblinslayers/)**

> ⏳ The game may take a while to load, assets are heavy and patience is the virtue of the strong. Hang tight, it's worth it.

***

### Game Description

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

#### 📁 `js/core/` — Engine Core

Initialises the Three.js scene, renderer, camera and the shared `gameState` object.
Every other module reads or writes `gameState` to communicate.

| File | Role |
|---|---|
| `main.js` | Entry point. Orchestrates `init()` and the main `animate()` render loop. Handles the home/win screen and loading sequence. |
| `state.js` | Defines the global `gameState` singleton — the single shared object that all modules use to read and write runtime data. |
| `renderer.js` | Creates the `WebGLRenderer` with shadow maps and pixel ratio settings. |
| `camera.js` | Creates the `PerspectiveCamera`, attaches the `AudioListener` and links it to the player rig. |
| `config.js` | Central constants: FOV, movement speed, gravity, interaction range, fog parameters, and other tunable values. |

***

#### 📁 `js/player/` — Player Controller

Everything related to how the player moves, looks around and interacts with the physical world.

| File | Role |
|---|---|
| `player.js` | First-person movement: applies gravity, handles WASD translation, footstep audio trigger, and integrates with the collision system each frame. |
| `input.js` | Captures keyboard and mouse events (Pointer Lock). Exposes the `keys` map and the `resetMovementInput()` utility used on death/respawn. |
| `collision.js` | Maintains the list of static obstacle `Box3` AABBs. Exposes `registerObstacle()` (called by doors, walls, etc.) and `resolveCollision()` (called by `player.js` every frame). |

***

#### 📁 `js/systems/` — Game Logic & Area Systems

Each file manages the logic for a specific area of the dungeon.
Systems own their interactive objects (levers, doors, traps) and are updated each frame from `main.js`.

| File | Role |
|---|---|
| `corridorOneSystem.js` | Manages **Corridor 1**: lever → ball trigger chain. When the player pulls the lever the pendulum ball starts rolling; the door opens simultaneously. |
| `corridorTwoSystem.js` | Manages **Corridor 2**: lever opens the door to Room 2 and fires the rolling boulder trap. Checks player–ball collision every frame and calls `killPlayer()` on hit. |
| `roomOneSystem.js` | Manages **Room 1**: torch-lighting puzzle. Tracks which wall torches have been lit by the player and unlocks the corridor door when the condition is satisfied. |
| `roomTwoSystem.js` | Manages **Room 2**: pressure-plate trigger. Stepping on the plate closes the entrance door and activates the mob encounter. The exit door opens after the mob is defeated. |
| `deathSystem.js` | Centralised death/respawn logic: `initDeathSystem()`, `killPlayer()`, `updateDeathSystem()`, `updatePendulumHazards()`. Resets all area systems on respawn. |
| `interactionSystem.js` | Raycasts from the camera each frame to detect interactable meshes within range. Shows the interaction prompt and fires the object's callback on `E` press. |
| `highlight.js` | Outlines the mesh currently targeted by the interaction raycast using a second emissive pass. |
| `audioManager.js` | Singleton Web Audio API wrapper. Manages one-shot sounds (`playSound`), looping sounds (`startLoopingSound / stopLoopingSound`), proximity volume (`setLoopVolume`), and the player damage audio bookmark system. |
| `audioSetup.js` | Preloads all game audio assets at startup by calling `preloadSound()` for each file path. |
| `wakeUpSequence.js` | Plays the scripted cinematic intro when the game starts: camera animation, text overlays and ambient fade-in before player control is handed over. |
| `debugPosition.js` | Development utility. Press `H` to log the player's world position and key object positions to the console. |

***

#### 📁 `js/ui/` — User Interface

All 2D overlays rendered on top of the WebGL canvas.

| File | Role |
|---|---|
| `inventory.js` | Full inventory system (opened with `I`): 4 slots (Primary weapon, Utility, Backpack × 2), drag-and-drop between slots, first-person viewmodel equip/unequip logic. |
| `hud.js` | Heads-up display: crosshair, interaction text prompt, HP and shield bars update functions. |
| `deathOverlay.js` | Shows/hides the "You Died" screen with a red flash effect. Exposes `setDeathFlash()`, `showDeathOverlay()`, `hideDeathOverlay()`. |
| `errorOverlay.js` | Displays a non-blocking error banner when an asset fails to load, without crashing the game. |
| `screenEffects.js` | Applies fullscreen CSS effects (e.g. vignette, damage red flash) driven by `gameState.damageFlash`. |
| `ui.js` | General UI utilities: loading screen progress, win screen display, pointer-lock overlay management. |

***

#### 📁 `js/world/` — 3D Objects & Interactive Elements

Each file is a **self-contained factory** that builds a Three.js object, registers its colliders and exposes an `update(deltaTime)` method when needed.

##### Environment

| File | Role |
|---|---|
| `dungeon.js` | Top-level dungeon assembler: calls `dungeonGeometry` and `dungeonProps`, loads PBR textures (albedo, normal, roughness) and sets up ambient/point lights. |
| `dungeonGeometry.js` | Procedurally builds all walls, floors, ceilings and archways of the dungeon using `BoxGeometry` and `PlaneGeometry` meshes with PBR materials. |
| `dungeonProps.js` | Places decorative static props across the dungeon (chains, skulls, wall details) that have no gameplay logic. |

##### Interactive Props

| File | Role |
|---|---|
| `door.js` | Animated door: `open()` / `close()` / `reset()` with smooth rotation lerp. Registers its two panel colliders via `registerObstacle`. |
| `lever.js` | Interactable wall lever: toggles `isActivated` on `E` press, plays an animation and a click sound. |
| `barrel.js` | Destructible barrel: plays a break animation and sound when hit, awards a pickup item. |
| `torch.js` | Wall torch with a `PointLight` and particle flame. Supports `setTorchLitState()` for puzzle-driven ignition, portable first-person viewmodel mode, and proximity audio loop. |
| `chandelier.js` | Ceiling chandelier with multiple `PointLight` sources; purely decorative. |
| `gargoyle_statue.js` | Loads the gargoyle GLTF model, positions it and registers its AABB collider. |
| `pendulum.js` | Swinging pendulum axe trap: sinusoidal rotation animation, `freeze()` / `unfreeze()` on death/respawn, `checkPlayerHit()` sphere test. |
| `ball.js` | Rolling boulder trap: triggered by `triggerRoll()`, accelerates along the Z axis, `checkPlayerHit()` sphere test, `reset()` on respawn. |
| `spikes.js` | Floor spike trap: periodic rise/fall animation, player overlap detection. |
| `paper.js` | Readable note prop: shows an in-world parchment texture with a readable text overlay on interaction. |

##### Player Equipment

| File | Role |
|---|---|
| `axe.js` | Battle axe weapon: first-person viewmodel with idle bob, swing attack animation, hit detection against the mob, and pickup logic from world. |
| `sword.js` | Sword weapon: same architecture as `axe.js` with its own swing animation curve and damage values. |
| `shield.js` | Shield equipment: first-person viewmodel on the left hand, block state driven by right-click, HP tracking (3 hits before breaking), visual crack feedback. |

##### Enemy

| File | Role |
|---|---|
| `mob.js` | The dungeon guardian enemy: procedural humanoid mesh built from `BoxGeometry` parts, state machine (IDLE → CHASE → ATTACK → DEAD), pathfinding toward the player, attack hit detection, HP bar update, death animation. |
| `mobConfig.js` | Tunable constants for the mob: HP, speed, attack range, attack damage, aggro radius, animation timings. |

#### Gameplay

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

