import * as THREE from 'three';


//PREMENDO H SI LOGGA LA POSIZIONE DEL PLAYER (WORLD) E DI ALTRI OGGETTI UTILI (ES: PALLA, LEVA CORRIDOIO 1, PORTA CORRIDOIO 1)
const _debugWorldPosition = new THREE.Vector3();

export function setupDebugPositionLogger(state) {
  if (state._debugPositionLoggerInstalled) return;
  state._debugPositionLoggerInstalled = true;

  window.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyH') return;

    const playerCarrier = state.player || state.playerRig || state.camera;

    if (!playerCarrier) {
      console.warn('[Debug] Nessun player carrier trovato');
      return;
    }

    playerCarrier.getWorldPosition(_debugWorldPosition);

    console.log(
      `[Debug][H] Player world position -> x: ${_debugWorldPosition.x.toFixed(3)}, y: ${_debugWorldPosition.y.toFixed(3)}, z: ${_debugWorldPosition.z.toFixed(3)}`
    );




  });
}