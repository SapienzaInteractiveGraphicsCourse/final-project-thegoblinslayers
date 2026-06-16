import { createHangingAxe } from '../world/pendulum.js';
import { createLever } from '../world/lever.js';
import * as THREE from 'three';
import { createDoor } from '../world/door.js';
import { registerObstacle } from '../player/collision.js';
import { ensureViewTorch, makeTorchPickupable, updatePortableTorch } from '../world/torch.js';
import { createAxePickup, ensureViewAxe, updateAxe } from '../world/axe.js';

export function createCorridorOneSystem(state, { showErrorOverlay }) {
  const corridorOne = {
    lever: null,
    door: null,
    pendulum: null,
    _ballTriggered: false,

  update(deltaTime) {
    this.lever?.update(deltaTime);
    
    updateAxe(state, deltaTime);
    updatePortableTorch(state);

    const leverReady = this.lever?.isActivated === true;

    state.corridorOneLeverSatisfied = leverReady;
    state.corridorOneDoorReady = leverReady;

    if (state.corridorOneDoorReady) {
      this.door?.open();
    }

    // Quando la leva viene abbassata, avvia il countdown della palla
    // Lo facciamo una sola volta: usiamo un flag _ballTriggered
    if (leverReady && !this._ballTriggered) {
      this._ballTriggered = true;
      state.ball?.triggerRoll();
      console.log('[CorridorOne] Leva attivata → palla avviata');
    }

    this.door?.update(deltaTime);
  }
  };
  

  corridorOne.lever = createLever({
    scene: state.scene,
    interactableMeshes: state.interactableMeshes,
    position: new THREE.Vector3(0, 1.2,-(12+13+1.1)),
    scale: 0.8,
    showErrorOverlay,
    state
  });

  corridorOne.door = createDoor({
    scene: state.scene,
    registerObstacle: (object) => registerObstacle(state, object),
    position: new THREE.Vector3(1.5, 0, -12-13),
    rotation: new THREE.Euler(0, Math.PI / 2, 0),
    showErrorOverlay
  });

  createHangingAxe({
    state,
    registerObstacle: (object)=>registerObstacle(state, object),
    position: new THREE.Vector3(0, 4.3, -18)
  })

  createHangingAxe({
    state,
    registerObstacle: (object)=>registerObstacle(state, object)
  })

  ensureViewAxe(state);
  ensureViewTorch(state);

  state.corridorOne = corridorOne;

  state.lever = corridorOne.lever;
  state.door = corridorOne.door;

  return corridorOne;
}