import * as THREE from 'three';
import { ROOM_HEIGHT, PASSAGE_WIDTH } from '../core/config.js';
import {
  createTorchInstance,
  updateTorchEmbers,
  makeWallTorchIgnitionSource,
  setTorchLitState
} from './torch.js';
import { createChandelier, updateChandeliers } from './chandelier.js';
import { createShieldPickup } from './shield.js';
import { createPaper } from './paper.js';
import { createSwordPickup } from './sword.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createGargoyleStatues } from './gargoyle_statue.js';
import { createSpikes } from './spikes.js';
// import { depth } from 'three/src/nodes/display/ViewportDepthNode.js';

export function createLights(state) {
  const roomOneCenterLight = new THREE.PointLight(
    0xffc27a,
    0.8,
    18,
    1.8
  );

  roomOneCenterLight.position.set(0, 2.6, 0);
  roomOneCenterLight.castShadow = true;

  roomOneCenterLight.shadow.mapSize.width = 1024;
  roomOneCenterLight.shadow.mapSize.height = 1024;
  roomOneCenterLight.shadow.bias = -0.0008;

  state.scene.add(roomOneCenterLight);

  state.roomOneCenterLight = roomOneCenterLight;
}

function loadTextureAsync(loader, url, isColorTexture = false) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        if (isColorTexture) {
          if ('colorSpace' in texture) {
            texture.colorSpace = THREE.SRGBColorSpace;
          } else if ('encoding' in texture) {
            texture.encoding = THREE.sRGBEncoding;
          }
        }

        resolve(texture);
      },
      undefined,
      reject
    );
  });
}

async function loadFloorTextures(state) {
  const loader = new THREE.TextureLoader();

  [
    state.floorAlbedoBase,
    state.floorDisplacementBase,
    state.floorNormalBase,
    state.floorRoughnessBase
  ] = await Promise.all([
    loadTextureAsync(loader, './textures/stone_floor_4k/textures/stone_floor_diff_4k.jpg', true),
    loadTextureAsync(loader, './textures/stone_floor_4k/textures/stone_floor_disp_4k.png'),
    loadTextureAsync(loader, './textures/stone_floor_4k/textures/stone_floor_nor_gl_4k.png'),
    loadTextureAsync(loader, './textures/stone_floor_4k/textures/stone_floor_rough_4k.png')
  ]);

}

async function loadWallTextures(state) {
  const loader = new THREE.TextureLoader();

  [
    state.wallAlbedoBase,
    state.wallNormalBase,
    state.wallRoughnessBase
  ] = await Promise.all([
    loadTextureAsync(loader, './textures/rock_wall_08_4k/textures/rock_wall_08_diff_4k.jpg', true),
    loadTextureAsync(loader, './textures/rock_wall_08_4k/textures/rock_wall_08_nor_gl_4k.png'),
    loadTextureAsync(loader, './textures/rock_wall_08_4k/textures/rock_wall_08_rough_4k.png')
  ]);
}

async function createRoomOneFloorTorch(state) {
  const floorTorch = await createTorchInstance({
    state,
    x: 1.85,
    y: 0.12,
    z: 0.95,
    
    normalX: 0,
    normalZ: -1,
    id: 'room1-floor-torch',
    modelUrl: './assets/models/manor_torch/manor_torch.glb',
    scale: 0.02,
    modelOffset: 0.0,
    lightIntensity: 3.5,
    lightDistance: 11.0,
    lightDecay: 1.8,
    lightOffset: new THREE.Vector3(0, 1.2, 0.0),
    startLit: false
  });

  if (!floorTorch) return null;

  floorTorch.group.rotation.set(0, Math.PI * 0.28, Math.PI * 0.5);

  return floorTorch;
}

// Carica e posiziona la collezione di crani sul muro sinistro della stanza 1.
async function createSkullsDecoration(state, registerObstacle) {
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
        // Box3.setFromObject() calcola la AABB in world-space tenendo conto
        // di scala e rotazione del model root — nessun calcolo manuale necessario.
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

async function createOldBed(state, registerObstacle) {
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

export async function createDungeon(state, registerObstacle) {
  await loadFloorTextures(state);
  await loadWallTextures(state);

  createFloorLayout(state);
  createRoomOne(state, registerObstacle);
  createCorridor(state, registerObstacle);
  createRoomTwo(state, registerObstacle);
  //createRoomTwoProps(state, registerObstacle);
  createCeilingLayout(state);
  await createWallTorches(state);
  //createRoomTwoPressurePlate(state);

  state.roomOnePickupTorch = await createRoomOneFloorTorch(state);

  createPaper(state.scene, state);

  await createChandelier({
    state,
    x: 0,
    y: ROOM_HEIGHT - 1.8,  // agganciato al soffitto
    z: 0,
    scale: 0.055
  });

await createChandelier( { state, x: 21.541, y: ROOM_HEIGHT - 1.8, z: -25.077, scale: 0.055 }); // stanza 2


  // elements in the first room
  await createGargoyleStatues(state, registerObstacle);
  await createSpikes(state, registerObstacle);
  
  await createSkullsDecoration(state, registerObstacle);
  await createOldBed(state, registerObstacle);

  // Scudo sul muro destro della stanza 1 (opposto alla leva)
  // x: 11.7 = appoggiato al muro a x:12, z: 1 = altezza occhi
  state.shieldPickup = createShieldPickup({
    state,
    position: new THREE.Vector3(7.0, 1.55, -11.5),
    rotationZ: -Math.PI  // faccia verso il centro della stanza (verso X negativo)
  });


  // Posizione: muro sinistro (x = -12), tra torcia spenta (z=0) e torcia accesa (z=8.8)
  // x: -11.5 → 0.5 unità dal muro, la spada non interseca la geometria del muro
  // y:  0.0  → il root è a terra; sword.js gestisce l'altezza del manico tramite rotation
  // z:  4.5  → a metà tra le due torce, ben visibile

state.swordPickup = createSwordPickup({
  state,
  position:   new THREE.Vector3(10.2, 0.70, 9.8),
  wallNormal: null   // sdraiata a terra
});

}

function createFloorMaterial(state, repeatX, repeatY) {
  const albedo = state.floorAlbedoBase.clone();
  albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
  albedo.repeat.set(repeatX, repeatY);

  const displacement = state.floorDisplacementBase.clone();
  displacement.wrapS = displacement.wrapT = THREE.RepeatWrapping;
  displacement.repeat.set(repeatX, repeatY);

  const normal = state.floorNormalBase.clone();
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.repeat.set(repeatX, repeatY);

  const roughness = state.floorRoughnessBase.clone();
  roughness.wrapS = roughness.wrapT = THREE.RepeatWrapping;
  roughness.repeat.set(repeatX, repeatY);

  return new THREE.MeshStandardMaterial({
    map: albedo,
    displacementMap: displacement,
    displacementScale: 0.045,
    normalMap: normal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: roughness,
    roughness: 1.0,
    metalness: 0.04
  });
}

function createWallMaterial(state, width, height, depth, tint = 0xffffff) {
  const horizontalSpan = Math.max(width, depth);
  const verticalSpan = height;

  const repeatX = Math.max(1, horizontalSpan / 4.0);
  const repeatY = Math.max(1, verticalSpan / 3.0);

  const albedo = state.wallAlbedoBase.clone();
  albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
  albedo.repeat.set(repeatX, repeatY);

  const normal = state.wallNormalBase.clone();
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.repeat.set(repeatX, repeatY);

  const roughness = state.wallRoughnessBase.clone();
  roughness.wrapS = roughness.wrapT = THREE.RepeatWrapping;
  roughness.repeat.set(repeatX, repeatY);

  return new THREE.MeshStandardMaterial({
    map: albedo,
    normalMap: normal,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughnessMap: roughness,
    color: tint,
    roughness: 1.0,
    metalness: 0.02
  });
}

function createFloorSection(state, width, depth, x, z, repeatX, repeatY) {
  const geometry = new THREE.PlaneGeometry(width, depth, 96, 96);
  const material = createFloorMaterial(state, repeatX, repeatY);

  const floor = new THREE.Mesh(geometry, material);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(x, 0, z);
  floor.receiveShadow = true;

  state.scene.add(floor);
}

function buildSections(state, sections, createSectionFn) {
  for (const section of sections) {
    createSectionFn(
      state,
      section.width,
      section.depth,
      section.x,
      section.z,
      section.repeatX,
      section.repeatY
    );
  }
}

function buildWalls(state, registerObstacle, wallSpecs) {
  for (const spec of wallSpecs) {
    const material = createWallMaterial(
      state,
      spec.width,
      spec.height,
      spec.depth,
      spec.tint
    );

    createWall(
      state,
      registerObstacle,
      material,
      spec.width,
      spec.height,
      spec.depth,
      spec.x,
      spec.y,
      spec.z
    );
  }
}

// creation of the floor of ALL the dungeon
function getFloorSections() {
  return [
    // Stanza 1
    { width: 24, depth: 24, x: 0, z: 0, repeatX: 6, repeatY: 6 },

    // Corridoio stretto — tratto sopra la nicchia
    { width: 6, depth: 5, x: 0, z: -14.5, repeatX: 1.5, repeatY: 1.25 },

    // Pavimento allargato della nicchia
    { width: 10, depth: 6, x: 0, z: -20, repeatX: 2.5, repeatY: 1.5 },

    // Corridoio stretto — tratto sotto la nicchia
    { width: 6, depth: 5, x: 0, z: -25.5, repeatX: 1.5, repeatY: 1.25 },

    // Braccio orizzontale della L
    { width: 10, depth: 9, x: 8, z: -25, repeatX: 4, repeatY: 2 },

    // Stanza 2 — centrata a x=22, z=-25, dimensioni 18×18
    { width: 18, depth: 18, x: 22, z: -25, repeatX: 4.5, repeatY: 4.5 },

    // uscita
    {width:6, depth:PASSAGE_WIDTH, x:31+3, z:-25, repeatX:1.40, repeatY:0.61}
  ];
}

// creation of the ceiling of ALL the dungeon
function getCeilingSections() {
  return [
    // Stanza 1
    { width: 24, depth: 24, x: 0, z: 0, repeatX: 4, repeatY: 4 },

    // Corridoio stretto — tratto SOPRA la nicchia (da z=-12 a z=-17)
    { width: 6, depth: 5, x: 0, z: -14.5, repeatX: 1.5, repeatY: 1.25 },

    // Soffitto allargato della nicchia (da z=-17 a z=-23), larghezza 10
    { width: 10, depth: 6, x: 0, z: -20, repeatX: 2.5, repeatY: 1.5 },

    // Corridoio stretto — tratto SOTTO la nicchia (da z=-23 a z=-28)
    { width: 6, depth: 5, x: 0, z: -25.5, repeatX: 1.5, repeatY: 1.25 },

    // Braccio orizzontale della L
    { width: 10, depth: 9, x: 8, z: -25, repeatX: 4, repeatY: 2 },

    // Stanza 2 — centrata a x=22, z=-25, dimensioni 18×18
    { width: 18, depth: 18, x: 22, z: -25, repeatX: 3, repeatY: 3 },
    // uscita
    {width:6, depth:PASSAGE_WIDTH, x:31+3, z:-25, repeatX:1.40, repeatY:0.61}
  ];
}

function getRoomOneWallSpecs() {
  const y = ROOM_HEIGHT * 0.5;
  const openingHalf = PASSAGE_WIDTH * 0.5;
  const frontWallDepth = 1;
  const roomWidth = 24;
  const sideSegmentWidth = (roomWidth - PASSAGE_WIDTH) * 0.5;
  const tint = 0xd6d6d6;

  return [
    { width: 24, height: ROOM_HEIGHT, depth: 1, x: 0, y, z: 12, tint },
    { width: 1, height: ROOM_HEIGHT, depth: 24, x: -12, y, z: 0, tint },
    { width: 1, height: ROOM_HEIGHT, depth: 24, x: 12, y, z: 0, tint },
    {
      width: sideSegmentWidth-0.01,
      height: ROOM_HEIGHT,
      depth: frontWallDepth,
      x: -(openingHalf + sideSegmentWidth * 0.5),
      y,
      z: -12,
      tint
    },
    {
      width: sideSegmentWidth-0.01,
      height: ROOM_HEIGHT,
      depth: frontWallDepth,
      x: openingHalf + sideSegmentWidth * 0.5,
      y,
      z: -12,
      tint
    }
  ];
}

function getCorridorWallSpecs() {
  const y = ROOM_HEIGHT * 0.5;
  const T = 1;                          // wallThickness
  const cH = PASSAGE_WIDTH * 0.5;      // corridorHalf  (es. 1.5 se PASSAGE_WIDTH=3)
  const tint = 0xc8c8c8;
  const endRoom1 = -12;

  // ─── Zona nicchia pendolo ───────────────────────────────────────────────────
  // Il pavimento/soffitto allargato è: width:10 centrato in x:0, z:-20
  // Quindi i muri esterni della nicchia stanno a x = ±5 (bordo del pavimento)
  // meno mezzo spessore muro → x = ±(5 - T*0.5) = ±4.5  ← posizione CENTRO del muro
  const alcoveCenterZ    = -20;
  const alcoveHalfDepth  = 3;          // nicchia da z=-17 a z=-23 (6 unità totali)
  const innerX           = cH + T * 0.5;   // faccia interna del muro corridoio stretto
  const outerX           = 5 - T * 0.5;   // faccia esterna: allineata al bordo del pavimento allargato (width=10 → ±5)

  // ─── Braccio verticale ─────────────────────────────────────────────────────
  // Da z=-12 a z=-28 (16 unità). Si divide in:
  //   • Tratto stretto sopra nicchia:  z = -12 → -17  (depth 5, center -14.5)
  //   • Tratto allargato nicchia:      z = -17 → -23  (depth 6, center -20)
  //   • Tratto stretto sotto nicchia:  z = -23 → -28  (depth 5, center -25.5)

  const topSegZ   = endRoom1  - 2.5;   // -14.5  (center tra -12 e -17)
  const topSegD   = 5;
  const botSegZ   = -25.5;             // center tra -23 e -28
  const botSegD   = 5;

  // ─── Tappi orizzontali delle nicchie ───────────────────────────────────────
  // Ogni tappo collega il muro stretto (innerX) al muro allargato (outerX).
  // Larghezza tappo = outerX - innerX (escluso lo spessore, che è già nei muri verticali)
  const capWidth = (outerX) - (innerX) ;   // ~ 2 unità (da 1.5+0.5=2 a 4.5)
  const capCenterX_left  = -(innerX + capWidth * 0.5);
  const capCenterX_right =  (innerX + capWidth * 0.5);
  const topCapZ          = alcoveCenterZ + alcoveHalfDepth;   // -17
  const botCapZ          = alcoveCenterZ - alcoveHalfDepth;   // -23

  // ─── Braccio orizzontale della L ───────────────────────────────────────────
  // Stessa logica del codice originale, invariata
  const horW1     = 5.2; // I placed the safe place at 5, with width 2, so the first moment I encounter the safe place is at 4. The wall shpuld go from -1.2 to 4 
  const horW2 = 7.49; // starts from 6 and finishes at 16
  const horLowW1  = 1.8; // I placed the safe place at 7, so we first encounter it at 6. The total width is 6-1.2
  const horLowW2 = 5.49; // I placed the safe place at 7, so we met the second part of the wall at 8. The total width is 8.
  const safeW = 2; // I want to position the center of the two safe places at x = 5
  const safeD = 1; // depth
  const horBotZ  = endRoom1 - (16 - 3 - cH - T * 0.5);
  const horTopZ  = endRoom1 - (16 - 3 + cH + T * 0.5);
  const horBotSafeZ = endRoom1 - (16 - 3 - cH - T * 0.5)+1; // z of the bottom wall SAFE PLACE in the second corridor
  const horTopSafeZ = endRoom1 - (16 - 3 + cH + T * 0.5)-1; // z of the top wall SAFE PLACE in the second corridor


  return [
    // ══════════════════════════════════════════════════════
    // LATO SINISTRO
    // ══════════════════════════════════════════════════════

    // Tratto stretto sopra la nicchia (da -12 a -17)
    { width: T, height: ROOM_HEIGHT, depth: topSegD+0.99,  x: -innerX,     y, z: topSegZ,  tint },

    // Muro esterno della nicchia (da -17 a -23)
    { width: T, height: ROOM_HEIGHT, depth: 6,        x: -outerX,     y, z: alcoveCenterZ, tint },

    // Tratto stretto sotto la nicchia (da -23 a -28)
    { width: T, height: ROOM_HEIGHT, depth: botSegD+1.59,  x: -innerX,     y, z: botSegZ,  tint },

    // ══════════════════════════════════════════════════════
    // LATO DESTRO
    // ══════════════════════════════════════════════════════

    // Tratto stretto sopra la nicchia (da -12 a -17)
    { width: T, height: ROOM_HEIGHT, depth: topSegD+0.99,  x: innerX,      y, z: topSegZ,  tint },

    // Muro esterno della nicchia (da -17 a -23)
    { width: T, height: ROOM_HEIGHT, depth: 6,        x: outerX,      y, z: alcoveCenterZ, tint },

    // Tratto stretto sotto la nicchia (da -23 a -28)
    //{ width: T, height: ROOM_HEIGHT, depth: botSegD,  x: innerX,      y, z: botSegZ,  tint },

    // ══════════════════════════════════════════════════════
    // TAPPI ORIZZONTALI (chiudono le nicchie sopra e sotto)
    // ══════════════════════════════════════════════════════

    // Tappo superiore sinistro  (a z = -17)
    { width: capWidth+0.99, height: ROOM_HEIGHT, depth: T, x: capCenterX_left,  y, z: topCapZ, tint },

    // Tappo superiore destro    (a z = -17)
    { width: capWidth+0.99, height: ROOM_HEIGHT, depth: T, x: capCenterX_right, y, z: topCapZ, tint },

    // Tappo inferiore sinistro  (a z = -23)
    { width: capWidth+0.99, height: ROOM_HEIGHT, depth: T+0.6, x: capCenterX_left,  y, z: botCapZ, tint },

    // Tappo inferiore destro    (a z = -23)
    { width: capWidth+2, height: ROOM_HEIGHT, depth: T+0.6, x: capCenterX_right+0.5, y, z: botCapZ, tint },

    // ══════════════════════════════════════════════════════
    // BRACCIO ORIZZONTALE DELLA L
    // ══════════════════════════════════════════════════════

    // { width: horW,    height: ROOM_HEIGHT, depth: T, x: horW * 0.5 - 3, y, z: horTopZ, tint },
    // { width: horLowW, height: ROOM_HEIGHT, depth: T, x: horLowW * 0.5 + cH, y, z: horBotZ, tint }
    {width: safeW, height: ROOM_HEIGHT, depth: T, x: 7, y, z:horBotSafeZ, tint},
    {width: safeW, height: ROOM_HEIGHT, depth: T, x: 5, y, z:horTopSafeZ, tint},
    {width: horW1, height: ROOM_HEIGHT, depth:3, x:horW1*0.5-1.2, y, z:horTopSafeZ, tint},
    {width: horW2, height: ROOM_HEIGHT, depth:3, x:horW2*0.5+6, y, z:horTopSafeZ, tint},
    {width: horLowW2, height: ROOM_HEIGHT, depth:3, x:horLowW2*0.5+8, y, z:horBotSafeZ, tint}
  ];
}

function getRoomTwoWallSpecs() {
  const y = ROOM_HEIGHT * 0.5;
  const tint = 0xbdb7ae;

  // La stanza è 18×18, centrata a x=22, z=-25
  // Muro destro (chiusura):   x = 22 + 9 = 31
  // Muro frontale/posteriore: z = -25 ± 9 = -16 e -34
  // Muro sinistro:            x = 22 - 9 = 13 — si apre con un'apertura da PASSAGE_WIDTH
  // Il corridoio entra da x=13, z=-25 → l'apertura è centrata a z=-25

  const openingHalf = PASSAGE_WIDTH * 0.5; // metà del passaggio (es. 1.5)
  const sideSegmentDepth = (18 - PASSAGE_WIDTH) * 0.5; // segmento sopra e sotto l'apertura

  return [
    // Muro posteriore destro (opposto all'ingresso) — pieno, x=31
    { width: 7, height: ROOM_HEIGHT, depth: sideSegmentDepth, x: 31+3, y, z: -34 + sideSegmentDepth * 0.5, tint },
    //Muro posteriore sinistro (opposto all'ingresso) — pieno, x=31
    { width: 7, height: ROOM_HEIGHT, depth: sideSegmentDepth, x: 31+3, y, z: -16 - sideSegmentDepth * 0.5, tint },

    // Muro frontale superiore: da z=-16 a z=-34 — senza apertura
    { width: 18, height: ROOM_HEIGHT, depth: 1, x: 22, y, z: -16, tint },

    // Muro frontale inferiore
    { width: 18, height: ROOM_HEIGHT, depth: 1, x: 22, y, z: -34, tint },

    // Muro sinistro (lato ingresso) — due segmenti con apertura centrata a z=-25
    // Segmento sopra l'apertura: da z=-16 a z=(-25 + openingHalf) = -23.5
    {
      width: 1,
      height: ROOM_HEIGHT,
      depth: sideSegmentDepth-0.01,
      x: 13,
      y,
      z: -16 - sideSegmentDepth * 0.5,   // centro = -16 - (7.5*0.5) = -19.75
      tint
    },
    // Segmento sotto l'apertura: da z=(-25 - openingHalf) = -26.5 a z=-34
    {
      width: 1,
      height: ROOM_HEIGHT,
      depth: sideSegmentDepth-0.01,
      x: 13,
      y,
      z: -34 + sideSegmentDepth * 0.5,   // centro = -34 + 3.75 = -30.25
      tint
    }
  ];
}

function createFloorLayout(state) {
  buildSections(state, getFloorSections(), createFloorSection);
}

function createCeilingMaterial(state, repeatX, repeatY) {
  const albedo = state.wallAlbedoBase.clone();
  albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
  albedo.repeat.set(repeatX, repeatY);

  const normal = state.wallNormalBase.clone();
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.repeat.set(repeatX, repeatY);

  const roughness = state.wallRoughnessBase.clone();
  roughness.wrapS = roughness.wrapT = THREE.RepeatWrapping;
  roughness.repeat.set(repeatX, repeatY);

  return new THREE.MeshStandardMaterial({
    map: albedo,
    normalMap: normal,
    normalScale: new THREE.Vector2(0.28, 0.28),
    roughnessMap: roughness,
    color: 0x5f6368,
    roughness: 1.0,
    metalness: 0.02,
    side: THREE.DoubleSide
  });
}

function createCeilingSection(state, width, depth, x, z, repeatX, repeatY) {
  const geometry = new THREE.PlaneGeometry(width, depth);
  const material = createCeilingMaterial(state, repeatX, repeatY);

  const ceiling = new THREE.Mesh(geometry, material);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(x, ROOM_HEIGHT - 0.02, z);
  ceiling.receiveShadow = true;

  state.scene.add(ceiling);
}

function createCeilingLayout(state) {
  buildSections(state, getCeilingSections(), createCeilingSection);
}

function createWall(state, registerObstacle, material, width, height, depth, x, y, z) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    material
  );

  wall.position.set(x, y, z);
  wall.castShadow = true;
  wall.receiveShadow = true;

  state.scene.add(wall);
  registerObstacle(wall);

  return wall;
}

async function createTorch(state, x, y, z, normalX, normalZ, id = null) {
  return createTorchInstance({
    state,
    x,
    y,
    z,
    normalX,
    normalZ,
    id,
    modelUrl: './assets/models/torch/scene.gltf',
    scale: 0.9
  });
}

async function createWallTorches(state) {
  const torchHeight = 1.8;
  const loweredTorchHeight = 1.8;
  const wallInset = 0.06;

  const torches = await Promise.all([
    // ── Stanza 1: muro posteriore ──────────────────────────────────────────────
    createTorch(state, 0,    loweredTorchHeight, 12 - wallInset,  0, -1, 'room1-back-center'),
    createTorch(state, -8.8, loweredTorchHeight, 12 - wallInset,  0, -1),
    createTorch(state, 8.8,  loweredTorchHeight, 12 - wallInset,  0, -1),

    // ── Stanza 1: muro sinistro ────────────────────────────────────────────────
    createTorch(state, -12 + wallInset, torchHeight,  0,    1, 0, 'room1-left-center'),
    createTorch(state, -12 + wallInset, torchHeight,  8.8,  1, 0),
    createTorch(state, -12 + wallInset, torchHeight, -8.8,  1, 0),

    // ── Stanza 1: muro destro ──────────────────────────────────────────────────
    createTorch(state, 12 - wallInset, torchHeight,  0,   -1, 0, 'room1-right-center'),
    createTorch(state, 12 - wallInset, torchHeight,  8.8, -1, 0),
    createTorch(state, 12 - wallInset, torchHeight, -8.8, -1, 0),

    // ── Stanza 1: muro frontale (sui due segmenti laterali all'apertura) ───────
    createTorch(state, -(PASSAGE_WIDTH * 0.5 + 0.9), torchHeight, -12 + wallInset, 0, 1),
    createTorch(state,  (PASSAGE_WIDTH * 0.5 + 0.9), torchHeight, -12 + wallInset, 0, 1),

    // ── Corridoio: muri laterali nella zona stretta (sopra le nicchie) ─────────
    // Posizionate sul muro stretto a z=-19, appoggiato alla parete interna
    createTorch(state, -(PASSAGE_WIDTH * 0.5 + 0.5) + wallInset, torchHeight, -15, 1, 0),
    createTorch(state,  (PASSAGE_WIDTH * 0.5 + 0.5) - wallInset, torchHeight, -15, -1, 0),

    // ── Corridoio: torce nelle nicchie del pendolo ─────────────────────────────
    // Muro esterno sinistro della nicchia (x ≈ -4.4, faccia verso destra → normalX: +1)
    createTorch(state, -4.57 + wallInset, torchHeight, -20, 1, 0),

    // Muro esterno destro della nicchia (x ≈ +4.4, faccia verso sinistra → normalX: -1)
    createTorch(state,  4.57 - wallInset, torchHeight, -20, -1, 0),


    // ── Corridoio: fine del braccio verticale (muro che chiude la L) ──────────
    // La svolta avviene intorno a z=-28. Questa torcia illumina l'ingresso al braccio orizzontale.
    createTorch(state, 0, torchHeight, -26.75 + wallInset, 0, 1),

     // ── Corridoio: torce nel secondo corridoio  ─────────────────────────────
    // Muro esterno sinistro della nicchia (x ≈ 8, faccia verso destra → normalX: +1)
    createTorch(state, 10, torchHeight, -(12+16-3+1.2+0.5)+wallInset, 0, 1),
    createTorch(state, 10, torchHeight, -(12+16-3-1.2-0.5)-wallInset, 0, -1),
    createTorch(state, 7, torchHeight, -(12+16-3-1.2-0.5)-wallInset+1, 0, -1),
    createTorch(state, 5, torchHeight, -(12+16-3+1.2+0.5)+wallInset-1,0, 1),


    // ── Stanza 2: muro posteriore (x=31, faccia verso sinistra) ────────────────
    // createTorch(state, 31 - wallInset, torchHeight, -25,     -1, 0),

    // ── Stanza 2: muro frontale superiore (z=-16) ──────────────────────────────
    createTorch(state, 22,             torchHeight, -16 - wallInset, 0, -1),

    // ── Stanza 2: muro frontale inferiore (z=-34) ──────────────────────────────
    createTorch(state, 22,             torchHeight, -34 + wallInset, 0, 1),

    // ── Stanza 2: muro ingresso lato sinistro superiore (x=13) ─────────────────
    createTorch(state, 13 + wallInset, torchHeight, -19,     1, 0),

    // ── Stanza 2: muro ingresso lato sinistro INFERIORE (x=13) ─────────────────
    createTorch(state, 13 + wallInset, torchHeight, -30,  1, 0),

    // ── Stanza 2: muro posteriore (x=31) — torcia inferiore ───────────────────
    createTorch(state, 31 - wallInset, torchHeight, -31,  -1, 0),

    // ── Stanza 2: muro posteriore (x=31) — torcia superiore ───────────────────
    createTorch(state, 31 - wallInset, torchHeight, -19,  -1, 0),
  ]);

  const validTorches = torches.filter(Boolean);
  state.wallTorches = validTorches;

  for (const torch of validTorches) {
    makeWallTorchIgnitionSource(torch, state);
  }

  const puzzleTorchIds = new Set([
    'room1-left-center',
    'room1-right-center'
  ]);

  state.roomOnePuzzleTorches = validTorches.filter((torch) =>
    puzzleTorchIds.has(torch.id)
  );

  for (const torch of state.roomOnePuzzleTorches) {
    torch.isPuzzleTorch = true;
    setTorchLitState(torch, false);
  }

  // ── Torce puzzle stanza 2: si trovano tra le ultime torce dell'array ──────────
  // Le torce stanza 2 sono le ultime 8 create nell'array Promise.all.
  // Le identifichiamo per posizione approssimativa x >= 13.
  const roomTwoPuzzleTorchIds = new Set([
    // Non hanno id esplicito, le filtriamo per x world-position
  ]);

  const _torchWorldPos = new THREE.Vector3();

  state.roomTwoPuzzleTorches = validTorches.filter((torch) => {
    if (!torch?.group) return false;

    torch.group.updateMatrixWorld(true);
    torch.group.getWorldPosition(_torchWorldPos);

    return _torchWorldPos.x >= 13;
  });

  console.log('[RoomTwo] Torce trovate:', state.roomTwoPuzzleTorches.length);

  state.roomTwoPuzzleTorches.forEach((torch, index) => {
    torch.group.updateMatrixWorld(true);
    torch.group.getWorldPosition(_torchWorldPos);

    console.log(
      `[RoomTwo] Torch ${index}`,
      'id =', torch.id,
      'worldX =', _torchWorldPos.x.toFixed(2),
      'worldY =', _torchWorldPos.y.toFixed(2),
      'worldZ =', _torchWorldPos.z.toFixed(2)
    );

    torch.isRoomTwoTorch = true;
    setTorchLitState(torch, false);
  });

  for (const torch of state.roomTwoPuzzleTorches) {
    torch.isPuzzleTorch = true;
    setTorchLitState(torch, false);
  }


  return validTorches;
}

export function updateTorches(state, deltaTime, elapsedTime) {
  if (!state.torches || state.torches.length === 0) return;

  // Clampa deltaTime: spike da frame pesanti non devono bruciare la transizione
  const dt = Math.min(deltaTime, 0.05);

  for (const torch of state.torches) {

    // --- SPENTO ---
    if (!torch.isLit) {
      if (torch.light)     torch.light.visible = false;
      if (torch.spotLight) torch.spotLight.visible = false;
      if (torch.fillLight) torch.fillLight.visible = false;
      continue;
    }

    // --- TRANSIZIONE ACCENSIONE ---
    const progress = torch._litProgress ?? 1.0;

    if (progress < 1.0) {
      // Velocità di accensione: 2.5 → impiega ~0.4s per completarsi
      torch._litProgress = Math.min(1.0, progress + dt * 2.5);
      const p = torch._litProgress;

      // Ease-out: rapido all'inizio, morbido alla fine
      const eased = Math.pow(p, 0.55);

      if (torch.flameMaterials) {
        for (const mat of torch.flameMaterials) {
          mat.opacity = eased;
          if ('emissiveIntensity' in mat) {
            mat.emissiveIntensity = torch.baseEmissiveIntensity * eased;
          }
        }
      }

      // Wall torch
      if (torch.light) {
        torch.light.visible = true;
        torch.light.intensity = torch.baseIntensity * eased;
      }
      // Held torch
      if (torch.spotLight) {
        torch.spotLight.visible = true;
        torch.spotLight.intensity = torch.baseIntensity * eased;
      }
      if (torch.fillLight) {
        torch.fillLight.visible = true;
        torch.fillLight.intensity = 0.6 * eased;
      }

      // Flamepivot visibile solo quando la fiamma inizia davvero
      if (torch.flamePivot) {
        torch.flamePivot.visible = p > 0.05;
      }

      continue; // non aggiornare flicker durante la transizione
    }

    // --- FLICKER NORMALE (progress == 1.0) ---
    const t = elapsedTime * 1.35 + torch.timeOffset;
    const slowWave   = Math.sin(t * 1.2);
    const mediumWave = Math.sin(t * 2.1 + 1.3);
    const detailWave = Math.sin(t * 3.4 + 2.4);
    const flicker = 0.5 + 0.5 * (0.55 * slowWave + 0.3 * mediumWave + 0.15 * detailWave);

    if (torch.light) {
      torch.light.visible = true;
      torch.light.intensity = torch.baseIntensity * (0.92 + flicker * 0.18);
      torch.light.distance  = torch.baseDistance  * (0.96 + flicker * 0.06);
    }
    if (torch.spotLight) {
      torch.spotLight.visible = true;
      torch.spotLight.intensity = torch.baseIntensity * (0.92 + flicker * 0.18);
    }
    if (torch.fillLight) {
      torch.fillLight.visible = true;
      torch.fillLight.intensity = 0.6 * (0.88 + flicker * 0.24);
    }

    if (torch.flameMaterials) {
      for (const mat of torch.flameMaterials) {
        if ('emissiveIntensity' in mat) {
          mat.emissiveIntensity = torch.baseEmissiveIntensity * (0.9 + flicker * 0.22);
        }
      }
    }

    if (torch.flamePivot) {
      const rotX = slowWave * 0.035 + mediumWave * 0.012;
      const rotZ = mediumWave * 0.03  + detailWave * 0.01;
      const rotY = slowWave * 0.015;
      torch.flamePivot.rotation.x = torch.baseFlameRotationX + rotX;
      torch.flamePivot.rotation.y = torch.baseFlameRotationY + rotY;
      torch.flamePivot.rotation.z = torch.baseFlameRotationZ + rotZ;

      const scaleY  = 1.0 + flicker * 0.08;
      const scaleXZ = 1.0 + flicker * 0.025;
      torch.flamePivot.scale.set(
        torch.baseFlameScale.x * scaleXZ,
        torch.baseFlameScale.y * scaleY,
        torch.baseFlameScale.z * scaleXZ
      );
    }

    updateTorchEmbers(torch, dt);
    
  }
  updateChandeliers(state, elapsedTime);
}


function createRoomOne(state, registerObstacle) {
  buildWalls(state, registerObstacle, getRoomOneWallSpecs());
}

function createCorridor(state, registerObstacle) {
  buildWalls(state, registerObstacle, getCorridorWallSpecs());
}

function createRoomTwo(state, registerObstacle) {
  buildWalls(state, registerObstacle, getRoomTwoWallSpecs());
}



