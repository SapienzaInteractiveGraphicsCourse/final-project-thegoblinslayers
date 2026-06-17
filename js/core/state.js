// Global Game Data Agreement.
// Each module imports { gameState } from here — no other global state exists outside of this file.
import * as THREE from 'three';

export const gameState = {
  scene:    null,
  camera:   null,
  renderer: null,
  clock:    null,
  noclip:   false,  // for debug: walk through walls and disable collisions

  player: null,

  // ── Stamina sprint ──────────────────────────────────────────────────────────
  stamina:           1.0,
  isSprinting:       false,
  staminaExhausted:  false,

  // ── Camera ──────────────────────────────────────────────────────────────────
  yaw:   0,
  pitch: 0,

  // ── scene obj / room logic ────────────────────────────────────────
  isLeverActivated: false,
  currentInteractable: null,

  leverModel:        null,
  leverBaseMesh:     null,
  leverHandleMesh:   null,
  leverHandlePivot:  null,

  doorGroup:        null,
  leftDoorPivot:    null,
  rightDoorPivot:   null,
  leftDoorLeaf:     null,
  rightDoorLeaf:    null,

  // ── UI ──────────────────────────────────────────────────────────────────────
  uiElement:               null,
  interactionTextElement:  null,
  

  // ── death and respawn ─────────────────────────────────────────────────────────
  inputLockedByDeath: false,
  footstepSound: null,

  // ── Collision and Interactions ─────────────────────────────────────────────────
  obstacleObjects:    [],
  interactableMeshes: [],

  
    // ── Materials (loaded once and reused) ───────────────────────────────
  floorAlbedoBase:       null,
  floorDisplacementBase: null,

  // ── Input ───────────────────────────────────────────────────────────────────
  keys: {
    KeyW:        false,
    KeyA:        false,
    KeyS:        false,
    KeyD:        false,
    ShiftLeft:   false,
    ShiftRight:  false,
  },

  // ── Motion vectors (reused every frame to avoid GC) ────────────
  moveDirection:    new THREE.Vector3(),
  forward:          new THREE.Vector3(),
  right:            new THREE.Vector3(),
  tempPosition:     new THREE.Vector3(),
  cameraDirection:  new THREE.Vector3(),
  worldUp:          new THREE.Vector3(0, 1, 0),

  // ── Raycaster ───────────────────────────────────────────────────────────────
  interactRaycaster:  new THREE.Raycaster(),
  attackRaycaster:    new THREE.Raycaster(),
  tempObstacleBox:    new THREE.Box3(),

  // ── AXE ───────────────────────────────────────────────────────────────────
  hasAxe:           false,
  isAxeEquipped:    false,
  isAxeSwinging:    false,
  axeSwingElapsed:  0,
  axeSwingDuration: 1.2,   // total ax swing animation duration (seconds)
  axeHitApplied:    false,
  axeHitDistance:   2.1,
  axeHitCount:      0,      // hits given with the ax on the current barrel (max 3)

  axePickup:        null,
  barrel:           null,
  barrels:          [],
  viewAxeHolder:    null,
  viewAxeRoot:      null,
  axeIdlePosition:  new THREE.Vector3(),
  axeIdleRotation:  new THREE.Euler(),
  axeSwingSoundPlayed: false,

  // ── SWORD ───────────────────────────────────────────────────────────────────
  hasSword:             false,
  isSwordEquipped:      false,
  isSwordSwinging:      false,
  swordSwingElapsed:    0,
  swordSwingDuration:   0.28,  // faster ax animation (0.48s -> 0.28s)
  swordHitApplied:      false,
  swordHitDistance:     2.1,   // same range as the axe
  swordHitCount:        0,     // sword hits on the current barrel (max 5)

  swordPickup:          null,
  viewSwordHolder:      null,
  viewSwordRoot:        null,
  swordIdlePosition:    new THREE.Vector3(),
  swordIdleRotation:    new THREE.Euler(),

  // ── TORCH ──────────────────────────────────────────────────────────────────
  hasTorch:         false,
  isTorchEquipped:  false,

  roomOnePickupTorch: null,
  heldTorch:          null,
  viewTorchHolder:    null,

  // ── SWORD ───────────────────────────────────────────────────────────────────
  hasShield:         false,
  isShieldEquipped:  false,
  isBlocking:        false,
  viewShieldHolder:  null,
  shieldHP:          3,     // hits that the shield can absorb before breaking
  shieldBroken:      false, // one-shot flag to avoid double triggers

// ── INVENTORY ─────────────────────────────── ─────────────────────────────── 
// primary -> weapon in right hand (axe or sword) 
// secondary -> utility in left hand (torch, shield) 
// bag1/bag2 -> backpack (two slots, accept any type)
  inventory: {
    primary:   null,
    secondary: null,
    bag1:      null,   // first backpack slot
    bag2:      null,   // second backpack slot
  },
  isInventoryOpen: false,
  hasWon: false,
};