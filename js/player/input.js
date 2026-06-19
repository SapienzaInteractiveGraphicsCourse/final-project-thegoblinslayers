import * as THREE from 'three';
import { MOUSE_SENSITIVITY, MAX_PITCH } from '../core/config.js';

export function setupInput(state, onInteract, onPrimaryAction) {
  window.addEventListener('keydown', (event) => {
    if (state.isDead || state.inputLockedByDeath) return;

    if (event.code in state.keys) {
      state.keys[event.code] = true;
    }

    if (event.code === 'KeyE') {
      if (state.isReading) {
        import('../world/paper.js').then(({ stopReading }) => {
          stopReading(state);
        });
        return;
      }

      onInteract?.();
    }

    if (event.code === 'KeyF') {
      import('../ui/inventory.js').then(({ toggleInventory }) => {
        toggleInventory(state);

        if (state.isInventoryOpen) {
          document.exitPointerLock();
        } else {
          if (!state.isDead && !state.inputLockedByDeath) {
            state.renderer?.domElement.requestPointerLock();
          }
        }
      });
    }

    // Noclip from developer: Press k to walk through walls
    if (event.code === 'KeyK') {
      state.noclip = !state.noclip;
      const hud = document.getElementById('noclip-hud');
      if (hud) hud.style.display = state.noclip ? 'block' : 'none';
    }

    if (event.code === 'KeyQ') {
      import('../ui/inventory.js').then(({ swapUtilityWithBag }) => {
        swapUtilityWithBag(state);
      });
    }


  });

  window.addEventListener('keyup', (event) => {
    if (event.code in state.keys) {
      state.keys[event.code] = false;
    }
  });

  window.addEventListener('mousemove', (event) => {
    if (state.isDead || state.inputLockedByDeath) return;
    if (document.pointerLockElement !== state.renderer?.domElement) return;
    if (state.isReading) return;

    state.yaw -= event.movementX * MOUSE_SENSITIVITY;
    state.pitch -= event.movementY * MOUSE_SENSITIVITY;
    state.pitch = THREE.MathUtils.clamp(state.pitch, -MAX_PITCH, MAX_PITCH);
  });

  window.addEventListener('mousedown', (event) => {
    if (state.isDead || state.inputLockedByDeath) return;
    if (document.pointerLockElement !== state.renderer?.domElement) return;
    if (state.isReading) return;

    if (event.button === 0) {
      onPrimaryAction?.();
    }

    if (event.button === 2) {
      if (state.isShieldEquipped) state.isBlocking = true;
    }
  });

  window.addEventListener('mouseup', (event) => {
    if (event.button === 2) {
      state.isBlocking = false;
    }
  });

  window.addEventListener('wheel', (event) => {
    if (state.isDead || state.inputLockedByDeath) return;
    if (document.pointerLockElement !== state.renderer?.domElement) return;
    if (state.isReading) return;

    event.preventDefault();

    const isCtrl = event.ctrlKey || event.metaKey;

    if (isCtrl) {
      // CTRL + scroll → swap utility (secondary ↔ bag)
      import('../ui/inventory.js').then(({ swapUtilityWithBag }) => {
        swapUtilityWithBag(state);
      });
    } else {
      // scroll normale → swap weapon (primary ↔ bag)
      import('../ui/inventory.js').then(({ swapWeaponWithBag }) => {
        swapWeaponWithBag(state);
      });
    }
  }, { passive: false });

  window.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function setupPointerLock(state) {
  if (!state.renderer?.domElement) return;

  state.renderer.domElement.addEventListener('click', () => {
    if (state.isDead || state.inputLockedByDeath) return;
    state.renderer.domElement.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === state.renderer?.domElement) {
      if (state.isInventoryOpen) {
        import('../ui/inventory.js').then(({ closeInventory }) => {
          closeInventory(state);
        });
      }
    }
  });
}

export function resetMovementInput(state) {
  if (!state.keys) return;

  state.keys.KeyW = false;
  state.keys.KeyA = false;
  state.keys.KeyS = false;
  state.keys.KeyD = false;

  state.keys.ArrowUp = false;
  state.keys.ArrowDown = false;
  state.keys.ArrowLeft = false;
  state.keys.ArrowRight = false;

  state.keys.ShiftLeft = false;
  state.keys.ShiftRight = false;
  state.keys.Space = false;
}