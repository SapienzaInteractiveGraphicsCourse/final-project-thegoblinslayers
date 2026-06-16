import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { playSound } from '../systems/audioManager.js';

const gltfLoader = new GLTFLoader();

export function createDoor({
  scene,
  registerObstacle,
  position = new THREE.Vector3(0, 0, -12),
  rotation = new THREE.Euler(0,Math.PI,0), // parameter for the orientation of the door
  showErrorOverlay
}) {
  const door = {
    group: null,
    leftPivot: null,
    rightPivot: null,
    leftLeaf: null,
    rightLeaf: null,

    openingWidth: 2.4,
    openingHeight: 2.8,
    centerGap: 0.01,

    leftClosedAngle: 0,
    rightClosedAngle: 0,
    leftOpenAngle: -Math.PI / 2,
    rightOpenAngle: Math.PI / 2,
    rotationSpeed: 2.2,

    isOpen: false,
    isAnimating: false,   
    isClosing: false,
    

    open() {
      if (this.isOpen) return;
      this.isOpen = true;          // blocca chiamate multiple
      setTimeout(() => {
        this.isAnimating = true;   // sblocca l'animazione dopo 1s
        playSound('doorOpen', { volume: 0.85 });
      }, 1000);
      
      // Evil Laugh: parte dopo 1000ms (delay porta) + ~800ms (durata animazione apertura)
      // = 1800ms dal momento in cui open() viene chiamato
      setTimeout(() => {
        const laugh = new Audio('./assets/audio/Evil_Laugh.mp3');
        laugh.volume = 0.9;
        laugh.play();
        // Stop automatico dopo 3 secondi
        setTimeout(() => {
          laugh.pause();
          laugh.currentTime = 0;
          }, 3500);
      }, 1800);

    },

close() {
  if (!this.isOpen) return;       // già chiusa, no-op
  this.isOpen      = false;
  this.isAnimating = false;       // ferma apertura in corso
  this.isClosing   = true;
  playSound('doorOpen', { volume: 0.6 });  // suono opzionale richiusura
},

// ── reset() — nuovo metodo per il respawn ────────────────────────────────
reset() {
  this.isOpen      = false;
  this.isAnimating = false;
  this.isClosing   = false;
  // Riporta i pivot alla posizione chiusa immediatamente
  if (this.leftPivot)  this.leftPivot.rotation.y  = this.leftClosedAngle;
  if (this.rightPivot) this.rightPivot.rotation.y = this.rightClosedAngle;
},

// ── update() ────────────────
update(deltaTime) {
  const step = this.rotationSpeed * deltaTime;

  // ── Apertura ──────────────────────────────────────────────────────────
  if (this.isAnimating) {
    let leftDone  = false;
    let rightDone = false;

    if (this.leftPivot) {
      const next = moveTowards(this.leftPivot.rotation.y, this.leftOpenAngle, step);
      this.leftPivot.rotation.y = next;
      leftDone = Math.abs(next - this.leftOpenAngle) < 0.001;
    }
    if (this.rightPivot) {
      const next = moveTowards(this.rightPivot.rotation.y, this.rightOpenAngle, step);
      this.rightPivot.rotation.y = next;
      rightDone = Math.abs(next - this.rightOpenAngle) < 0.001;
    }

    // Animazione apertura completata
    if (leftDone && rightDone) {
      this.isAnimating = false;
    }
    return;
  }

  // ── Chiusura ──────────────────────────────────────────────────────────
  if (this.isClosing) {
    let leftDone  = false;
    let rightDone = false;

    if (this.leftPivot) {
      const next = moveTowards(this.leftPivot.rotation.y, this.leftClosedAngle, step);
      this.leftPivot.rotation.y = next;
      leftDone = Math.abs(next - this.leftClosedAngle) < 0.001;
    }
    if (this.rightPivot) {
      const next = moveTowards(this.rightPivot.rotation.y, this.rightClosedAngle, step);
      this.rightPivot.rotation.y = next;
      rightDone = Math.abs(next - this.rightClosedAngle) < 0.001;
    }

    // Animazione chiusura completata
    if (leftDone && rightDone) {
      this.isClosing = false;
      // La porta è fisicamente chiusa: i pivot sono già registrati come obstacle,
      // quindi il player non può passare attraverso — nessuna azione extra richiesta.
    }
  }
},
  };

  gltfLoader.load(
    './assets/models/medieval-door/scene.gltf',
    (gltf) => {
      const sourceScene = gltf.scene;
      const sourceLeafNode = findDoorLeafNode(sourceScene);

      if (!sourceLeafNode) {
        if (showErrorOverlay) {
          showErrorOverlay('Nodo anta della porta non trovato nel modello');
        }
        return;
      }

      door.group = new THREE.Group();
      door.group.position.copy(position);
      door.group.rotation.copy(rotation);
      scene.add(door.group);

      door.leftPivot = new THREE.Object3D();
      door.rightPivot = new THREE.Object3D();

      door.group.add(door.leftPivot);
      door.group.add(door.rightPivot);

      const targetLeafWidth = door.openingWidth * 0.5 - door.centerGap * 0.5;

      door.leftLeaf = createDoorLeafInstance(
        sourceLeafNode,
        targetLeafWidth,
        door.openingHeight,
        false
      );

      door.rightLeaf = createDoorLeafInstance(
        sourceLeafNode,
        targetLeafWidth,
        door.openingHeight,
        true
      );

      door.leftPivot.position.set(-door.openingWidth * 0.5, 0, 0);
      door.rightPivot.position.set(door.openingWidth * 0.5, 0, 0);

      door.leftPivot.add(door.leftLeaf);
      door.rightPivot.add(door.rightLeaf);

      if (registerObstacle) {
        registerObstacle(door.leftPivot);
        registerObstacle(door.rightPivot);
      }
    },
    undefined,
    (error) => {
      console.error('Errore nel caricamento della porta:', error);
      if (showErrorOverlay) {
        showErrorOverlay('Impossibile caricare il modello 3D della porta');
      }
    }
  );

  return door;
}

function logSceneGraphNames(root) {
  console.log('--- Scene Graph Porta ---');
  root.traverse((child) => {
    console.log(child.type, '|', child.name);
  });
  console.log('-------------------------');
}

// function loadDoubleDoorModel() {
//   gltfLoader.load(
//     './assets/models/medieval-door/scene.gltf',
//     (gltf) => {
//     const sourceScene = gltf.scene;

//     logSceneGraphNames(sourceScene);

//     const sourceLeafNode = findDoorLeafNode(sourceScene);

//     if (!sourceLeafNode) {
//       console.error('Nodo anta non trovato nel modello porta');
//       showErrorOverlay('Nodo anta della porta non trovato nel modello');
//       return;
//     }

//     console.log('Nodo anta trovato:', sourceLeafNode.name, sourceLeafNode);

//       doorGroup = new THREE.Group();
//       doorGroup.position.copy(DOOR_POSITION);
//       scene.add(doorGroup);

//       leftDoorPivot = new THREE.Object3D();
//       rightDoorPivot = new THREE.Object3D();

//       doorGroup.add(leftDoorPivot);
//       doorGroup.add(rightDoorPivot);

//       const targetLeafWidth = DOOR_OPENING_WIDTH * 0.5 - DOOR_CENTER_GAP * 0.5;

//       leftDoorLeaf = createDoorLeafInstance(
//         sourceLeafNode,
//         targetLeafWidth,
//         DOOR_OPENING_HEIGHT,
//         false
//       );

//       rightDoorLeaf = createDoorLeafInstance(
//         sourceLeafNode,
//         targetLeafWidth,
//         DOOR_OPENING_HEIGHT,
//         true
//       );

//       leftDoorPivot.position.set(-DOOR_OPENING_WIDTH * 0.5 , 0, 0);
//       rightDoorPivot.position.set(DOOR_OPENING_WIDTH * 0.5 , 0, 0);

//       leftDoorPivot.add(leftDoorLeaf);
//       rightDoorPivot.add(rightDoorLeaf);

//       leftDoorPivot.rotation.y = LEFT_DOOR_CLOSED_ANGLE;
//       rightDoorPivot.rotation.y = RIGHT_DOOR_CLOSED_ANGLE;

//       registerObstacle(leftDoorPivot);
//       registerObstacle(rightDoorPivot);

//       console.log('Doppia porta caricata correttamente');
//     },
//     undefined,
//     (error) => {
//       console.error('Errore nel caricamento della porta GLTF:', error);
//       showErrorOverlay('Impossibile caricare il modello 3D della porta');
//     }
//   );
// }


function findDoorLeafNode(root) {
  let found = root.getObjectByName('Cube004__0');
  if (found) return found;

  found = root.getObjectByName('Cube004');
  if (found) return found;

  root.traverse((child) => {
    if (found) return;
    if (
      child.name === 'Cube004__0' ||
      child.name === 'Cube004' ||
      child.name.startsWith('Cube004')
    ) {
      found = child;
    }
  });

  return found;
}

function createDoorLeafInstance(sourceLeafNode, targetWidth, targetHeight, mirrored = false) {
  const container = new THREE.Group();
  const leafNode = sourceLeafNode.clone(true);

  leafNode.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });

  container.add(leafNode);

  leafNode.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(leafNode);
  const size = new THREE.Vector3();
  box.getSize(size);

  const scaleFactor = Math.min(
    targetWidth / size.x,
    targetHeight / size.y
  );

  leafNode.position.x -= box.min.x;
  leafNode.position.y -= box.min.y;
  leafNode.position.z -= (box.min.z + box.max.z) * 0.5;

  container.scale.setScalar(scaleFactor);

  if (mirrored) {
    container.scale.x *= -1;
  }

  return container;
}

function moveTowards(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) {
    return target;
  }

  return current + Math.sign(target - current) * maxDelta;
}


function updateLeverAndDoor(deltaTime) {
  const targetLeverAngle = isLeverActivated
    ? LEVER_HANDLE_ACTIVE_ANGLE
    : LEVER_HANDLE_REST_ANGLE;

  const leverStep = LEVER_HANDLE_ROTATION_SPEED * deltaTime;

  if (leverHandlePivot) {
    leverHandlePivot.rotation.y = moveTowards(
      leverHandlePivot.rotation.y,
      targetLeverAngle,
      leverStep
    );
  }

  const leftTargetAngle = isLeverActivated
    ? LEFT_DOOR_OPEN_ANGLE
    : LEFT_DOOR_CLOSED_ANGLE;

  const rightTargetAngle = isLeverActivated
    ? RIGHT_DOOR_OPEN_ANGLE
    : RIGHT_DOOR_CLOSED_ANGLE;

  const doorStep = DOOR_ROTATION_SPEED * deltaTime;

  if (leftDoorPivot) {
    leftDoorPivot.rotation.y = moveTowards(
      leftDoorPivot.rotation.y,
      leftTargetAngle,
      doorStep
    );
  }

  if (rightDoorPivot) {
    rightDoorPivot.rotation.y = moveTowards(
      rightDoorPivot.rotation.y,
      rightTargetAngle,
      doorStep
    );
  }
}
