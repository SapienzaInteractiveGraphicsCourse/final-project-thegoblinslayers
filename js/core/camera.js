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

  // Durante la wake-up sequence il player non esiste ancora:
  // la camera staziona allo spawn point e usa pitch/yaw dallo state
  if (!state.player) {
    // Posizione fissa allo spawn (stessa usata da createPlayer)
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

  // Comportamento normale post-wake-up
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