import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareHighlightMaterials, applyHighlight } from '../systems/highlight.js';
import { playSound, startLoopAfterSound, stopLoopingSound } from '../systems/audioManager.js';
import { addToInventory, ITEM_TYPES } from '../ui/inventory.js';

import { unlockAchievement, onWallTorchLit, onHandTorchLit } from '../systems/achievementManager.js';


const DEFAULT_WALL_TORCH_URL = './assets/models/torch/scene.gltf';
const DEFAULT_PICKUP_TORCH_URL = './assets/models/manor_torch/manor_torch.glb';

const loader = new GLTFLoader();
loader.setCrossOrigin('anonymous');
loader.textureLoader = new THREE.TextureLoader();
const cachedTorchScenes = new Map();
const loadingPromises = new Map();

function getCachedTorchScene(url = DEFAULT_WALL_TORCH_URL) {
  return cachedTorchScenes.get(url) ?? null;
}

function cloneTorchModel(url = DEFAULT_WALL_TORCH_URL) {
  const scene = getCachedTorchScene(url);
  return scene ? scene.clone(true) : null;
}

const EMBER_COLORS = [0xff4d1f, 0xff8a1a, 0xffd24a];
const EMBERS_PER_TORCH = 4;    // da 8 → 4: dimezza gli sprite in scena
const EMBER_SPAWN_RATE = 2.5;  // da 5 → 2.5: dimezza gli spawn/secondo
const EMBER_MIN_LIFE   = 0.7;  // leggermente più breve per compensare il pool ridotto
const EMBER_MAX_LIFE   = 1.2;
const EMBER_MIN_SIZE = 0.015;
const EMBER_MAX_SIZE = 0.035;
const EMBER_FLOOR_Y = 0.05;

const _emberWorldPos = new THREE.Vector3();
const _flameWorldPos = new THREE.Vector3();

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function createTorchEmberSystem(torchRoot) {
  const group = new THREE.Group();
  group.name = 'torch-embers';
  torchRoot.add(group);

  const embers = [];

  for (let i = 0; i < EMBERS_PER_TORCH; i += 1) {
    const material = new THREE.SpriteMaterial({
      color: EMBER_COLORS[i % EMBER_COLORS.length],
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    sprite.scale.setScalar(0.001);
    group.add(sprite);

    embers.push({
      sprite,
      velocity: new THREE.Vector3(),
      life: 0,
      maxLife: 1,
      size: 0.05,
      active: false
    });
  }

  return {
    group,
    embers,
    spawnAccumulator: Math.random()
  };
}

function clearTorchEmbers(torch) {
  if (!torch?.emberSystem) return;

  torch.emberSystem.spawnAccumulator = 0;

  for (const ember of torch.emberSystem.embers) {
    ember.active = false;
    ember.sprite.visible = false;
    ember.sprite.material.opacity = 0;
  }
}

// In setTorchLitState, invece di settare opacity direttamente:
export function setTorchLitState(torch, isLit, instant = false, byPlayer = false) {
  if (!torch) return;

  const wasLit = torch.isLit;              // ← leggi lo stato ATTUALE prima di cambiarlo

  if (isLit && !wasLit && byPlayer) {      // ← era spenta, ora si accende, ed è il player
    if (torch.id === 'held-torch') {
      onHandTorchLit();
    } else {
      onWallTorchLit();
    }
  }

  torch.isLit = isLit;
  torch._litTarget = isLit ? 1.0 : 0.0;

  // Gestisce sia wall torches (torch.light) sia held torch (torch.spotLight / torch.fillLight)
  const lights = [];
  if (torch.light)     lights.push(torch.light);
  if (torch.spotLight) lights.push(torch.spotLight);
  if (torch.fillLight) lights.push(torch.fillLight);

  for (const l of lights) {
    l.visible = isLit;
  }

  if (!isLit) {
    clearTorchEmbers(torch);
    torch._litProgress = 0.0;
    
    // In questo modo WebGL include la mesh nel compile() e pre-compila lo shader variant
    if (torch.flamePivot) {
      torch.flamePivot.visible = true;           // ← rimane visibile per il compile
      torch.flamePivot.scale.setScalar(0.0001);  // ← scala quasi zero: non si vede
    }
    if (torch.flameMaterials) {
      for (const mat of torch.flameMaterials) {
        mat.opacity = 0;
        mat.transparent = true;                  // già presente, lo confermiamo
        mat.depthWrite = false;                  // già presente, lo confermiamo
        if ('emissiveIntensity' in mat) mat.emissiveIntensity = 0;
      }
    }

  } else {
    // instant = true: usato per torce che nascono già accese, salta la transizione
    torch._litProgress = instant ? 1.0 : 0.0;
    if (torch.flamePivot) {
      torch.flamePivot.visible = true;
      torch.flamePivot.scale.copy(torch.baseFlameScale);
    }
    if (instant && torch.flameMaterials) {
      for (const mat of torch.flameMaterials) {
        mat.opacity = 1.0;
        if ('emissiveIntensity' in mat) {
          mat.emissiveIntensity = torch.baseEmissiveIntensity;
        }
      }
    }
  }
}

function spawnEmber(torch) {
  const system = torch.emberSystem;
  if (!system) return;

  let ember = system.embers.find((item) => !item.active);
  if (!ember) {
    ember = system.embers[Math.floor(Math.random() * system.embers.length)];
  }

  const flameWorld = _flameWorldPos;

  if (torch.flamePivot) {
    torch.flamePivot.getWorldPosition(flameWorld);
    flameWorld.y += 0.18;
    flameWorld.addScaledVector(torch.wallNormal, 0.20);
  } else {
    torch.group.getWorldPosition(flameWorld);
    flameWorld.y += 1.55;
    flameWorld.addScaledVector(torch.wallNormal, 0.42);
  }

  const localSpawn = torch.group.worldToLocal(flameWorld.clone());

  localSpawn.x += randomRange(-0.03, 0.03);
  localSpawn.y += randomRange( 0.10, 0.07);
  localSpawn.z += randomRange(-0.10, 0.03);

  ember.sprite.position.copy(localSpawn);
  ember.sprite.visible = true;

  ember.life = 0;
  ember.maxLife = randomRange(EMBER_MIN_LIFE, EMBER_MAX_LIFE);
  ember.size = randomRange(EMBER_MIN_SIZE, EMBER_MAX_SIZE);
  ember.active = true;

  ember.sprite.scale.setScalar(ember.size);
  ember.sprite.material.opacity = randomRange(0.65, 0.9);
  ember.sprite.material.color.setHex(
    EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)]
  );

  ember.velocity.copy(torch.wallNormal).multiplyScalar(randomRange(0.015, 0.05));
  ember.velocity.x += randomRange(-0.03, 0.03);
  ember.velocity.z += randomRange(-0.03, 0.03);
  ember.velocity.y = -randomRange(0.18, 0.35);
}

export function updateTorchEmbers(torch, deltaTime) {
  const system = torch.emberSystem;
  if (!system || !torch.isLit) return;

  system.spawnAccumulator += deltaTime * EMBER_SPAWN_RATE;

  while (system.spawnAccumulator >= 1) {
    spawnEmber(torch);
    system.spawnAccumulator -= 1;
  }

  for (const ember of system.embers) {
    if (!ember.active) continue;

    ember.life += deltaTime;

    ember.velocity.y -= 0.22 * deltaTime;
    ember.sprite.position.addScaledVector(ember.velocity, deltaTime);

    const lifeT = ember.life / ember.maxLife;
    const fade = 1.0 - lifeT;

    ember.sprite.material.opacity = Math.max(0, fade * 0.9);

    const currentSize = ember.size * (0.85 + fade * 0.35);
    ember.sprite.scale.set(currentSize, currentSize, currentSize);

    ember.sprite.getWorldPosition(_emberWorldPos);

    if (_emberWorldPos.y <= EMBER_FLOOR_Y || lifeT >= 1) {
      ember.active = false;
      ember.sprite.visible = false;
      ember.sprite.material.opacity = 0;
    }
  }
}



function removeTorchFromStateList(state, torch) {
  if (!state.torches) return;

  const index = state.torches.indexOf(torch);
  if (index >= 0) {
    state.torches.splice(index, 1);
  }
}

function removeTorchMeshesFromInteractables(state, root) {
  root.traverse((child) => {
    if (!child.isMesh) return;

    const index = state.interactableMeshes.indexOf(child);
    if (index >= 0) {
      state.interactableMeshes.splice(index, 1);
    }

    delete child.userData.interactable;
  });
}

function cloneViewMaterial(material) {
  const cloned = material.clone();
  cloned.depthTest = false;
  cloned.depthWrite = false;
  cloned.fog = false;
  cloned.transparent = true;
  return cloned;
}

function setupViewTorchRendering(object3D) {
  object3D.renderOrder = 10000;

  object3D.traverse((child) => {
    if (!child.isMesh) return;

    child.renderOrder = 10000;
    child.frustumCulled = false;
    child.castShadow = false;
    child.receiveShadow = false;

    if (Array.isArray(child.material)) {
      child.material = child.material.map(cloneViewMaterial);
    } else if (child.material) {
      child.material = cloneViewMaterial(child.material);
    }
  });
}

function isFlameLikeName(value = '') {
  return value.toLowerCase().includes('flame');
}

function findFlamePivot(root) {
  let exactNode =
    root.getObjectByName('flames') ||
    root.getObjectByName('flame') ||
    root.getObjectByName('Flame');

  if (exactNode) return exactNode;

  let fallback = null;
  root.traverse((child) => {
    if (fallback) return;

    const nodeName = child.name ? child.name.toLowerCase() : '';
    const materialName = child.material?.name ? child.material.name.toLowerCase() : '';

    if (isFlameLikeName(nodeName) || isFlameLikeName(materialName)) {
      fallback = child;
    }
  });

  return fallback;
}

function collectFlameMaterials(root) {
  const materials = [];

  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const nodeName = child.name ? child.name.toLowerCase() : '';
    const materialName = child.material.name ? child.material.name.toLowerCase() : '';

    if (isFlameLikeName(nodeName) || isFlameLikeName(materialName)) {
      child.material = child.material.clone();
      child.material.transparent = true;
      child.material.depthWrite = false;
      child.material.side = THREE.DoubleSide;
      materials.push(child.material);
    }
  });

  return materials;
}

export function makeWallTorchIgnitionSource(torch, state) {
  if (!torch || !torch.group) return torch;
  if (torch.isIgnitionSource) return torch;

  torch.isIgnitionSource = true;

  const interactable = {
    type: 'torch-ignition',

    getPrompt: () => {
      // Nessun prompt se la torcia non è equipaggiata in mano
      if (!state.isTorchEquipped || !state.heldTorch) return '';

      if (!state.heldTorch.isLit && torch.isLit)  return 'Press E to turn on your torch';
      if (state.heldTorch.isLit  && !torch.isLit) return 'Press E to light the torch on the wall';
      return '';
    },

    canInteract: () => {
      // La torcia deve essere equipaggiata in secondary (mano sinistra),
      // non basta averla nello zaino
      if (!state.isTorchEquipped || !state.heldTorch) return false;

      const canLightHeld  = !state.heldTorch.isLit && torch.isLit;
      const canLightWall  = state.heldTorch.isLit  && !torch.isLit;
      return canLightHeld || canLightWall;
    },

    interact: () => {
      if (!state.hasTorch || !state.heldTorch) return;

      if (!state.heldTorch.isLit && torch.isLit) {
        setTorchLitState(state.heldTorch, true, false, true);
        // Ignition → poi loop torcia in mano
        startLoopAfterSound(
          'fireIgnition', 'torchOnView',
          { volume: 0.75 },
          { volume: 0.35 }
        );
        return;
      }

      if (state.heldTorch.isLit && !torch.isLit) {
        setTorchLitState(torch, true, false, true);
        playSound('fireIgnition', { volume: 0.75 });
      }
    }
  };

  torch.group.traverse((child) => {
    if (!child.isMesh) return;
    child.userData.interactable = interactable;
    state.interactableMeshes.push(child);
  });

  return torch;
}

export function ensureViewTorch(
  state,
  {
    modelUrl = DEFAULT_PICKUP_TORCH_URL,
    holderPosition = new THREE.Vector3(-0.66, -0.40, -0.82),
    holderRotation = new THREE.Euler(0.10, -0.18, 0.02),
    modelScale = 0.014,
    modelPosition = new THREE.Vector3(0.0, -0.20, -0.02),
    modelRotation = new THREE.Euler(0.18, Math.PI * 0.96, 0.06),
    lightIntensity = 3.4,
    lightDistance = 6.0,
    lightDecay = 2.2,
    lightOffset = null 
  } = {}
) {
  if (!state.camera) return null;
  if (state.heldTorch) return state.heldTorch;

  const model = cloneTorchModel(modelUrl);
  if (!model) return null;

  const holder = new THREE.Group();
  holder.name = 'view-torch-holder';
  holder.position.copy(holderPosition);
  holder.rotation.copy(holderRotation);
  holder.visible = false;

  model.scale.setScalar(modelScale);
  model.position.copy(modelPosition);
  model.rotation.copy(modelRotation);
  holder.add(model);

  setupViewTorchRendering(holder);

  const flamePivot = findFlamePivot(model);
  const flameMaterials = collectFlameMaterials(model);
  const emberSystem = null;

  // Luce principale direzionale — non trapassa i muri
  const spotLight = new THREE.SpotLight(0xffb45e, 4.5, 6.0, Math.PI * 0.30, 0.99, 2.2);
  spotLight.castShadow = false;   // ← TOLTO castShadow, era la causa del lag
  spotLight.position.set(0.5, 0.35, 0.45);
  spotLight.target.position.set(0.5, -0.1, -1.0);
  spotLight.visible = false;      // ← spenta subito, prima di setTorchLitState
  holder.add(spotLight);
  holder.add(spotLight.target);

  const fillLight = new THREE.PointLight(0xff9a3a, 1.4, 3.8, 2.5);
  fillLight.castShadow = false;
  fillLight.position.set(0.5, 0.35, 0.45);
  fillLight.visible = false;      // ← spenta subito
  holder.add(fillLight);


  state.camera.add(holder);

  const torch = {
    id: 'held-torch',
    group: holder,
    model,
    flamePivot,
    flameMaterials,
    spotLight,
    fillLight,
    wallNormal: new THREE.Vector3(0, 0, -1),
    emberSystem,
    baseIntensity: lightIntensity,
    baseDistance: lightDistance,
    baseEmissiveIntensity: 1.0,
    baseFlameScale: flamePivot ? flamePivot.scale.clone() : new THREE.Vector3(1, 1, 1),
    baseFlameRotationX: flamePivot ? flamePivot.rotation.x : 0,
    baseFlameRotationY: flamePivot ? flamePivot.rotation.y : 0,
    baseFlameRotationZ: flamePivot ? flamePivot.rotation.z : 0,
    timeOffset: Math.random() * Math.PI * 2,
    isPortable: true,
    isLit: false,
    _litProgress: 0.0,
    _litTarget: 0.0,
    
  };

  if (!state.torches) {
    state.torches = [];
  }

  state.torches.push(torch);
  state.heldTorch = torch;
  state.viewTorchHolder = holder;

  if (torch.flamePivot) {
    torch.baseFlameScale.multiplyScalar(0.85);
    torch.flamePivot.scale.copy(torch.baseFlameScale);
  }

  setTorchLitState(torch, false);

  return torch;
}

export function prewarmViewTorch(state, modelUrl = DEFAULT_PICKUP_TORCH_URL) {
  if (state.heldTorch) return;

  const model = cloneTorchModel(modelUrl);
  if (!model) return;

  // Crea la struttura completa ma tenila nascosta
  ensureViewTorch(state, {
    modelUrl,
    modelScale: 0.014,
    holderPosition: new THREE.Vector3(-0.66, -0.40, -0.80),
    holderRotation: new THREE.Euler(0.10, -0.18, 0.02),
    modelPosition: new THREE.Vector3(0.0, -0.20, -0.02),
    modelRotation: new THREE.Euler(0.24, Math.PI * 0.92, 0.24),
    lightIntensity: 4.4,
    lightDistance: 12.0,
    lightDecay: 1.8,
    lightOffset: new THREE.Vector3(0.02, 1.8, 0.34)
  });

  // La teniamo nascosta fino al pickup reale
  if (state.heldTorch?.group) {
    state.heldTorch.group.visible = false;
    state.hasTorch = false;
    state.isTorchEquipped = false;
  }
}



export function makeTorchPickupable(torch, state) {
  if (!torch || !torch.group || !torch.model) return torch;
  if (torch.isPickupable) return torch;

  torch.isPickupable = true;

  // ── Highlight ──────────────────────────────────────────────────────────
  const meshes = [];
  torch.group.traverse((child) => { if (child.isMesh) meshes.push(child); });
  const highlightMats = prepareHighlightMaterials(meshes);
  // ───────────────────────────────────────────────────────────────────────

  const interactable = {
    type: 'torch-pickup',
    getPrompt: () => 'Press E to collect the torch',
    canInteract: () => !state.hasTorch,

    interact: () => {
      if (state.hasTorch) return;
      playSound('pickupItem', { volume: 0.6 });
      removeTorchMeshesFromInteractables(state, torch.group);
      removeTorchFromStateList(state, torch);
      torch.group.parent?.remove(torch.group);
      if (state.heldTorch?.group) state.heldTorch.group.visible = false;

      
      unlockAchievement('PICK_TORCH'); // ← questa riga basta

      addToInventory(state, ITEM_TYPES.TORCH);
    },
    setHighlightT: (t) => applyHighlight(highlightMats, t)
  };

  torch.group.traverse((child) => {
    if (!child.isMesh) return;
    child.userData.interactable = interactable;
    state.interactableMeshes.push(child);
  });

  return torch;
}

export function updatePortableTorch(state) {
  if (!state.heldTorch?.group) return;
  state.heldTorch.group.visible = state.hasTorch && state.isTorchEquipped;
}

export async function preloadTorchModel(
  url = DEFAULT_WALL_TORCH_URL
) {
  if (cachedTorchScenes.has(url)) {
    return cachedTorchScenes.get(url);
  }

  if (!loadingPromises.has(url)) {
    const promise = new Promise((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          const scene = gltf.scene;

          scene.traverse((child) => {
            if (!child.isMesh) return;
            child.castShadow = false;
            child.receiveShadow = false;

            // Forza transparent su tutti i materiali fiamma già in fase di load
            const mats = Array.isArray(child.material)
              ? child.material
              : [child.material];

            for (const mat of mats) {
              if (!mat) continue;
              mat.transparent = true;
              mat.depthWrite = false;
              // Tenere opacity a 1 durante il warmup; setTorchLitState la metterà a 0 dopo
            }
          });

          cachedTorchScenes.set(url, scene);
          resolve(scene);
        },
        undefined,
        reject
      );
    });

    loadingPromises.set(url, promise);
  }

  return loadingPromises.get(url);
}

export async function createTorchInstance({
  state,
  x,
  y,
  z,
  normalX,
  normalZ,
  id = null,
  modelUrl = DEFAULT_WALL_TORCH_URL,
  scale = 0.35,
  modelOffset = 0.52,
  lightColor = 0xffb45e,
  lightIntensity = 2.6,
  lightDistance = 9.0,
  lightDecay = 1.8,
  lightOffset = new THREE.Vector3(0, 0.42, 0.36),
  startLit = true
}) {
  await preloadTorchModel(modelUrl);

  const torchRoot = new THREE.Group();
  torchRoot.position.set(x, y, z);

  const normal = new THREE.Vector3(normalX, 0, normalZ).normalize();
  const outwardAngle = Math.atan2(normal.x, normal.z);

  const model = cloneTorchModel(modelUrl);

  model.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow    = false;  // le torce non proiettano ombre
    child.receiveShadow = false;  // né le ricevono
  });

  if (!model) return null;

  model.rotation.y = outwardAngle;
  model.scale.setScalar(scale);
  model.position.copy(normal).multiplyScalar(modelOffset);

  torchRoot.add(model);
  state.scene.add(torchRoot);

  const flamePivot = findFlamePivot(model);
  const emberSystem = createTorchEmberSystem(torchRoot);
  const flameMaterials = collectFlameMaterials(model);

  const light = new THREE.PointLight(
    lightColor,
    lightIntensity,
    lightDistance,
    lightDecay
  );

  if (flamePivot) {
    light.position.copy(lightOffset);
    flamePivot.add(light);
  } else {
    light.position.copy(lightOffset);
    torchRoot.add(light);
  }

  const torch = {
    id,
    group: torchRoot,
    model,
    flamePivot,
    flameMaterials,
    light,
    wallNormal: normal.clone(),
    emberSystem,
    baseIntensity: lightIntensity,
    baseDistance: lightDistance,
    baseEmissiveIntensity: 1.0,
    baseFlameScale: flamePivot ? flamePivot.scale.clone() : new THREE.Vector3(1, 1, 1),
    baseFlameRotationX: flamePivot ? flamePivot.rotation.x : 0,
    baseFlameRotationY: flamePivot ? flamePivot.rotation.y : 0,
    baseFlameRotationZ: flamePivot ? flamePivot.rotation.z : 0,
    timeOffset: Math.random() * Math.PI * 2,
    isPortable: false,
    isPickupable: false,
    modelUrl,
    isLit: startLit,
    _litProgress: startLit ? 1.0 : 0.0,   
    _litTarget: startLit ? 1.0 : 0.0  
  };

  if (!state.torches) {
    state.torches = [];
  }

  state.torches.push(torch);
  setTorchLitState(torch, startLit, startLit); // instant=true solo se startLit=true
  return torch;
}