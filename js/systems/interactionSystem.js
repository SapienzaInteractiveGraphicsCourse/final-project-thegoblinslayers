import * as THREE from 'three';

let _highlighted = null;
let _fading      = null;

const FADE_IN_SPEED  = 6.0;
const FADE_OUT_SPEED = 4.0;

// ── Vettore pre-allocato — evita new Vector3() ogni frame ────────────────────
const _meshWorldPos = new THREE.Vector3();

export function updateInteraction({
  camera,
  renderer,
  interactableMeshes,
  interactionTextElement,
  interactionDistance,
  state,
  deltaTime = 0.016
}) {
  if (!camera || !renderer || !interactionTextElement || !state) return;

  state.currentInteractable = null;
  interactionTextElement.textContent = '';

  let newInteractable = null;

  if (document.pointerLockElement === renderer.domElement) {

    // ── FIX: filtra solo i mesh entro interactionDistance dal player ─────────
    // Senza questo filtro il raycaster lancia un ray contro TUTTI i mesh
    // della scena ogni frame, inclusi oggetti a 30+ unità di distanza.
    // Usiamo un vettore pre-allocato (_meshWorldPos) per evitare allocazioni.
    const nearbyMeshes = interactableMeshes.filter((mesh) => {
      mesh.getWorldPosition(_meshWorldPos);
      return _meshWorldPos.distanceTo(camera.position) <= interactionDistance;
    });
    // ─────────────────────────────────────────────────────────────────────────

    state.interactRaycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const hits = state.interactRaycaster.intersectObjects(nearbyMeshes, true);
    const firstHit = hits.find((h) => h.distance <= interactionDistance);

    if (firstHit) {
      const ia = firstHit.object.userData.interactable;
      if (ia) {
        newInteractable = ia;
        state.currentInteractable = ia;
        if (typeof ia.getPrompt === 'function') {
          interactionTextElement.textContent = ia.getPrompt();
        }
      }
    }
  }

  // ── Gestione transizione highlight ───────────────────────────────────────
  const currentHighlighted = _highlighted?.interactable ?? null;

  if (newInteractable !== currentHighlighted) {
    if (_highlighted) {
      if (_fading) {
        _applyHighlight(_fading.interactable, 0);
      }
      _fading = _highlighted;
      _highlighted = null;
    }

    if (newInteractable && typeof newInteractable.setHighlightT === 'function') {
      _highlighted = { interactable: newInteractable, t: _fading?.t ?? 0 };
    }
  }

  const dt = Math.min(deltaTime, 0.05);

  if (_highlighted) {
    _highlighted.t = Math.min(1, _highlighted.t + FADE_IN_SPEED * dt);
    _applyHighlight(_highlighted.interactable, _highlighted.t);
  }

  if (_fading) {
    _fading.t = Math.max(0, _fading.t - FADE_OUT_SPEED * dt);
    _applyHighlight(_fading.interactable, _fading.t);
    if (_fading.t <= 0) {
      _applyHighlight(_fading.interactable, 0);
      _fading = null;
    }
  }
}

function _applyHighlight(interactable, t) {
  if (typeof interactable.setHighlightT !== 'function') return;
  interactable.setHighlightT(t);
}

export function tryInteract(state) {
  if (!state || !state.currentInteractable) return;
  const interactable = state.currentInteractable;
  if (typeof interactable.canInteract === 'function' && !interactable.canInteract()) return;
  if (typeof interactable.interact === 'function') interactable.interact();
}