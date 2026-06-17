import * as THREE from 'three';
import { setDeathFlash, showDeathOverlay, hideDeathOverlay } from '../ui/deathOverlay.js';
import { playSound, stopLoopingSound } from '../systems/audioManager.js';
import { resetMovementInput } from '../player/input.js';
import { stopFootsteps } from './audioManager.js';

const _playerWorld = new THREE.Vector3();

export function initDeathSystem(state) {
  state.spawnPoint ??= new THREE.Vector3(0, 0, 8);
  state.isDead = false;
  state.inputLockedByDeath = false;
  state.damageFlash = 0;
  state.respawnInvulnerability = 0;

  state.playerHPMax = 100;
  state.playerHP = 100;

  state.playerHitRadius = 0.38;

  state.respawnPlayer = () => {
    state.isDead = false;
    state.inputLockedByDeath = false;
    state.damageFlash = 0;
    state.respawnInvulnerability = 1.0;

    hideDeathOverlay(state);
    setDeathFlash(state, 0);

    resetMovementInput(state);
    stopFootsteps();
    state.isBlocking = false;

    // Reset player HP + hide lifebar
    state.playerHP = state.playerHPMax ?? 100;
    import('../world/mob.js').then(({
      updatePlayerHealthBar,
      hideMobHealthBar,
      updateMobHealthBar,
      hideMobHealthBar: hideBar
    }) => {
      updatePlayerHealthBar(state.playerHP, state.playerHPMax);
    });

    // Hide both lifebars
    const playerBar = document.getElementById('player-hp-bar');
    const mobBar = document.getElementById('mob-hp-bar');
    if (playerBar) playerBar.style.opacity = '0';
    if (mobBar) mobBar.style.opacity = '0';

    // Reset shield
    state.shieldHP = 3;
    state.shieldBroken = false;

    // Reset mob: return to spawn and wait for pressure plate
    if (state.mob) {
      state.mob.reset(new THREE.Vector3(28.762, 0, -24.986));
    }

    // Pressure plate flag: do NOT reset roomTwoTorchesLitByPlate →
    // torches remain lit between respawns.
    // Only reset the mob flag to allow reactivation.
    state.roomTwoMobSpawned = false;
    // DO NOT touch: state.roomTwoTorchesLitByPlate ← stays true after the first run

    // ── Restore interaction text visibility ──────────────────────────────
    if (state.interactionTextElement) {
      state.interactionTextElement.style.opacity = '1';
    }

    // ── Reactivate all pendulums ─────────────────────────────────────────
    if (state.pendulums) {
      for (const p of state.pendulums) p.unfreeze();
    }

    // ── Reset ball and corridor 1 lever ───────────────────────────────────
    if (state.ball) {
      state.ball.reset();
    }

    if (state.corridorOne) {
      state.corridorOne.lever?.reset();
      state.corridorOne._ballTriggered = false;
      // Close corridor 1 door
      //state.corridorOne.door?.close?.();
    }

    if (state.corridorTwo) {
      state.corridorTwo.lever?.reset();
      state.corridorTwo._doorOpened = false;
      state.corridorTwo.door?.reset();
      state.corridorTwo._platePressed = false;
    }

    if (state.player) {
      state.player.position.copy(state.spawnPoint);
    } else if (state.playerRig) {
      state.playerRig.position.copy(state.spawnPoint);
    } else if (state.camera) {
      state.camera.position.copy(state.spawnPoint);
    }

    if (state.playerVelocity?.set) {
      state.playerVelocity.set(0, 0, 0);
    }

    if (state.moveVelocity?.set) {
      state.moveVelocity.set(0, 0, 0);
    }
  };
}

export function killPlayer(state) {
  if (state.isDead) return;

  state.isDead = true;
  state.inputLockedByDeath = true;
  state.isBlocking = false;

  resetMovementInput(state);
  stopFootsteps();

  if (document.pointerLockElement) document.exitPointerLock();

  if (state.interactionTextElement) {
    state.interactionTextElement.style.opacity = '0';
    state.interactionTextElement.textContent = '';
  }

  // ── Freeze all pendulums at their current position ───────────────────
  if (state.pendulums) {
    for (const p of state.pendulums) p.freeze();
  }

  // ── Stop whoosh and play impact sound ─────────────────────────────────
  stopLoopingSound('whoosh');
  playSound('axeTrapHit', { volume: 0.65 });

  showDeathOverlay(state);
}

export function updateDeathSystem(state, deltaTime) {
  if (state.respawnInvulnerability > 0) {
    state.respawnInvulnerability = Math.max(0, state.respawnInvulnerability - deltaTime);
  }

  if (state.isDead) {
    setDeathFlash(state, 0.9);
    return;
  }

  state.damageFlash = Math.max(0, state.damageFlash - deltaTime * 1.75);
  setDeathFlash(state, state.damageFlash);
}

export function updatePendulumHazards(state, deltaTime) {
  if (state.isDead) return;
  if (state.respawnInvulnerability > 0) return;
  if (!state.pendulums || state.pendulums.length === 0) return;

  const playerCarrier = state.player || state.playerRig || state.camera;
  if (!playerCarrier) return;

  playerCarrier.getWorldPosition(_playerWorld);

  for (const pendulum of state.pendulums) {
    if (pendulum.checkPlayerHit(_playerWorld, state.playerHitRadius)) {
      killPlayer(state);
      break;
    }
  }
}