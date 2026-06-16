// corridorTwoSystem.js
import * as THREE from 'three';
import { createDoor }          from '../world/door.js';
import { createBall }          from '../world/ball.js';
import { createLever }         from '../world/lever.js';
import { registerObstacle }    from '../player/collision.js';
import { killPlayer }          from '../systems/deathSystem.js';
import { ensureViewTorch, updatePortableTorch } from '../world/torch.js';
import { ensureViewAxe, updateAxe }             from '../world/axe.js';
import { stopLoopingSound }    from './audioManager.js';

const _playerWorld = new THREE.Vector3();

export async function createCorridorTwoSystem(state, { showErrorOverlay }) {
  const corridorTwo = {
    lever:         null,
    door:          null, // Porta d'ingresso Stanza 2
    ball:          null,
    _doorOpened:   false,

    update(deltaTime) {
      updateAxe(state, deltaTime);
      updatePortableTorch(state);

      // Aggiorna leva
      this.lever?.update(deltaTime);

      // Apri porta d'ingresso se la leva è attivata
      if (this.lever?.isActivated && !this._doorOpened) {
        this._doorOpened = true;
        this.door?.open();

        // Preload del mob (mantenuto qui perché si attiva all'apertura della porta del corridoio)
        if (!state.roomTwoMobPreloaded) {
          state.roomTwoMobPreloaded = true;
          console.log('[CorridorTwo] Segnale di preload mob inviato.');
        }
      }

      // Aggiorna e controlla la palla
      this.ball?.update(deltaTime, state.camera.position);

      if (this.ball?.isRolling && !state.isDead) {
        const carrier = state.player || state.playerRig || state.camera;
        if (carrier) {
          carrier.getWorldPosition(_playerWorld);
          if (this.ball.checkPlayerHit(_playerWorld, state.playerHitRadius ?? 0.38)) {
            state._deathCause = 'sphere';
            stopLoopingSound('roll');
            killPlayer(state);
          }
        }
      }

      // Aggiorna porta d'ingresso
      this.door?.update(deltaTime);
    }
  };

  // ── Leva stanza 2 ─────────────────────────────────────────────────────────
  corridorTwo.lever = createLever({
    scene:              state.scene,
    interactableMeshes: state.interactableMeshes,
    position:           new THREE.Vector3(12, 0.9, -26.1),
    rotationY:          Math.PI,
    scale:              0.8,
    showErrorOverlay,
    state
  });

  // ── Porta d'ingresso stanza 2 ─────────────────────────────────────────────
  corridorTwo.door = createDoor({
    scene:            state.scene,
    registerObstacle: (object) => registerObstacle(state, object),
    position:         new THREE.Vector3(13, 0, -25),
    rotation:         new THREE.Euler(0, Math.PI / 2, 0),
    showErrorOverlay
  });

  // ── Palla ─────────────────────────────────────────────────────────────────
  corridorTwo.ball = await createBall({
    scene:            state.scene,
    registerObstacle: (object) => registerObstacle(state, object),
    showErrorOverlay,
    wallTextures: {
      map:          state.wallAlbedoBase,
      normalMap:    state.wallNormalBase,
      roughnessMap: state.wallRoughnessBase
    }
  });

  ensureViewAxe(state);
  ensureViewTorch(state);

  // Registrazione nello stato globale
  state.corridorTwo = corridorTwo;
  state.ball        = corridorTwo.ball;
  state.roomTwoMobPreloaded = false;

  return corridorTwo;
}