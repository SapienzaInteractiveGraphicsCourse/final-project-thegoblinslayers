// corridorTwoSystem.js
import * as THREE from 'three';
import { createDoor } from '../world/door.js';
import { createBall } from '../world/ball.js';
import { createLever } from '../world/lever.js';
import { registerObstacle } from '../player/collision.js';
import { killPlayer } from '../systems/deathSystem.js';
import { ensureViewTorch, updatePortableTorch } from '../world/torch.js';
import { ensureViewAxe, updateAxe } from '../world/axe.js';
import { stopLoopingSound } from './audioManager.js';

const _playerWorld = new THREE.Vector3();

export async function createCorridorTwoSystem(state, { showErrorOverlay }) {
  const corridorTwo = {
    lever: null,
    door: null, // Entry door to Room 2
    ball: null,
    _doorOpened: false,

    update(deltaTime) {
      updateAxe(state, deltaTime);
      updatePortableTorch(state);

      // Update lever
      this.lever?.update(deltaTime);

      // Open entry door when lever is activated
      if (this.lever?.isActivated && !this._doorOpened) {
        this._doorOpened = true;
        this.door?.open();

        // Preload the mob (kept here because it triggers when the corridor door opens)
        if (!state.roomTwoMobPreloaded) {
          state.roomTwoMobPreloaded = true;
          console.log('[CorridorTwo] Mob preload signal sent.');
        }
      }

      // Update and check the ball
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

      // Update entry door
      this.door?.update(deltaTime);
    }
  };

  // ── Room 2 lever ─────────────────────────────────────────────────────────
  corridorTwo.lever = createLever({
    scene: state.scene,
    interactableMeshes: state.interactableMeshes,
    position: new THREE.Vector3(12, 0.9, -26.1),
    rotationY: Math.PI,
    scale: 0.8,
    showErrorOverlay,
    state
  });

  // ── Room 2 entry door ─────────────────────────────────────────────────────
  corridorTwo.door = createDoor({
    scene: state.scene,
    registerObstacle: (object) => registerObstacle(state, object),
    position: new THREE.Vector3(13, 0, -25),
    rotation: new THREE.Euler(0, Math.PI / 2, 0),
    showErrorOverlay
  });

  // ── Ball ─────────────────────────────────────────────────────────────────
  corridorTwo.ball = await createBall({
    scene: state.scene,
    registerObstacle: (object) => registerObstacle(state, object),
    showErrorOverlay,
    wallTextures: {
      map: state.wallAlbedoBase,
      normalMap: state.wallNormalBase,
      roughnessMap: state.wallRoughnessBase
    }
  });

  ensureViewAxe(state);
  ensureViewTorch(state);

  // Register in global state
  state.corridorTwo = corridorTwo;
  state.ball = corridorTwo.ball;
  state.roomTwoMobPreloaded = false;

  return corridorTwo;
}