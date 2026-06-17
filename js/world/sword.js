// js/world/sword.js
// Spada medievale — pickup a muro, viewmodel prima persona, swing veloce (0.28s).
// Struttura speculare ad axe.js — stessa architettura, parametri diversi.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareHighlightMaterials, applyHighlight } from '../systems/highlight.js';
import { playSound } from '../systems/audioManager.js';

// Vettori temporanei riutilizzati ogni frame — evitano allocazioni nell'animation loop
const _rayOrigin    = new THREE.Vector3();
const _rayDirection = new THREE.Vector3();

const _gltfLoader = new GLTFLoader();

const SWORD_MODEL_PATH = './assets/models/sword/scene.gltf';

// ─── Helper: carica il modello GLTF nel gruppo root fornito ──────────────────
function loadSwordModel(root, onLoaded) {
  _gltfLoader.load(
    SWORD_MODEL_PATH,
    (gltf) => {
      const model = gltf.scene;

      // Il nodo radice Sketchfab applica una rotazione Y-up → Z-up.
      // La azzeriamo qui e gestiamo l'orientamento manualmente sul root parent.
      model.rotation.set(0, 0, 0);

      // Scala: la spada nel GLTF è lunga ~2 unità (vedi min/max accessor: ±1.0 su X).
      // Scaliamo a ~0.35 unità di gioco, proporzionale all'ascia (0.10 su modello diverso).
      model.scale.setScalar(0.82);

      root.add(model);
      if (onLoaded) onLoaded(model);
    },
    undefined,
    (err) => console.error('[sword] Errore caricamento modello:', err)
  );
}

// ─── PICKUP A MURO ────────────────────────────────────────────────────────────
/**
 * Crea la spada appoggiata al muro laterale sinistro della stanza 1
 * (il muro che ha la torcia da muro spenta).
 *
 * Posa: manico verso il basso a terra, lama inclinata che si appoggia al muro.
 * Visivamente: la spada forma circa 20° con la verticale del muro.
 *
 * Il parametro `position` viene passato da dungeon.js — qui definiamo solo
 * il default di fallback.
 */
export function createSwordPickup({
  state,
  position   = new THREE.Vector3(0.0, 0.0, 0.9),
  wallNormal = null     // ← aggiunto: null = sdraiata a terra
}) {
  const root = new THREE.Group();
  root.position.copy(position);

  // POSA SDRAIATA A TERRA (debug/test)
  // rotation.x = -Math.PI/2 → il modello che punta su Y ora punta su -Z (verso il player)
  // rotation.y = Math.PI/4  → ruota di 45° in pianta → visibile frontalmente
  // rotation.z = Math.Pi          → EFFETTO CONFICCATO nel pavimento
  root.rotation.set(-Math.PI / 2, Math.PI / 2, Math.PI);  

  // Se wallNormal è fornito → orienta la punta verso il muro
  if (wallNormal) {
    root.rotation.y = Math.atan2(-wallNormal.x, -wallNormal.z);
  }

  const highlightMats = [];

  const interactable = {
    type:        'sword-pickup',
    getPrompt: () => pickup.isBlocked?.()
      ? 'Break the barrel to extract the sword' 
      : 'Press E to draw sword',
    canInteract: () => !state.hasSword && !(pickup.isBlocked?.()),
    interact:    () => {
      if (state.hasSword) return;
      
      pickup.removeFromWorld();
      playSound('pickupItem', { volume: 0.6 });
      ensureViewSword(state);
      import('../ui/inventory.js').then(({ addToInventory, ITEM_TYPES }) => {
        addToInventory(state, ITEM_TYPES.SWORD);
      });
    },
    setHighlightT: (t) => applyHighlight(highlightMats, t),
  };

  loadSwordModel(root, (model) => {
    model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow              = true;
      child.receiveShadow           = true;
      child.userData.interactable   = interactable;
      state.interactableMeshes.push(child);
    });

    const meshes   = [];
    model.traverse((child) => { if (child.isMesh) meshes.push(child); });
    highlightMats.push(...prepareHighlightMaterials(meshes));
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
    },
  };

  state.swordPickup = pickup;
  return pickup;
}

// ─── VIEW MODEL (mano destra, prima persona) ──────────────────────────────────
/**
 * Crea il viewmodel della spada agganciato alla camera.
 * Viene chiamato una volta sola al momento della raccolta.
 * Posizione leggermente diversa dall'ascia: la spada è più lunga,
 * quindi la teniamo più centrata e meno in basso.
 */
export function ensureViewSword(state) {
  if (!state.camera)         return null;
  if (state.viewSwordHolder) return state.viewSwordHolder;

  const holder = new THREE.Group();
  holder.name = 'view-sword-holder';
  holder.position.set(0.55, -0.32, -0.60);
  holder.rotation.set(0, 0, 0);
  holder.visible = false;  // nascosto finché non equipaggiata

  const pivotGroup = new THREE.Group();
  pivotGroup.name = 'sword-pivot';
  holder.add(pivotGroup);

  const root = new THREE.Group();
  root.position.set(0.3, 0, -0.25);
  pivotGroup.add(root);

  loadSwordModel(root, (model) => {
    model.rotation.set(0.01, Math.PI, -Math.PI / 2);
    model.scale.setScalar(0.75);
    setupViewModelRendering(model);

    // ← PRE-WARM: forza la compilazione shader in un frame silenzioso
    //   posiziona fuori dal frustum così non appare, ma gli shader vengono compilati
    holder.position.set(99999, 99999, 99999);
    state.camera.add(holder);

    // Dopo 3 frame riporta alla posizione corretta
    let frames = 0;
    const restore = () => {
      if (++frames >= 3) {
        holder.position.set(0.55, -0.32, -0.60);
        return;
      }
      requestAnimationFrame(restore);
    };
    requestAnimationFrame(restore);
  });

  state.camera.add(holder);

  state.viewSwordHolder = holder;
  state.viewSwordPivot  = pivotGroup;
  state.viewSwordRoot   = root;
  state.swordIdlePosition.copy(holder.position);
  state.swordIdleRotation.copy(holder.rotation);

  return holder;
}

// ─── SWING ────────────────────────────────────────────────────────────────────
/**
 * Avvia l'animazione di swing. Chiamato da main.js al mousedown sinistro
 * solo se isSwordEquipped è true e non c'è già uno swing in corso.
 */
export function startSwordSwing(state) {
  if (!state.hasSword || !state.isSwordEquipped) return;
  if (state.isSwordSwinging) return;
  state.isSwordSwinging   = true;
  state.swordSwingElapsed = 0;
  state.swordHitApplied   = false;
}

/**
 * Aggiornato ogni frame da main.js.
 * Gestisce visibilità del viewmodel e progressione dell'animazione swing.
 *
 * Lo swing è diviso in 3 fasi temporali (sul parametro t normalizzato 0→1):
 *
 *  [0.00 → 0.30]  WINDUP   — la spada si solleva e arretra leggermente (preparazione)
 *  [0.30 → 0.65]  SLASH    — colpo veloce in avanti-basso (la fase più rapida)
 *  [0.65 → 1.00]  RECOVERY — ritorno fluido alla posizione idle
 *
 * La spada è più veloce dell'ascia (0.28s vs 0.48s) quindi le fasi sono più compresse.
 * Il colpo viene registrato nella finestra [0.38, 0.60] — il picco dello slash.
 */
export function updateSword(state, deltaTime) {
  const holder = state.viewSwordHolder;
  const pivot  = state.viewSwordPivot;
  if (!holder || !pivot) return;

  holder.visible = state.hasSword && state.isSwordEquipped;

  if (!state.isSwordSwinging) {
    // Lerp holder alla idle position
    holder.position.lerp(state.swordIdlePosition, Math.min(1, deltaTime * 12));
    holder.rotation.x = THREE.MathUtils.lerp(holder.rotation.x, state.swordIdleRotation.x, Math.min(1, deltaTime * 12));
    holder.rotation.y = THREE.MathUtils.lerp(holder.rotation.y, state.swordIdleRotation.y, Math.min(1, deltaTime * 12));
    holder.rotation.z = THREE.MathUtils.lerp(holder.rotation.z, state.swordIdleRotation.z, Math.min(1, deltaTime * 12));
    // Pivot torna a zero (riposo)
    pivot.rotation.x = THREE.MathUtils.lerp(pivot.rotation.x, 0, Math.min(1, deltaTime * 12));
    pivot.rotation.y = THREE.MathUtils.lerp(pivot.rotation.y, 0, Math.min(1, deltaTime * 12));
    pivot.rotation.z = THREE.MathUtils.lerp(pivot.rotation.z, 0, Math.min(1, deltaTime * 12));
    return;
  }

  state.swordSwingElapsed += deltaTime;
  const t = Math.min(state.swordSwingElapsed / state.swordSwingDuration, 1);

  // ── FASE 1 — CARICA [0.00 → 0.32] ─────────────────────────────────────────
  // L'holder si sposta a destra (+x) e indietro verso camera (+z).
  // Il pivot ruota: la PUNTA va verso destra e verso la camera (arco di carica).
  // pivot.y positivo → punta ruota a destra (con rotation.y invertita)
  // pivot.z negativo → punta si solleva leggermente (presa naturale)
  if (t < 0.32) {
    const k = easeOutCubic(t / 0.32);
    holder.position.set(
      state.swordIdlePosition.x + 0.12 * k,
      state.swordIdlePosition.y + 0.04 * k,
      state.swordIdlePosition.z + 0.08 * k   // si avvicina → effetto "si carica"
    );
    holder.rotation.x = THREE.MathUtils.lerp(state.swordIdleRotation.x, -0.10, k);
    holder.rotation.y = THREE.MathUtils.lerp(state.swordIdleRotation.y,  0, k);
    holder.rotation.z = THREE.MathUtils.lerp(state.swordIdleRotation.z,  0, k);

    // Pivot: arco di carica — punta va a destra e indietro
    pivot.rotation.x = THREE.MathUtils.lerp(0, 0.55, k);  // punta verso camera (affondo indietro)
    pivot.rotation.y = THREE.MathUtils.lerp(0, -0.20, k);  // leggero arco laterale destro
    pivot.rotation.z = THREE.MathUtils.lerp(0, -0.12, k);  // inclinazione naturale del polso

  // ── FASE 2 — SLASH [0.32 → 0.62] ──────────────────────────────────────────
  // Il pivot spazza l'arco da destra a sinistra ATTORNO ALL'IMPUGNATURA.
  // L'holder si sposta a sinistra mentre il pivot ruota:
  // il risultato è che la PUNTA descrive un grande arco frontale.
  // easeInCubic → accelerazione progressiva = effetto frusta
  } else if (t < 0.62) {
    const k = easeInCubic((t - 0.32) / 0.30);
    holder.position.set(
      THREE.MathUtils.lerp(state.swordIdlePosition.x + 0.12, state.swordIdlePosition.x - 0.10, k),
      THREE.MathUtils.lerp(state.swordIdlePosition.y + 0.04, state.swordIdlePosition.y - 0.04, k),
      THREE.MathUtils.lerp(state.swordIdlePosition.z + 0.08, state.swordIdlePosition.z - 0.18, k)
    );
    holder.rotation.x = THREE.MathUtils.lerp(-0.10, +0.15, k);
    holder.rotation.y = 0;
    holder.rotation.z = 0;

    // Pivot: arco principale dello slash — da destra a sinistra
    pivot.rotation.x = THREE.MathUtils.lerp(0.55, -0.45, k);  // punta si protende in avanti
    pivot.rotation.y = THREE.MathUtils.lerp(-0.20,  0.35, k);  // spazza leggermente a sinistra
    pivot.rotation.z = THREE.MathUtils.lerp(-0.12, +0.10, k);

  // ── FASE 3 — RECOVERY [0.62 → 1.00] ───────────────────────────────────────
  // Tutto torna alla idle. Il pivot rientra a zero con easeOutCubic.
  } else {
    const k = easeOutCubic((t - 0.62) / 0.38);
    holder.position.set(
      THREE.MathUtils.lerp(state.swordIdlePosition.x - 0.10, state.swordIdlePosition.x, k),
      THREE.MathUtils.lerp(state.swordIdlePosition.y - 0.04, state.swordIdlePosition.y, k),
      THREE.MathUtils.lerp(state.swordIdlePosition.z - 0.18, state.swordIdlePosition.z, k)
    );
    holder.rotation.x = THREE.MathUtils.lerp(+0.15, state.swordIdleRotation.x, k);
    holder.rotation.y = THREE.MathUtils.lerp(0, state.swordIdleRotation.y, k);
    holder.rotation.z = THREE.MathUtils.lerp(0, state.swordIdleRotation.z, k);

    pivot.rotation.x = THREE.MathUtils.lerp(-0.45, 0, k);
    pivot.rotation.y = THREE.MathUtils.lerp( 0.35, 0, k);
    pivot.rotation.z = THREE.MathUtils.lerp(+0.10, 0, k);
  }

  // Hit detection nella finestra centrale dello slash
  if (!state.swordHitApplied && t >= 0.40 && t <= 0.62) {
    const hitSword = tryHitBarrelWithSword(state);
    const hitMob    = tryHitMob(state); 
    if (hitSword || hitMob) state.swordHitApplied = true;
  }

  if (t >= 1) {
    state.isSwordSwinging   = false;
    state.swordSwingElapsed = 0;
  }
}

// ─── HIT DETECTION ────────────────────────────────────────────────────────────
/**
 * Spara un ray dalla camera nella direzione di sguardo.
 * Se interseca un barile entro swordHitDistance, chiama barrel.hit().
 * La spada richiede 5 colpi — il conteggio è gestito dentro barrel.js
 * tramite il suo sistema interno di hp.
 */
function tryHitBarrelWithSword(state) {
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
  let closestHit    = null;

  for (const barrel of candidateBarrels) {
    if (!barrel || barrel.isDestroyed) continue;
    const hits     = state.attackRaycaster.intersectObjects(barrel.hitMeshes, true);
    const firstHit = hits.find((h) => h.distance <= state.swordHitDistance);
    if (!firstHit) continue;
    if (!closestHit || firstHit.distance < closestHit.distance) {
      closestHit    = firstHit;
      closestBarrel = barrel;
    }
  }

  if (!closestBarrel) return false;

  // Passiamo 'sword' come tipo arma così barrel.js può distinguere
  // ascia (3 colpi) da spada (5 colpi) se vuoi differenziarne il danno in futuro.
  closestBarrel.hit(closestHit.point, 3);
  return true;
}

function tryHitMob(state) {
  if (!state.mob || state.mob.isDead || !state.mob.isActive) return false;
  if (!state.camera) return false;

  state.camera.getWorldPosition(_rayOrigin);
  state.camera.getWorldDirection(_rayDirection);
  state.attackRaycaster.set(_rayOrigin, _rayDirection);

  const hits = state.attackRaycaster.intersectObjects(state.mob.hitMeshes, true);
  const hit  = hits.find((h) => h.distance <= (state.swordHitDistance ?? 2.2));
  if (!hit) return false;

  const SWORD_DAMAGE_NORMAL  = 20;
  const SWORD_DAMAGE_BLOCKED = 5;  // spada su scudo: quasi nullo

  const SWORD_DAMAGE = (state.mob._isBlocking || state.mob._isShielding)
  ? SWORD_DAMAGE_BLOCKED
  : SWORD_DAMAGE_NORMAL;
  state.mob.takeDamage(SWORD_DAMAGE,state);

  // Colpo fatale → suono morte mob, altrimenti suono danno normale
  if (state.mob.hp <= 0 || state.mob.isDead) {
    playSound('mobDeath', { volume: 0.9 });
  } else {
    playSound('mobDamage', { volume: 0.8 });
  }

  return true;
}




// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Configura il viewmodel per il rendering in prima persona:
 * - renderOrder alto → sempre sopra la scena 3D
 * - depthTest/depthWrite disabilitati → non si "incastra" nei muri
 * - frustumCulled = false → non viene scartato dal frustum culling
 */
function setupViewModelRendering(object3D) {
  object3D.renderOrder = 10000;
  object3D.traverse((child) => {
    if (!child.isMesh) return;
    child.renderOrder   = 10000;
    child.frustumCulled = false;
    child.castShadow    = false;
    child.receiveShadow = false;

    const fixMaterial = (m) => {
      const c       = m.clone();
      c.depthTest   = false;
      c.depthWrite  = false;
      c.fog         = false;
      c.transparent = true;
      return c;
    };

    if (Array.isArray(child.material)) {
      child.material = child.material.map(fixMaterial);
    } else if (child.material) {
      child.material = fixMaterial(child.material);
    }
  });
}

function removeRootMeshesFromInteractables(state, root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    const index = state.interactableMeshes.indexOf(child);
    if (index >= 0) state.interactableMeshes.splice(index, 1);
  });
}

// Curve di easing — identiche ad axe.js per coerenza
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t) {
  return t * t * t;
}