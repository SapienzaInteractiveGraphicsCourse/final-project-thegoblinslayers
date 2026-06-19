// roomTwoSystem.js
import * as THREE from 'three';
import { createDoor }          from '../world/door.js';
import { setTorchLitState }    from '../world/torch.js';
import { createMob, showMobHealthBar, showPlayerHealthBar, updateMobHealthBar, updatePlayerHealthBar } from '../world/mob.js';
import { registerObstacle } from '../player/collision.js';
import { startLoopingSound } from '../systems/audioManager.js';

// Costanti pedana
const PLATE_WIDTH    = 1.6;
const PLATE_DEPTH    = 1.6;
const PLATE_HEIGHT   = 0.08;
const PLATE_Y_REST   = -0.05;
const PLATE_Y_PRESS  = -0.05;
const PLATE_LERP     = 8.0;

const _playerWorld = new THREE.Vector3();
const _plateBox    = new THREE.Box3();

function lightRoomTwoTorches(state) {
  if (state.roomTwoTorchesLitByPlate) return;
  if (!state.roomTwoPuzzleTorches || state.roomTwoPuzzleTorches.length === 0) {
    console.warn('[RoomTwo] Nessuna torcia stanza 2 trovata.');
    return;
  }

  state.roomTwoTorchesLitByPlate = true;

  // instant = true: nessun fade-in, già accese
  state.roomTwoPuzzleTorches.forEach((torch) => {
    setTorchLitState(torch, true, true);
  });
}

export async function createRoomTwoSystem(state, { showErrorOverlay }) {
  // ── Pedana a pressione ──────────────────────────────────────────────────
  const plateGeo  = new THREE.BoxGeometry(PLATE_WIDTH, PLATE_HEIGHT, PLATE_DEPTH);
  const plateMat  = new THREE.MeshBasicMaterial({ visible: false });
  const plateMesh = new THREE.Mesh(plateGeo, plateMat);

  plateMesh.position.set(15, PLATE_Y_REST, -25);
  plateMesh.name = 'pressure-plate-room2';
  state.scene.add(plateMesh);

  // ── Porta di uscita ─────────────────────────────────────────────────────
  const exitDoor = createDoor({
    scene:            state.scene,
    registerObstacle: (object) => registerObstacle(state, object),
    position:         new THREE.Vector3(31, 0, -25),
    rotation:         new THREE.Euler(0, Math.PI / 2, 0),
    showErrorOverlay
  });

  if (!state.mob) {
    createMob(state, new THREE.Vector3(28, 0, -25));
    console.log('[RoomTwo] Mob creato e istanziato nella stanza 2.');
  }

  const roomTwo = {
    plateMesh,
    exitDoor,
    _platePressed: false,

    update(deltaTime) {
      this.exitDoor?.update(deltaTime);
      this._updatePressurePlate(deltaTime);

      const mobIsDeadOrGone = !state.mob || (state.mob && state.mob.hp <= 0);

      if (state.roomTwoMobSpawned && mobIsDeadOrGone && !this._doorOpenedByMob) {
        this._doorOpenedByMob = true;
        setTimeout(() => {
          if (this.exitDoor) {
            console.log('[RoomTwo] Mob sconfitto — apertura porta di uscita.');
            this.exitDoor.open();
          }
        }, 4000);
      }
    },

    _updatePressurePlate(deltaTime) {
      const entranceDoor = state.corridorTwo?.door;
      if (!entranceDoor || !this.plateMesh) return;

      const px = this.plateMesh.position.x;
      const pz = this.plateMesh.position.z;

      _plateBox.min.set(px - PLATE_WIDTH * 0.5,  0,   pz - PLATE_DEPTH * 0.5);
      _plateBox.max.set(px + PLATE_WIDTH * 0.5,  2.2, pz + PLATE_DEPTH * 0.5);

      state.camera.getWorldPosition(_playerWorld);
      const playerOnPlate = _plateBox.containsPoint(_playerWorld);

      // Animazione pedana (visiva)
      const targetY = playerOnPlate ? PLATE_Y_PRESS : PLATE_Y_REST;
      this.plateMesh.position.y = THREE.MathUtils.lerp(
        this.plateMesh.position.y,
        targetY,
        Math.min(1, PLATE_LERP * deltaTime)
      );

      // Trigger pedana — solo porta + mob, torce non più qui
      const doorIsOpen = entranceDoor.isOpen === true;

      if (playerOnPlate && doorIsOpen && !this._platePressed) {
        this._platePressed = true;
        entranceDoor.close();

        if (!state.roomTwoMobSpawned) {
          state.roomTwoMobSpawned = true;

          if (state.mob && typeof state.mob.activateFromPlate === 'function') {
            setTimeout(() => {
              state.mob.activateFromPlate();
              showMobHealthBar?.();
              showPlayerHealthBar?.();
              updateMobHealthBar?.(state.mob.hp, 100);
              updatePlayerHealthBar?.(state.playerHP ?? 100, state.playerHPMax ?? 100);
            }, 1000); // ← 1 secondi dopo la chiusura porta
            
            startLoopingSound('host_battle', { volume: 0.8 }); //start host battle sound

          } else {
            console.warn('[RoomTwo] Mob non ancora disponibile.');
          }
        }
      }

      if (!playerOnPlate && this._platePressed) {
        this._platePressed = false;
      }
    }
  };

  // Stato globale
  state.roomTwo               = roomTwo;
  state.roomTwoTorchesLitByPlate = false;
  state.roomTwoMobSpawned     = false;

  // ← Torce già accese subito, indipendentemente dalla pedana
  lightRoomTwoTorches(state);

  return roomTwo;
}