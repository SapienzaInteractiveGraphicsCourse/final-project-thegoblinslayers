// roomTwoSystem.js
import * as THREE from 'three';
import { createDoor }          from '../world/door.js';
import { setTorchLitState }    from '../world/torch.js';
import { createMob, showMobHealthBar, showPlayerHealthBar, updateMobHealthBar, updatePlayerHealthBar } from '../world/mob.js';

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
  const STAGGER_MS = 220;

  console.log('[RoomTwo] Accensione torce stanza 2');
  state.roomTwoPuzzleTorches.forEach((torch, index) => {
    setTimeout(() => {
      setTorchLitState(torch, true);
    }, index * STAGGER_MS);
  });
}

export async function createRoomTwoSystem(state, { showErrorOverlay}) {
  // ── Pedana a pressione ────────────────────────────────────────────────────
  const plateGeo = new THREE.BoxGeometry(PLATE_WIDTH, PLATE_HEIGHT, PLATE_DEPTH);
  const plateMat = new THREE.MeshBasicMaterial({ visible: false });
  const plateMesh = new THREE.Mesh(plateGeo, plateMat);
  
  // Posizione originale
  plateMesh.position.set(15, PLATE_Y_REST, -25);
  plateMesh.name = 'pressure-plate-room2';
  state.scene.add(plateMesh);

  // ── Nuova Porta (Uscita Stanza 2) ──────────────────────────────────────────
  // Posizionata "dritto per dritto" lungo l'asse X (es. traslata più avanti a X: 35)
  // Mantiene la stessa Z dell'entrata (-24.979) per essere perfettamente allineata.
  const exitDoor = createDoor({
    scene:            state.scene,
    position:         new THREE.Vector3(31, 0, -25), 
    rotation:         new THREE.Euler(0, Math.PI / 2, 0),
    showErrorOverlay
  });

  if(!state.mob){
    createMob(state, new THREE.Vector3(28, 0, -25));
    console.log('[RoomTwo] Mob creato e istanziato nella stanza 2.');
  }

  const roomTwo = {
    plateMesh,
    exitDoor,
    _platePressed:  false,

    update(deltaTime) {
      // Aggiorna la porta di uscita (gestisce le sue animazioni di apertura/chiusura)
      this.exitDoor?.update(deltaTime);
      
      // Logica della pedana
      this._updatePressurePlate(deltaTime);

      const mobIsDeadOrGone = !state.mob || (state.mob&&state.mob.hp<=0);

      if (state.roomTwoMobSpawned && mobIsDeadOrGone && !this._doorOpenedByMob) {
        this._doorOpenedByMob = true; // Blocca i trigger successivi
        setTimeout(()=>{
          if(this.exitDoor){
            console.log('[ROomTwo] Tempo scaduto! Apertura porta di uscita verso la fine');
            this.exitDoor.open();
          }
        }, 4000);
      }
    },

    _updatePressurePlate(deltaTime) {
      // Nota: Per chiudere l'entrata, facciamo riferimento alla porta gestita dal corridoio
      const entranceDoor = state.corridorTwo?.door;
      if (!entranceDoor || !this.plateMesh) return;

      const px = this.plateMesh.position.x;
      const pz = this.plateMesh.position.z;
      
      _plateBox.min.set(px - PLATE_WIDTH * 0.5, 0, pz - PLATE_DEPTH * 0.5);
      _plateBox.max.set(px + PLATE_WIDTH * 0.5, 2.2, pz + PLATE_DEPTH * 0.5);

      state.camera.getWorldPosition(_playerWorld);
      const playerOnPlate = _plateBox.containsPoint(_playerWorld);

      // Animazione pedana
      const targetY = playerOnPlate ? PLATE_Y_PRESS : PLATE_Y_REST;
      this.plateMesh.position.y = THREE.MathUtils.lerp(
        this.plateMesh.position.y,
        targetY,
        Math.min(1, PLATE_LERP * deltaTime)
      );

      // Trigger calpestamento pedana
      const doorIsOpen = entranceDoor.isOpen === true;

      if (playerOnPlate && doorIsOpen && !this._platePressed) {
        this._platePressed = true;
        entranceDoor.close(); // Chiude la porta alle spalle del giocatore

        lightRoomTwoTorches(state);

        // Attivazione Spawns / Mob
        if (!state.roomTwoMobSpawned) {
          state.roomTwoMobSpawned = true;

          if (state.mob && typeof state.mob.activateFromPlate === 'function') {
            state.mob.activateFromPlate();
            showMobHealthBar?.();
            showPlayerHealthBar?.();
            updateMobHealthBar?.(state.mob.hp, 100);
            updatePlayerHealthBar?.(state.playerHP ?? 100, state.playerHPMax ?? 100);
            
            // OPZIONALE: Puoi decidere se aprire la porta di uscita alla morte del mob 
            // o con un altro evento. Per ora la lasciamo chiusa/gestibile.
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

  // Inizializzazione stati nel global state
  state.roomTwo = roomTwo;
  state.roomTwoTorchesLitByPlate = false;
  state.roomTwoMobSpawned = false;

  return roomTwo;
}