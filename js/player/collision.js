import * as THREE from 'three';
import { PLAYER_HALF_SIZE, PLAYER_HEIGHT } from '../core/config.js';

export function registerObstacle(state, object) {
  state.obstacleObjects.push(object);
}

export function makePlayerBox(position) {
  return new THREE.Box3(
    new THREE.Vector3(
      position.x - PLAYER_HALF_SIZE.x,
      0,
      position.z - PLAYER_HALF_SIZE.z
    ),
    new THREE.Vector3(
      position.x + PLAYER_HALF_SIZE.x,
      PLAYER_HEIGHT,
      position.z + PLAYER_HALF_SIZE.z
    )
  );
}

export function collidesAt(state, position) {
  // --- NOCLIP MODE: no collision, the player goes everywhere ---
  if (state.noclip) return false;

  const playerBox = makePlayerBox(position);

  for (const obstacle of state.obstacleObjects) {
    obstacle.updateMatrixWorld(true);
    state.tempObstacleBox.setFromObject(obstacle);

    if (playerBox.intersectsBox(state.tempObstacleBox)) {
      return true;
    }
  }

  return false;
}