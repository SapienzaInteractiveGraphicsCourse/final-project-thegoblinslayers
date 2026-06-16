import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareHighlightMaterials, applyHighlight } from '../systems/highlight.js';
import { playSound } from '../systems/audioManager.js';

const _rayOrigin = new THREE.Vector3();
const _rayDirection = new THREE.Vector3();

// Loader condiviso — una sola istanza per tutto il file
const _gltfLoader = new GLTFLoader();

// Path del modello 3D dell'ascia
const AXE_MODEL_PATH = './assets/models/axe_2/scene.gltf';

// ─── Funzione helper: carica il modello e lo aggiunge al gruppo root ──────────
function loadAxeModel(root, onLoaded) {
  _gltfLoader.load(
    AXE_MODEL_PATH,
    (gltf) => {
      const model = gltf.scene;

      // Il modello Sketchfab esce con scala enorme, lo normalizziamo
      // Questi valori vanno calibrati in base a quanto appare grande nel gioco
      model.scale.setScalar(0.10);

      // Correzione orientamento: Sketchfab ruota il modello di -90° su X
      // Azzeriamo la rotazione del nodo radice e la gestiamo noi
      model.rotation.set(0, 0, 0);

      root.add(model);
      if (onLoaded) onLoaded(model);
    },
    undefined,
    (err) => console.error('[axe] Errore caricamento modello:', err)
  );
}

// ─── PICKUP A TERRA ───────────────────────────────────────────────────────────
export function createAxePickup({
  state,
  position = new THREE.Vector3(0.9, 0.00, 0.8)
}) {
  const root = new THREE.Group();
  root.position.copy(position);
  root.rotation.set(Math.PI / 2, 0.0, Math.PI);

  // highlightMats viene popolato dentro onLoaded — il closure funziona
  // perché setHighlightT viene sempre chiamato dopo il caricamento
  const highlightMats = [];

  const interactable = {
    type: 'axe-pickup',
    getPrompt: () => 'Premi E per raccogliere l\'ascia',
    canInteract: () => !state.hasAxe,
    interact: () => {
      if (state.hasAxe) return;
      pickup.removeFromWorld();
      playSound('pickupItem', { volume: 0.6 });
      ensureViewAxe(state);
      import('../ui/inventory.js').then(({ addToInventory, ITEM_TYPES }) => {
        addToInventory(state, ITEM_TYPES.AXE);
      });
    },
    setHighlightT: (t) => applyHighlight(highlightMats, t)
  };

  loadAxeModel(root, (model) => {
    model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.userData.interactable = interactable;
      state.interactableMeshes.push(child);
    });

    // ── Highlight: raccogli le mesh dopo il caricamento e popola highlightMats
    const meshes = [];
    model.traverse((child) => { if (child.isMesh) meshes.push(child); });
    const prepared = prepareHighlightMaterials(meshes);
    highlightMats.push(...prepared);
    // ─────────────────────────────────────────────────────────────────────
  });

  state.scene.add(root);

  const pickup = {
    root,
    removed: false,
    removeFromWorld() {
      if (this.removed) return;
      this.removed = true;
      removeRootMeshesFromInteractables(state, root);
      root.parent?.remove(root);
    }
  };

  return pickup;
}

// ─── VIEW MODEL (mano destra in prima persona) ────────────────────────────────
function setupViewModelRendering(object3D) {
  object3D.renderOrder = 10000;
  object3D.traverse((child) => {
    if (!child.isMesh) return;
    child.renderOrder = 10000;
    child.frustumCulled = false;
    child.castShadow = false;
    child.receiveShadow = false;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((m) => {
        const c = m.clone();
        c.depthTest = false;
        c.depthWrite = false;
        c.fog = false;
        c.transparent = true;
        return c;
      });
    } else if (child.material) {
      child.material = child.material.clone();
      child.material.depthTest = false;
      child.material.depthWrite = false;
      child.material.fog = false;
      child.material.transparent = true;
    }
  });
}

export function ensureViewAxe(state) {
  if (!state.camera) return null;
  if (state.viewAxeHolder) return state.viewAxeHolder;

  const holder = new THREE.Group();
  holder.name = 'view-axe-holder';
  holder.position.set(0.68, -0.28, -0.70);
  holder.rotation.set(0, 0, 0);
  holder.visible = false;

  const root = new THREE.Group();
  // Orientamento base del viewmodel nella mano — calibra questi dopo aver visto il modello
  root.rotation.set(0.08, 0.08, 0.25);
  holder.add(root);

  // Carica il modello 3D anche per il viewmodel
  loadAxeModel(root, (model) => {
    // Orientamento specifico del viewmodel: ruotiamo per far puntare la lama nella direzione giusta
    // Questi valori vanno aggiustati visivamente dopo il primo avvio
    model.rotation.set(0, -Math.PI / 2, 0);
    model.scale.setScalar(0.10);

    setupViewModelRendering(model);
  });

  state.camera.add(holder);

  state.viewAxeHolder = holder;
  state.viewAxeRoot = root;
  state.axeIdlePosition.copy(holder.position);
  state.axeIdleRotation.copy(holder.rotation);

  return holder;
}

// ─── SWING — tutto invariato da prima ────────────────────────────────────────
export function startAxeSwing(state) {
  if (!state.hasAxe || !state.isAxeEquipped) return;
  if (state.isAxeSwinging) return;
  state.isAxeSwinging = true;
  state.axeSwingElapsed = 0;
  state.axeHitApplied = false;
  state.axeSwingSoundPlayed = false; 
}

export function updateAxe(state, deltaTime) {
  const holder = state.viewAxeHolder;
  if (!holder) return;

  holder.visible = state.hasAxe && state.isAxeEquipped;

  if (!state.isAxeSwinging) {
    holder.position.lerp(state.axeIdlePosition, Math.min(1, deltaTime * 12));
    holder.rotation.x = THREE.MathUtils.lerp(holder.rotation.x, state.axeIdleRotation.x, Math.min(1, deltaTime * 12));
    holder.rotation.y = THREE.MathUtils.lerp(holder.rotation.y, state.axeIdleRotation.y, Math.min(1, deltaTime * 12));
    holder.rotation.z = THREE.MathUtils.lerp(holder.rotation.z, state.axeIdleRotation.z, Math.min(1, deltaTime * 12));
    return;
  }

  state.axeSwingElapsed += deltaTime;
  const t = Math.min(state.axeSwingElapsed / state.axeSwingDuration, 1);

  if (t < 0.35) {
    const k = easeOutCubic(t / 0.35);
    holder.position.set(
      state.axeIdlePosition.x + 0.10 * k,
      state.axeIdlePosition.y + 0.06 * k,
      state.axeIdlePosition.z + 0.10 * k
    );
    holder.rotation.x = +0.50 * k;
    holder.rotation.y = +0.30 * k;
    holder.rotation.z = -0.30 * k;

  } else if (t < 0.60) {
    const k = easeInCubic((t - 0.35) / 0.25);
    holder.position.set(
      THREE.MathUtils.lerp(state.axeIdlePosition.x + 0.10, state.axeIdlePosition.x - 0.05, k),
      THREE.MathUtils.lerp(state.axeIdlePosition.y + 0.06, state.axeIdlePosition.y - 0.12, k),
      THREE.MathUtils.lerp(state.axeIdlePosition.z + 0.10, state.axeIdlePosition.z - 0.20, k)
    );
    holder.rotation.x = THREE.MathUtils.lerp(+0.50, -0.45, k);
    holder.rotation.y = THREE.MathUtils.lerp(+0.30, -0.15, k);
    holder.rotation.z = THREE.MathUtils.lerp(-0.30, +0.25, k);
    
  } else {
    const k = easeOutCubic((t - 0.60) / 0.40);
    holder.position.set(
      THREE.MathUtils.lerp(state.axeIdlePosition.x - 0.05, state.axeIdlePosition.x, k),
      THREE.MathUtils.lerp(state.axeIdlePosition.y - 0.12, state.axeIdlePosition.y, k),
      THREE.MathUtils.lerp(state.axeIdlePosition.z - 0.20, state.axeIdlePosition.z, k)
    );
    holder.rotation.x = THREE.MathUtils.lerp(-0.45, state.axeIdleRotation.x, k);
    holder.rotation.y = THREE.MathUtils.lerp(-0.15, state.axeIdleRotation.y, k);
    holder.rotation.z = THREE.MathUtils.lerp(+0.25, state.axeIdleRotation.z, k);
  }

  if (!state.axeHitApplied && t >= 0.45 && t <= 0.60) {
    const hitBarrel = tryHitBarrel(state);
    const hitMob    = tryHitMob(state);     
    if (hitBarrel || hitMob) state.axeHitApplied = true;
  }

  if (!state.axeSwingSoundPlayed && t >= 0.60) {
    state.axeSwingSoundPlayed = true;
    playSound('axeSwing', { volume: 0.75 });
  }

  if (t >= 1) {
    state.isAxeSwinging = false;
    state.axeSwingElapsed = 0;
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function tryHitBarrel(state) {
  if (!state.camera) return false;

  const candidateBarrels =
    Array.isArray(state.barrels) && state.barrels.length > 0
      ? state.barrels
      : (state.barrel ? [state.barrel] : []);

  if (candidateBarrels.length === 0) return false;

  state.camera.getWorldPosition(_rayOrigin);
  state.camera.getWorldDirection(_rayDirection);
  state.attackRaycaster.set(_rayOrigin, _rayDirection);

  let closestBarrel = null;
  let closestHit = null;

  for (const barrel of candidateBarrels) {
    if (!barrel || barrel.isDestroyed) continue;
    const hits = state.attackRaycaster.intersectObjects(barrel.hitMeshes, true);
    const firstHit = hits.find((hit) => hit.distance <= state.axeHitDistance);
    if (!firstHit) continue;
    if (!closestHit || firstHit.distance < closestHit.distance) {
      closestHit = firstHit;
      closestBarrel = barrel;
    }
  }

  if (!closestBarrel) return false;
  closestBarrel.hit(closestHit.point, 5);
  return true;
}


// ─── HIT MOB ──────────────────────────────────────────────────────────────────
function tryHitMob(state) {
  if (!state.mob || state.mob.isDead || !state.mob.isActive) return false;
  if (!state.camera) return false;

  state.camera.getWorldPosition(_rayOrigin);
  state.camera.getWorldDirection(_rayDirection);
  state.attackRaycaster.set(_rayOrigin, _rayDirection);

  const hits = state.attackRaycaster.intersectObjects(state.mob.hitMeshes, true);
  const hit  = hits.find((h) => h.distance <= (state.axeHitDistance ?? 2.0));
  if (!hit) return false;

  const AXE_DAMAGE_NORMAL  = 30;
  const AXE_DAMAGE_BLOCKED = 8;   // ascia su scudo: quasi nullo

  const AXE_DAMAGE = (state.mob._isBlocking || state.mob._isShielding)
  ? AXE_DAMAGE_BLOCKED
  : AXE_DAMAGE_NORMAL;

  state.mob.takeDamage(AXE_DAMAGE,state);

  // Colpo fatale → suono morte mob, altrimenti suono danno normale
  if (state.mob.hp <= 0 || state.mob.isDead) {
    playSound('mobDeath', { volume: 0.9 });
  } else {
    playSound('mobDamage', { volume: 0.8 });
  }

  return true;
}


function removeRootMeshesFromInteractables(state, root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    const index = state.interactableMeshes.indexOf(child);
    if (index >= 0) state.interactableMeshes.splice(index, 1);
  });
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t) {
  return t * t * t;
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}