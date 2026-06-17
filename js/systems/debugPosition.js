import * as THREE from 'three';

// PRESSING H LOGS THE PLAYER POSITION (WORLD) AND OTHER USEFUL OBJECTS (e.g. BALL, CORRIDOR 1 LEVER, CORRIDOR 1 DOOR)
const _debugWorldPosition = new THREE.Vector3();

export function setupDebugPositionLogger(state) {
  if (state._debugPositionLoggerInstalled) return;
  state._debugPositionLoggerInstalled = true;

  window.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyH') return;

    const playerCarrier = state.player || state.playerRig || state.camera;

    if (!playerCarrier) {
      console.warn('[Debug] No player carrier found');
      return;
    }

    playerCarrier.getWorldPosition(_debugWorldPosition);

    console.log(
      `[Debug][H] Player world position -> x: ${_debugWorldPosition.x.toFixed(3)}, y: ${_debugWorldPosition.y.toFixed(3)}, z: ${_debugWorldPosition.z.toFixed(3)}`
    );

  });
}