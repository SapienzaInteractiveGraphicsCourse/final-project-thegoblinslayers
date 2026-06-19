import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareHighlightMaterials, applyHighlight } from '../systems/highlight.js';
import { playSound } from '../systems/audioManager.js';
import { unlockAchievement } from '../systems/achievementManager.js';

const gltfLoader = new GLTFLoader();

export function createLever({
  scene,
  interactableMeshes,
  position = new THREE.Vector3(-8.2, 1.2, -11.45),
  rotationY = Math.PI,
  scale = 0.8,
  showErrorOverlay,
  state
}) {

  const lever = {
    root: null,
    handleMesh: null,
    handlePivot: null,
    isActivated: false,
    restAngle: 0,
    activeAngle: -Math.PI / 2,
    rotationSpeed: 4.0,
    isBlocked: null,

    activate() {
      if (this.isActivated) return;                          
      if (typeof this.isBlocked === 'function' && this.isBlocked()) return;

      this.isActivated = true;
      unlockAchievement('PULL_LEVER');                       
      playSound('leverPush', { volume: 0.8, offset: 0, duration: 1.8 });
    },

    reset() {
    this.isActivated = false;
    // Riporta il pivot alla posizione di riposo (leva alzata)
    if (this.handlePivot) {
      this.handlePivot.rotation.y = this.restAngle;
    }
  },

    update(deltaTime) {
      if (!this.handlePivot) return;
      const targetAngle = this.isActivated ? this.activeAngle : this.restAngle;
      const step = this.rotationSpeed * deltaTime;
      this.handlePivot.rotation.y = moveTowards(
        this.handlePivot.rotation.y,
        targetAngle,
        step
      );
    }
  };

  gltfLoader.load(
    './assets/models/rusty-wall-lever/scene.gltf',
    (gltf) => {
      lever.root = gltf.scene;
      lever.root.position.copy(position);
      lever.root.rotation.y = rotationY;
      lever.root.scale.setScalar(scale);

      let leverHandleMesh = null;

      lever.root.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.name === 'Lever_v2_Box_Handle_0') {
          leverHandleMesh = child;
        }
      });

      scene.add(lever.root);

      if (!leverHandleMesh) {
        console.warn('Handle della leva non trovata');
        return;
      }

      lever.handleMesh = leverHandleMesh;
      setupLeverHandlePivot(lever);

      // ── Highlight ────────────────────────────────────────────────────────
      const meshes = [];
      lever.root.traverse((child) => { if (child.isMesh) meshes.push(child); });
      const highlightMats = prepareHighlightMaterials(meshes);
      // ─────────────────────────────────────────────────────────────────────

      const interactableData = {
        type: 'lever',
        getPrompt: () => {
          if (lever.isActivated) return 'The lever is already activated';
          if (typeof lever.isBlocked === 'function' && lever.isBlocked()) {
            return 'The lever is blocked by something in front';
          }
          return 'Press E to activate the lever';
        },
        canInteract: () => {
          if (lever.isActivated) return false;
          if (typeof lever.isBlocked === 'function' && lever.isBlocked()) return false;
          return true;
        },
        interact: () => lever.activate(),
        setHighlightT: (t) => applyHighlight(highlightMats, t)
      };

      lever.root.traverse((child) => {
        if (!child.isMesh) return;
        child.userData.interactable = interactableData;
        interactableMeshes.push(child);
      });
    },
    undefined,
    (error) => {
      console.error('Errore nel caricamento della leva:', error);
      if (showErrorOverlay) {
        showErrorOverlay('Impossibile caricare il modello 3D della leva');
      }
    }
  );

  return lever;
}

function setupLeverHandlePivot(lever) {
  const handleMesh = lever.handleMesh;
  const originalParent = handleMesh.parent;
  if (!originalParent) return;

  originalParent.updateWorldMatrix(true, false);
  handleMesh.updateWorldMatrix(true, false);

  const pivot = new THREE.Object3D();
  originalParent.add(pivot);
  pivot.position.copy(handleMesh.position);
  pivot.position.x -= 0.02;
  pivot.attach(handleMesh);
  pivot.rotation.y = lever.restAngle;
  lever.handlePivot = pivot;
}

function moveTowards(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}