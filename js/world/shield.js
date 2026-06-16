// shield.js
// Scudo 3d model per pickup a muro e viewmodel in mano.
// Raccoglibile con E → va in secondary slot (utility) tramite inventory.js.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { playSound } from '../systems/audioManager.js';
import { prepareHighlightMaterials, applyHighlight } from '../systems/highlight.js';

const SHIELD_MODEL_URL = './assets/models/shield_1/scene.gltf';
const _shieldLoader = new GLTFLoader();
let _cachedShieldScene = null;

// ─── Geometria procedurale dello scudo ───────────────────────────────────────
// Lo scudo è composto da:
//   - Corpo principale: CylinderGeometry a 6 lati (esagono schiacciato) → look medievale
//   - Bordo esterno: CylinderGeometry wireframe più largo e sottile
//   - Umbone centrale: SphereGeometry semisferica
//   - Croce decorativa: 2 BoxGeometry (asse V + asse H)

export function preloadShieldModel() {
  return new Promise((resolve, reject) => {
    if (_cachedShieldScene) { resolve(_cachedShieldScene); return; }
    _shieldLoader.load(
      SHIELD_MODEL_URL,
      (gltf) => { _cachedShieldScene = gltf.scene; resolve(gltf.scene); },
      undefined,
      reject
    );
  });
}

// ─── PICKUP A MURO ────────────────────────────────────────────────────────────
export function createShieldPickup({ state, position, rotationY = 0, rotationZ = 0 }) {
  const root = new THREE.Group();
  root.position.copy(position);
  root.rotation.y = rotationY;
  root.rotation.z = rotationZ;

  if (!_cachedShieldScene) {
    console.warn('[shield] modello non in cache — assicurati di chiamare preloadShieldModel() prima di createDungeon()');
    return null;
  }

  const model = _cachedShieldScene.clone(true);
  model.scale.setScalar(0.0009);
  root.add(model);

  // ── Highlight ──────────────────────────────────────────────────────────────
  // root.traverse qui funziona perché il modello è già clonato da cache (sincrono),
  // non asincrono come l'ascia. Le mesh esistono già in questo momento.
  const meshes = [];
  root.traverse((child) => { if (child.isMesh) meshes.push(child); });
  const highlightMats = prepareHighlightMaterials(meshes);
  // ───────────────────────────────────────────────────────────────────────────

  const interactable = {
    type: 'shield-pickup',
    getPrompt: () => pickup.isBlocked?.()
      ? 'Rompi il barile per raggiungere lo scudo'
      : 'Premi E per raccogliere lo scudo',
    canInteract: () => !state.hasShield && !pickup.isBlocked?.(),
    interact: () => {
      if (state.hasShield) return;
      pickup.removeFromWorld();
      playSound('pickupItem', { volume: 0.6 });
      import('../ui/inventory.js').then(({ addToInventory, ITEM_TYPES }) => {
        addToInventory(state, ITEM_TYPES.SHIELD);
      });
    },
    // ← NUOVA riga: chiamata da interactionSystem ogni frame con t ∈ [0,1]
    setHighlightT: (t) => applyHighlight(highlightMats, t)
  };

  root.traverse((child) => {
    if (!child.isMesh) return;
    child.userData.interactable = interactable;
    state.interactableMeshes.push(child);
  });

  state.scene.add(root);

  const pickup = {
    root,
    removed: false,
    removeFromWorld() {
      if (this.removed) return;
      this.removed = true;
      root.traverse((child) => {
        if (!child.isMesh) return;
        const idx = state.interactableMeshes.indexOf(child);
        if (idx >= 0) state.interactableMeshes.splice(idx, 1);
      });
      root.parent?.remove(root);
    }
  };

  return pickup;
}

// ─── VIEW MODEL SCUDO (mano sinistra) ────────────────────────────────────────

function setupShieldViewRendering(object3D) {
  object3D.renderOrder = 10000;
  object3D.traverse((child) => {
    if (!child.isMesh) return;
    child.renderOrder    = 10000;
    child.frustumCulled  = false;
    child.castShadow     = false;
    child.receiveShadow  = false;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((m) => {
        const c = m.clone();
        c.depthTest  = false;
        c.depthWrite = false;
        c.fog        = false;
        c.transparent = true;
        return c;
      });
    } else if (child.material) {
      child.material = child.material.clone();
      child.material.depthTest  = false;
      child.material.depthWrite = false;
      child.material.fog        = false;
      child.material.transparent = true;
    }
  });
}

// Posizioni idle e block nello spazio locale della camera
const SHIELD_IDLE_POS = new THREE.Vector3(-0.82, -0.42, -0.75);
const SHIELD_IDLE_ROT  = new THREE.Euler(0.10,  0.55, 0.08);

const SHIELD_BLOCK_POS = new THREE.Vector3(-0.42, -0.32, -0.72);
const SHIELD_BLOCK_ROT = new THREE.Euler(0.05, 0.12, 0.04);

// Velocità lerp — più alto = più veloce
const LERP_SPEED_BLOCK  = 12;   // scatta veloce in guardia
const LERP_SPEED_RETURN = 8;    // ritorna più morbido

export function ensureViewShield(state) {
  if (!state.camera) return null;
  if (state.viewShieldHolder) {
    state.viewShieldHolder.visible = true;
    return state.viewShieldHolder;
  }

  if (!_cachedShieldScene) {
    // Modello non ancora caricato — riprova dopo il preload
    console.warn('[shield] modello non ancora in cache, chiama preloadShieldModel() prima');
    return null;
  }

  const model = _cachedShieldScene.clone(true);
  model.scale.setScalar(0.0007);          // calibra visivamente
  model.rotation.set(0, Math.PI, 0);      // faccia verso il player

  const holder = new THREE.Group();
  holder.name = 'view-shield-holder';
  holder.position.copy(SHIELD_IDLE_POS);
  holder.rotation.copy(SHIELD_IDLE_ROT);
  holder.visible = false;
  holder.add(model);

  setupShieldViewRendering(holder);

  state.camera.add(holder);
  state.viewShieldHolder = holder;
  return holder;
}

/**
 * Chiamato ogni frame in animate().
 * Interpola il holder verso la posizione target (idle o block).
 */
export function updateShield(state, deltaTime) {
  const holder = state.viewShieldHolder;
  if (!holder) return;

  // Visibilità: scudo in mano solo se equipaggiato in secondary
  holder.visible = state.isShieldEquipped;
  if (!holder.visible) return;

  const targetPos = state.isBlocking ? SHIELD_BLOCK_POS : SHIELD_IDLE_POS;
  const targetRot = state.isBlocking ? SHIELD_BLOCK_ROT : SHIELD_IDLE_ROT;
  const speed     = state.isBlocking ? LERP_SPEED_BLOCK : LERP_SPEED_RETURN;

  // Lerp frame-rate independent: 1 - pow(0.001, dt) ≈ speed * dt per dt piccoli
  const alpha = 1 - Math.pow(0.001, deltaTime * speed * 0.1);

  holder.position.lerp(targetPos, alpha);

  holder.rotation.x = THREE.MathUtils.lerp(holder.rotation.x, targetRot.x, alpha);
  holder.rotation.y = THREE.MathUtils.lerp(holder.rotation.y, targetRot.y, alpha);
  holder.rotation.z = THREE.MathUtils.lerp(holder.rotation.z, targetRot.z, alpha);
}

/**
 * Prewarm del viewmodel scudo.
 * Va chiamata UNA VOLTA sola durante il loading, DOPO preloadShieldModel().
 * Elimina il freeze al primo switch torcia → scudo.
 */
export function prewarmViewShield(state, renderer) {
  if (!state.camera || !renderer) return;

  const holder = ensureViewShield(state);
  if (!holder) return;

  holder.visible = true;
  renderer.compile(state.scene, state.camera);
  holder.visible = false;

  console.log('[shield] prewarm completato — shader scudo compilati');
}