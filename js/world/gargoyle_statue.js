import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Posizioni dei due gargoyle ai lati della porta corridoio → stanza 2
// La porta è a z = -26. I gargoyle sono posizionati appena oltre, a z = -27
// a sinistra (x = -3.5) e a destra (x = +3.5) del varco (PASSAGE_WIDTH = 6 → metà = 3)
const GARGOYLE_CONFIG = {
  modelUrl: './assets/models/gargoyle_statue/scene.gltf',
  scale: 1.0,          // ~1.9 unità di altezza a scale 1.0 — adatto per guardia a figura intera
  y: 0,                // pivot a terra, il modello è già correttamente in piedi
  z: -11.0,            // appena dentro la stanza 2, attaccati al muro d'ingresso
  leftX: -3.2,         // fianco sinistro del varco
  rightX: 3.2,         // fianco destro del varco
  rotationY: 0,        // guardano lungo -Z (verso il corridoio, verso il giocatore che entra)
};

function applyGargoyleDefaults(root) {
  root.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

/**
 * Carica il gargoyle una volta sola e lo clona per creare i due guardiani
 * ai lati della porta di ingresso alla stanza 2.
 *
 * Il gargoyle destro è ottenuto con scale.x = -1 sul Group radice,
 * che genera una riflessione speculare sull'asse X (simmetria a specchio).
 * Nota: scale.x = -1 inverte il winding order delle facce; THREE.js gestisce
 * questo automaticamente con FrontSide material, ma se il gargoyle usa
 * DoubleSided (come il Grim Reaper) non ci sono artefatti.
 */
export async function createGargoyleStatues(state, registerObstacle) {  // ← aggiungi parametro
  const loader = new GLTFLoader();

  return new Promise((resolve) => {
    loader.load(
      GARGOYLE_CONFIG.modelUrl,

      (gltf) => {
        const { scale, y, z, leftX, rightX, rotationY } = GARGOYLE_CONFIG;

        // --- Gargoyle SINISTRO ---
        const leftRoot = gltf.scene;
        leftRoot.position.set(leftX, y, z);
        leftRoot.rotation.y = rotationY;
        leftRoot.scale.setScalar(scale);
        applyGargoyleDefaults(leftRoot);
        state.scene.add(leftRoot);

        // --- Gargoyle DESTRO ---
        const rightRoot = gltf.scene.clone(true);
        rightRoot.position.set(rightX, y, z);
        rightRoot.rotation.y = rotationY;
        rightRoot.scale.set(-scale, scale, scale);
        applyGargoyleDefaults(rightRoot);
        state.scene.add(rightRoot);

        state.gargoyleLeft  = leftRoot;
        state.gargoyleRight = rightRoot;

        // --- COLLIDER PROXY ---
        // Il gargoyle è alto ~1.9 unità, con base larga ~0.9 unità.
        // Un singolo box 0.9×1.9×0.7 copre il corpo senza incluere troppa aria.
        // Centro Y = 1.9/2 = 0.95 (base a y=0)
        const colliderGeo = new THREE.BoxGeometry(0.9, 1.9, 0.7);
        const colliderMat = new THREE.MeshBasicMaterial({ visible: false });

        const leftCollider = new THREE.Mesh(colliderGeo, colliderMat);
        leftCollider.position.set(leftX, 0.95, z);
        state.scene.add(leftCollider);
        registerObstacle(leftCollider);

        const rightCollider = new THREE.Mesh(colliderGeo, colliderMat);
        rightCollider.position.set(rightX, 0.95, z);
        state.scene.add(rightCollider);
        registerObstacle(rightCollider);

        
        resolve({ left: leftRoot, right: rightRoot });
      },

      undefined,

      (error) => {
        console.error('[GargoyleStatues] Errore nel caricamento:', error);
        resolve(null);
      }
    );
  });
}