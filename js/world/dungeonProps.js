// world/dungeonProps.js
// Responsabilità: asset GLTF decorativi e pickup — crani, letto, scudo, spada.
// Separato dalla geometria perché usa GLTFLoader e ha logica di collider proxy.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createShieldPickup } from './shield.js';
import { createSwordPickup } from './sword.js';

export async function createSkullsDecoration(state, registerObstacle) { 
    const loader = new GLTFLoader();

    return new Promise((resolve) => {
        loader.load(
        './assets/models/skulls/scene.gltf',
        (gltf) => {
            const model = gltf.scene;

            model.traverse((child) => {
            if (child.isMesh) {
                child.visible = (
                child.name === 'Object_4' ||
                child.name === 'Object_5' ||
                child.name === 'Object_6' ||
                child.name === 'Object_7'
                );
                child.castShadow    = child.visible;
                child.receiveShadow = child.visible;
            }
            });

            model.rotation.set(0, 0, 0);
            model.scale.setScalar(0.068);
            model.position.set(-10.7, 0.1, 0);
            model.rotation.y = Math.PI / 2;

            state.scene.add(model);
            state.skullsDecoration = model;

            // --- COLLIDER PROXY per Object_4, Object_6, Object_7 ---
            // Object_5 è visibile ma piatto/decorativo: niente collisione.
            // Box3.setFromObject() calcola la AABB in world-space tenendo conto  di scala e rotazione del model root — nessun calcolo manuale necessario.
            const collidableNames = new Set(['Object_4', 'Object_6', 'Object_7']);
            const colliderMat = new THREE.MeshBasicMaterial({ visible: false });

            model.traverse((child) => {
            if (child.isMesh && collidableNames.has(child.name)) {
                child.updateWorldMatrix(true, false);

                const box    = new THREE.Box3().setFromObject(child);
                const size   = new THREE.Vector3();
                const center = new THREE.Vector3();
                box.getSize(size);
                box.getCenter(center);

                const proxy = new THREE.Mesh(
                new THREE.BoxGeometry(size.x, size.y, size.z),
                colliderMat
                );
                proxy.position.copy(center);
                state.scene.add(proxy);
                registerObstacle(proxy);
            }
            });

            resolve(model);
        },
        undefined,
        (err) => {
            console.warn('[Skulls] Caricamento fallito:', err);
            resolve(null);
        }
        );
    });
}

export async function createOldBed(state, registerObstacle) {
  const loader = new GLTFLoader();

  return new Promise((resolve) => {
    loader.load(
      './assets/models/old_bed/scene.gltf',
      (gltf) => {
        const model = gltf.scene;

        // Scale interna del GLTF già a 0.01 (FBX cm → m).
        // Portiamo a 1.2 per un letto leggermente più imponente nel dungeon.
        model.scale.setScalar(1.2);

        // Muro frontale a z=12 (superficie interna z=11.5).
        // Profondità letto ~1.42 → centro a z = 11.5 - (1.42*1.2)/2 ≈ 10.65
        // Il letto guarda verso -Z (testiera al muro di fondo, piedi verso il giocatore).
        model.position.set(0, 0, 10.65);
        model.rotation.y = 0; // testiera verso z=+12
        
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow    = true;
            child.receiveShadow = true;
          }
        });

        state.scene.add(model);
        state.oldBed = model;

        // --- COLLIDER PROXY ---
        // Dimensioni world dopo scale 1.2:
        //   larghezza X: 2.39 * 1.2 ≈ 2.87
        //   altezza   Y: 1.03 * 1.2 ≈ 1.24  → centro Y = 0.62
        //   profondità Z: 1.42 * 1.2 ≈ 1.70
        const bedProxy = new THREE.Mesh(
          new THREE.BoxGeometry(2.87, 1.24, 1.70),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        bedProxy.position.set(0, 0.62, 10.65);
        state.scene.add(bedProxy);
        registerObstacle(bedProxy);

        console.log('[OldBed] Letto aggiunto alla scena.');
        resolve(model);
      },
      undefined,
      (err) => {
        console.warn('[OldBed] Caricamento fallito:', err);
        resolve(null);
      }
    );
  });
}

export function createRoomOnePickups(state) {
  state.shieldPickup = createShieldPickup({
    state,
    position: new THREE.Vector3(7.0, 1.55, -11.5),
    rotationZ: -Math.PI
  });
  state.swordPickup = createSwordPickup({
    state,
    position: new THREE.Vector3(10.2, 0.70, 9.8),
    wallNormal: null
  });
}