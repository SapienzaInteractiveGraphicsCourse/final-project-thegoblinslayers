// Contratto globale dei dati di gioco.
// Ogni modulo importa { gameState } da qui — nessun altro stato globale esiste fuori da questo file.

import * as THREE from 'three';

export const gameState = {
  scene:    null,
  camera:   null,
  renderer: null,
  clock:    null,
  noclip:   false,  // per debug: attraversa muri e disabilita collisioni

  player: null,

  // ── Stamina sprint ──────────────────────────────────────────────────────────
  stamina:           1.0,
  isSprinting:       false,
  staminaExhausted:  false,

  // ── Camera ──────────────────────────────────────────────────────────────────
  yaw:   0,
  pitch: 0,

  // ── Oggetti di scena / logica stanza ────────────────────────────────────────
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
  

  // ── Morte e respawn ─────────────────────────────────────────────────────────
  inputLockedByDeath: false,
  footstepSound: null,

  // ── Collisioni e interazione ─────────────────────────────────────────────────
  obstacleObjects:    [],
  interactableMeshes: [],

  
    // ── Materiali (caricati una volta e riutilizzati) ───────────────────────────────
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

  // ── Vettori di movimento (riutilizzati ogni frame per evitare GC) ────────────
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

  // ── ASCIA ───────────────────────────────────────────────────────────────────
  hasAxe:           false,
  isAxeEquipped:    false,
  isAxeSwinging:    false,
  axeSwingElapsed:  0,
  axeSwingDuration: 1.2,   // durata totale animazione swing ascia (secondi)
  axeHitApplied:    false,
  axeHitDistance:   2.1,
  axeHitCount:      0,      // colpi dati con l'ascia sul barile corrente (max 3)

  axePickup:        null,
  barrel:           null,
  barrels:          [],
  viewAxeHolder:    null,
  viewAxeRoot:      null,
  axeIdlePosition:  new THREE.Vector3(),
  axeIdleRotation:  new THREE.Euler(),
  axeSwingSoundPlayed: false,

  // ── SPADA ───────────────────────────────────────────────────────────────────
  hasSword:             false,
  isSwordEquipped:      false,
  isSwordSwinging:      false,
  swordSwingElapsed:    0,
  swordSwingDuration:   0.28,  // animazione più veloce dell'ascia (0.48s → 0.28s)
  swordHitApplied:      false,
  swordHitDistance:     2.1,   // stessa portata dell'ascia
  swordHitCount:        0,     // colpi dati con la spada sul barile corrente (max 5)

  swordPickup:          null,
  viewSwordHolder:      null,
  viewSwordRoot:        null,
  swordIdlePosition:    new THREE.Vector3(),
  swordIdleRotation:    new THREE.Euler(),

  // ── TORCIA ──────────────────────────────────────────────────────────────────
  hasTorch:         false,
  isTorchEquipped:  false,

  roomOnePickupTorch: null,
  heldTorch:          null,
  viewTorchHolder:    null,

  // ── SCUDO ───────────────────────────────────────────────────────────────────
  hasShield:         false,
  isShieldEquipped:  false,
  isBlocking:        false,
  viewShieldHolder:  null,
  shieldHP:          3,     // colpi che lo scudo può assorbire prima di rompersi
  shieldBroken:      false, // flag one-shot per evitare doppi trigger

  // ── INVENTARIO ──────────────────────────────────────────────────────────────
  // primary   → arma in mano destra (ascia o spada)
  // secondary → utility in mano sinistra (torcia, scudo)
  // bag1/bag2 → zaino (due slot, accettano qualsiasi tipo)
  inventory: {
    primary:   null,
    secondary: null,
    bag1:      null,   // primo slot zaino
    bag2:      null,   // secondo slot zaino (nuovo)
  },
  isInventoryOpen: false,
  hasWon: false,
};