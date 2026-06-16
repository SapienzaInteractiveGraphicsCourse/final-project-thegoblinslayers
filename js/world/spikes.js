import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const SPIKES_CONFIG = {
  modelUrl: './assets/models/spikes/scene.gltf',
  scale: 4.57,          // ~1.9 unità di altezza a scale 1.0 — adatto per guardia a figura intera
  y: 0.01,                // pivot a terra, il modello è già correttamente in piedi
  z1: -18.78,
  xL: 2.57,         // posizione x
  z2: -18.85-2.57-0.1
};

function applySpikesDefaults(root) {
  root.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

export async function createSpikes(state, registerObstacle) {  // ← aggiungi parametro
  const loader = new GLTFLoader();

  return new Promise((resolve) => {
    loader.load(
      SPIKES_CONFIG.modelUrl,

      (gltf) => {
        const { scale, y, z1, xL, z2} = SPIKES_CONFIG;

        const firstRoot = gltf.scene;
        firstRoot.position.set(xL, y, z1);
        firstRoot.scale.setScalar(scale);
        applySpikesDefaults(firstRoot);
        state.scene.add(firstRoot);
        state.spike1 = firstRoot;

        const secondRoot=gltf.scene.clone(true);
        secondRoot.position.set(xL, y, z2);
        secondRoot.scale.setScalar(scale);
        applySpikesDefaults(secondRoot);
        state.scene.add(secondRoot);
        state.spike2 = secondRoot;

        const thirdRoot=gltf.scene.clone(true);
        thirdRoot.position.set(-xL, y, z2);
        thirdRoot.scale.setScalar(scale);
        applySpikesDefaults(thirdRoot);
        state.scene.add(thirdRoot);
        state.spike3 = thirdRoot;

        const fourthRoot=gltf.scene.clone(true);
        fourthRoot.position.set(-xL, y, z1);
        fourthRoot.scale.setScalar(scale);
        applySpikesDefaults(fourthRoot);
        state.scene.add(fourthRoot);
        state.spike3 = fourthRoot;

        const colliderGeo = new THREE.BoxGeometry(2.5,1,23-17);
        const colliderMat = new THREE.MeshBasicMaterial({visible: false});

        const leftCollider = new THREE.Mesh(colliderGeo, colliderMat);
        leftCollider.position.set(-xL, 0.95, -17-(23-17)*0.5);
        state.scene.add(leftCollider);
        registerObstacle(leftCollider);

        const rightCollider = new THREE.Mesh(colliderGeo, colliderMat);
        rightCollider.position.set(xL, 0.5, -17-(23-17)*0.5);
        state.scene.add(rightCollider);
        registerObstacle(rightCollider);

        console.log('[Spikes] Gargoyle e collider aggiunti.');
        resolve({first: firstRoot, second:secondRoot, third: thirdRoot, fourth:fourthRoot});
      },

      undefined,

      (error) => {
        console.error('[Spikes] Errore nel caricamento:', error);
        resolve(null);
      }
    );
  });
}