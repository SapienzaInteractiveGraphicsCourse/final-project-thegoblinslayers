import * as THREE from 'three';

let _highlighted = null;  // { interactable, t }
let _fading      = null;  // { interactable, t }

const FADE_IN_SPEED  = 6.0;
const FADE_OUT_SPEED = 4.0;

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

  // ── Rilevamento interactable puntato ──────────────────────────────────────
  // newInteractable è null di default — se il pointerLock non è attivo
  // (es. inventario aperto, Escape) rimane null e scatta il fade-out corretto
  let newInteractable = null;

  if (document.pointerLockElement === renderer.domElement) {
    state.interactRaycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const hits = state.interactRaycaster.intersectObjects(interactableMeshes, true);
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
    // L'oggetto puntato è cambiato (o è diventato null): fade-out sul vecchio
    if (_highlighted) {
      // Se c'era già un fading in corso, resettalo a zero subito
      // per evitare che due oggetti restino illuminati contemporaneamente
      if (_fading) {
        _applyHighlight(_fading.interactable, 0);
      }
      _fading = _highlighted;
      _highlighted = null;
    }

    if (newInteractable && typeof newInteractable.setHighlightT === 'function') {
      // Nuovo oggetto: parte da dove stava il fading (transizione fluida) o da 0
      _highlighted = { interactable: newInteractable, t: _fading?.t ?? 0 };
    }
  }

  const dt = Math.min(deltaTime, 0.05);

  // Fade IN
  if (_highlighted) {
    _highlighted.t = Math.min(1, _highlighted.t + FADE_IN_SPEED * dt);
    _applyHighlight(_highlighted.interactable, _highlighted.t);
  }

  // Fade OUT — se newInteractable è null (nessun oggetto puntato o no pointerLock)
  // questo continua a girare fino a t=0, garantendo che il colore sparisca sempre
  if (_fading) {
    _fading.t = Math.max(0, _fading.t - FADE_OUT_SPEED * dt);
    _applyHighlight(_fading.interactable, _fading.t);
    if (_fading.t <= 0) {
      _applyHighlight(_fading.interactable, 0); // forza a zero esatto
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