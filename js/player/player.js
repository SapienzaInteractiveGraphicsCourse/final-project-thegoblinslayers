import * as THREE from 'three';
import {
  PLAYER_HEIGHT,
  PLAYER_SPEED,
  SPRINT_MULTIPLIER,
  STAMINA_DRAIN_RATE,
  STAMINA_REGEN_RATE
} from '../core/config.js';
import { collidesAt } from './collision.js';
import { updateStaminaBar } from '../ui/ui.js';
import { startLoopingSound, stopLoopingSound, setLoopPlaybackRate } from '../systems/audioManager.js';

export function createPlayer(state) {
  state.player = new THREE.Object3D();
  state.player.position.set(0, PLAYER_HEIGHT * 0.5, 8);
  state.scene.add(state.player);
  return state.player;
}

export function updatePlayer(state, deltaTime) {

  // Freeze the player while reading
  if (state.isReading) return;

  // ── Stamina logic ──────────────────────────────────────────────────────────
  const shiftHeld = state.keys['ShiftLeft'] || state.keys['ShiftRight'];
  const isMoving  = state.keys.KeyW || state.keys.KeyS || state.keys.KeyA || state.keys.KeyD;

  if (shiftHeld && isMoving && !state.staminaExhausted && state.stamina > 0) {
    // Active Sprint: Drains stamina
    state.isSprinting = true;
    state.stamina = Math.max(0, state.stamina - STAMINA_DRAIN_RATE * deltaTime);

    if (state.stamina === 0) {
      state.staminaExhausted = true; // freeze sprint until it fully reloads
      state.isSprinting = false;
    }
  } else {
    // No sprinting: recharges stamina
    state.isSprinting = false;
    state.stamina = Math.min(1, state.stamina + STAMINA_REGEN_RATE * deltaTime);

    // Unlock sprints only when stamina is 100% full
    if (state.staminaExhausted && state.stamina >= 1.0) {
      state.staminaExhausted = false;
    }
  }

  // Bar visible only if stamina is not full (sprint in progress or regen)
  const showBar = state.stamina < 1.0;
  updateStaminaBar(state.stamina, showBar);

  // ── Movement ──────────────────────────────────────────────────────────────
  state.moveDirection.set(0, 0, 0);

  if (state.keys.KeyW) state.moveDirection.z += 1;
  if (state.keys.KeyS) state.moveDirection.z -= 1;
  if (state.keys.KeyA) state.moveDirection.x -= 1;
  if (state.keys.KeyD) state.moveDirection.x += 1;

 if (state.moveDirection.lengthSq() === 0) {
  stopLoopingSound('footsteps'); // stopped -> stop audio
  return;                        
}

state.moveDirection.normalize();

state.forward.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw)).normalize();
state.right.crossVectors(state.forward, state.worldUp).normalize();

state.cameraDirection.set(0, 0, 0);
state.cameraDirection.addScaledVector(state.forward, state.moveDirection.z);
state.cameraDirection.addScaledVector(state.right, state.moveDirection.x);

if (state.cameraDirection.lengthSq() === 0) return;

state.cameraDirection.normalize();

const speed = PLAYER_SPEED * (state.isSprinting ? SPRINT_MULTIPLIER : 1.0);
const moveDistance = speed * deltaTime;

state.tempPosition.copy(state.player.position);
state.tempPosition.x += state.cameraDirection.x * moveDistance;
if (!collidesAt(state, state.tempPosition)) {
  state.player.position.x = state.tempPosition.x;
}

state.tempPosition.copy(state.player.position);
state.tempPosition.z += state.cameraDirection.z * moveDistance;
if (!collidesAt(state, state.tempPosition)) {
  state.player.position.z = state.tempPosition.z;
}

// ── Audio Footstep ───────────────────────────── ─────────────────────────────
// Only gets here if the player is actually moving
const rate = state.isSprinting ? 1.55 : 1.0;
const entry = startLoopingSound('footsteps', { volume: 0.45, playbackRate: rate });
if (entry) setLoopPlaybackRate('footsteps', rate);
// ────────────────────────────────────────────────────────────────────────────
}