import * as THREE from 'three';
import { createLever } from '../world/lever.js';
import { createDoor } from '../world/door.js';
import { createAxePickup, ensureViewAxe, updateAxe } from '../world/axe.js';
import { createBarrel } from '../world/barrel.js';
import { ensureViewTorch, makeTorchPickupable, updatePortableTorch } from '../world/torch.js';
import { registerObstacle } from '../player/collision.js';
import { createChandelier } from '../world/chandelier.js';
import { preloadShieldModel } from '../world/shield.js';


function areRoomOnePuzzleTorchesLit(state) {
  const torches = state.roomOnePuzzleTorches ?? [];
  return torches.length > 0 && torches.every((torch) => torch?.isLit === true);
}

export function createRoomOneSystem(state, { showErrorOverlay }) {
  const roomOne = {
    axePickup: null,
    barrels: {},
    lever: null,
    door: null,
    pickupTorch: null,

  update(deltaTime) {
    this.lever?.update(deltaTime);
    updateAxe(state, deltaTime);
    updatePortableTorch(state);

    for (const barrel of Object.values(this.barrels)) {
      barrel?.update(deltaTime);
    }

    const leverReady = this.lever?.isActivated === true;
    const torchesReady = areRoomOnePuzzleTorchesLit(state);

    state.roomOneLeverSatisfied = leverReady;
    state.roomOneTorchPuzzleSatisfied = torchesReady;
    state.roomOneDoorReady = leverReady && torchesReady;

    if (state.roomOneDoorReady) {
      this.door?.open();
    }

    this.door?.update(deltaTime);
  }
  };

  roomOne.axePickup = createAxePickup({
    state,
    position: new THREE.Vector3(0.9, 0.16, 0.8)
  });

  roomOne.barrels = {
    blocker: createBarrel({ //dallo spawn questo è il barile in alto a sinistra, quello che blocca la leva
      state,
      registerObstacle: (object) => registerObstacle(state, object),
      position: new THREE.Vector3(-8.2, 0.62, -10.95)
    }),
    optional1: createBarrel({ //dallo spawn questo è il barile in basso a destra
      state,
      registerObstacle: (object) => registerObstacle(state, object),
      position: new THREE.Vector3(10.2, 0.62, 9.8)
    }),
    optional2: createBarrel({  //dallo spawn questo è il barile in basso a sinistra
      state,
      registerObstacle: (object) => registerObstacle(state, object),
      position: new THREE.Vector3(-8.2, 0.62, 9.8)
    }),
    shieldBlocker: createBarrel({
      state,
      registerObstacle: (object) => registerObstacle(state, object),
      position: new THREE.Vector3(7.0, 0.62, -10.9)   // stesso X,Z dello scudo; Y=0.62 è l'altezza barile a terra
    }),
  };

  // Il barile sotto lo scudo blocca il pickup
  if (state.shieldPickup) {
    state.shieldPickup.isBlocked = () => !roomOne.barrels.shieldBlocker.isDestroyed;
  }

  if (state.swordPickup) {
  state.swordPickup.isBlocked = () => !roomOne.barrels.optional1.isDestroyed;
 }

  roomOne.lever = createLever({
    scene: state.scene,
    interactableMeshes: state.interactableMeshes,
    showErrorOverlay,
    state
  });

  roomOne.lever.isBlocked = () => !roomOne.barrels.blocker.isDestroyed;

  roomOne.door = createDoor({
    scene: state.scene,
    registerObstacle: (object) => registerObstacle(state, object),
    showErrorOverlay
  });

  roomOne.pickupTorch = state.roomOnePickupTorch ?? null;

  if (roomOne.pickupTorch) {
    makeTorchPickupable(roomOne.pickupTorch, state);
  }

  if (roomOne.wallTorch) {
  makeTorchPickupable(roomOne.wallTorch, state);
  }

  roomOne.puzzleTorches = state.roomOnePuzzleTorches ?? [];
  state.roomOnePuzzleTorches = roomOne.puzzleTorches;

  ensureViewAxe(state);
  ensureViewTorch(state);

  state.roomOne = roomOne;
  state.axePickup = roomOne.axePickup;

  state.barrel = roomOne.barrels.blocker;
  state.mainBarrel = roomOne.barrels.blocker;
  state.sideBarrel = roomOne.barrels.optional;
  state.barrels = Object.values(roomOne.barrels);

  state.lever = roomOne.lever;
  state.door = roomOne.door;
  state.roomOneFloorTorch = roomOne.pickupTorch;

  return roomOne;
}