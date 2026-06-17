// js/core/camera.js
import * as THREE from 'three';
import { EYE_HEIGHT, PLAYER_HEIGHT } from './config.js';

export function createCamera(state) {
  state.camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.03,
    1000
  );
  return state.camera;
}

export function updateCameraTransform(state) {
  if (!state.camera) return;

// During the wake-up sequence the player does not yet exist:
// the camera stands at the spawn point and uses pitch/yaw from the state
  if (!state.player) {
    // Fixed position at spawn (same used by createPlayer)
    state.camera.position.set(
      state.spawnPosition?.x ?? 0,
      (state.spawnPosition?.y ?? 0) + (EYE_HEIGHT - PLAYER_HEIGHT * 0.5),
      state.spawnPosition?.z ?? 0
    );
    state.camera.rotation.order = 'YXZ';
    state.camera.rotation.y = state.yaw   ?? 0;
    state.camera.rotation.x = state.pitch ?? 0;
    return;
  }

  // Normal post-wake-up behavior
  state.camera.position.set(
    state.player.position.x,
    state.player.position.y + (EYE_HEIGHT - PLAYER_HEIGHT * 0.5),
    state.player.position.z
  );
  state.camera.rotation.order = 'YXZ';
  state.camera.rotation.y = state.yaw;
  state.camera.rotation.x = state.pitch;
}

export function onWindowResize(state) {
  if (!state.camera || !state.renderer) return;
  state.camera.aspect = window.innerWidth / window.innerHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(window.innerWidth, window.innerHeight);
}