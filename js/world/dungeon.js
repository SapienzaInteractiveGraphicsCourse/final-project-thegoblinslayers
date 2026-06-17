// world/dungeon.js
// Orchestratore del dungeon: luci, torce, props e assemblaggio finale.
// La geometria (muri, pavimenti, soffitti) è delegata a dungeonGeometry.js.
// I props GLTF decorativi sono delegati a dungeonProps.js.

import * as THREE from 'three';
import { ROOM_HEIGHT, PASSAGE_WIDTH } from '../core/config.js';

// ── Geometria ──────────────────────────────────────────────────────────────
import {
  loadFloorTextures,
  loadWallTextures,
  createFloorLayout,
  createCeilingLayout,
  createRoomOne,
  createCorridor,
  createRoomTwo
} from './dungeonGeometry.js';

// ── Props decorativi e pickup ──────────────────────────────────────────────
import {
  createSkullsDecoration,
  createOldBed,
} from './dungeonProps.js';

import { createShieldPickup } from './shield.js';
import { createSwordPickup }  from './sword.js';

// ── Torce e chandelier ─────────────────────────────────────────────────────
import {
  createTorchInstance,
  updateTorchEmbers,
  makeWallTorchIgnitionSource,
  setTorchLitState
} from './torch.js';

import { createChandelier, updateChandeliers } from './chandelier.js';

// ── Altri props ────────────────────────────────────────────────────────────
import { createPaper }          from './paper.js';
import { createGargoyleStatues } from './gargoyle_statue.js';
import { createSpikes }          from './spikes.js';


// LUCI AMBIENTALI
/* Crea la PointLight centrale della stanza 1. Teoria: PointLight emette luce in tutte le direzioni da un punto (modellosorgente puntiforme). 
 * L'attenuazione quadratica (decay=1.8) simula la fisica reale dell'energia luminosa che decade con il quadrato della distanza.*/
export function createLights(state) {
  const roomOneCenterLight = new THREE.PointLight(0xffc27a, 0.8, 18, 1.8);
  
  roomOneCenterLight.position.set(0, 2.6, 0);
  roomOneCenterLight.castShadow = true;
  roomOneCenterLight.shadow.mapSize.width  = 512;
  roomOneCenterLight.shadow.mapSize.height = 512;
  roomOneCenterLight.shadow.bias = -0.0008;

  state.scene.add(roomOneCenterLight);
  state.roomOneCenterLight = roomOneCenterLight;
}


// TORCIA RACCOGLIBILE (stanza 1, a terra)
/*Crea la torcia portatile sul pavimento della stanza 1. * Inizia spenta: si accende solo avvicinandosi a una ignition source (torcia da muro accesa).*/
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



// TORCE DA MURO
/* Helper: istanzia una singola torcia da muro con il modello GLTF standard. 
 * normalX/normalZ indicano la direzione in cui la torcia sporge dal muro (usato da createTorchInstance per orientare correttamente il modello).*/
async function createTorch(state, x, y, z, normalX, normalZ, id = null) {
  return createTorchInstance({
    state,
    x, y, z,
    normalX, normalZ,
    id,
    modelUrl: './assets/models/torch/scene.gltf',
    scale: 0.9
  });
}

/**Crea TUTTE le torce da muro del dungeon, imposta le ignition source e segna le torce puzzle (spente all'inizio, condizione di sblocco porte).
 * Teoria: Promise.all parallelizza i caricamenti GLTF — invece di N attese sequenziali si ha un'unica attesa pari al caricamento più lento.*/
async function createWallTorches(state) {
  const torchHeight       = 1.8;
  const loweredTorchHeight = 1.8;
  const wallInset         = 0.06;

  const torches = await Promise.all([
    // ── Stanza 1: muro posteriore ──────────────────────────────────────────
    createTorch(state, 0,    loweredTorchHeight, 12 - wallInset,  0, -1, 'room1-back-center'),
    createTorch(state, -8.8, loweredTorchHeight, 12 - wallInset,  0, -1),
    createTorch(state,  8.8, loweredTorchHeight, 12 - wallInset,  0, -1),

    // ── Stanza 1: muro sinistro ────────────────────────────────────────────
    createTorch(state, -12 + wallInset, torchHeight,  0,    1, 0, 'room1-left-center'),
    createTorch(state, -12 + wallInset, torchHeight,  8.8,  1, 0),
    createTorch(state, -12 + wallInset, torchHeight, -8.8,  1, 0),

    // ── Stanza 1: muro destro ──────────────────────────────────────────────
    createTorch(state, 12 - wallInset, torchHeight,  0,   -1, 0, 'room1-right-center'),
    createTorch(state, 12 - wallInset, torchHeight,  8.8, -1, 0),
    createTorch(state, 12 - wallInset, torchHeight, -8.8, -1, 0),

    // ── Stanza 1: muro frontale (ai lati dell'apertura) ────────────────────
    createTorch(state, -(PASSAGE_WIDTH * 0.5 + 0.9), torchHeight, -12 + wallInset, 0, 1),
    createTorch(state,  (PASSAGE_WIDTH * 0.5 + 0.9), torchHeight, -12 + wallInset, 0, 1),

    // ── Corridoio: tratto stretto sopra nicchia ────────────────────────────
    createTorch(state, -(PASSAGE_WIDTH * 0.5 + 0.5) + wallInset, torchHeight, -15,  1,  0),
    createTorch(state,  (PASSAGE_WIDTH * 0.5 + 0.5) - wallInset, torchHeight, -15, -1,  0),

    // ── Corridoio: torce nelle nicchie pendolo ─────────────────────────────
    createTorch(state, -4.57 + wallInset, torchHeight, -20,  1, 0),
    createTorch(state,  4.57 - wallInset, torchHeight, -20, -1, 0),

    // ── Corridoio: ingresso braccio orizzontale ────────────────────────────
    createTorch(state, 0, torchHeight, -26.75 + wallInset, 0, 1),

    // ── Corridoio: secondo tratto (braccio L) ─────────────────────────────
    createTorch(state, 10, torchHeight, -(12 + 16 - 3 + 1.2 + 0.5) + wallInset,  0,  1),
    createTorch(state, 10, torchHeight, -(12 + 16 - 3 - 1.2 - 0.5) - wallInset,  0, -1),
    createTorch(state,  7, torchHeight, -(12 + 16 - 3 - 1.2 - 0.5) - wallInset + 1, 0, -1),
    createTorch(state,  5, torchHeight, -(12 + 16 - 3 + 1.2 + 0.5) + wallInset - 1, 0,  1),

    // ── Stanza 2: muro frontale superiore (z=-16) ─────────────────────────
    createTorch(state, 22, torchHeight, -16 - wallInset, 0, -1),

    // ── Stanza 2: muro frontale inferiore (z=-34) ─────────────────────────
    createTorch(state, 22, torchHeight, -34 + wallInset, 0,  1),

    // ── Stanza 2: muro sinistro superiore (x=13) ──────────────────────────
    createTorch(state, 13 + wallInset, torchHeight, -19,  1, 0),

    // ── Stanza 2: muro sinistro inferiore (x=13) ──────────────────────────
    createTorch(state, 13 + wallInset, torchHeight, -30,  1, 0),

    // ── Stanza 2: muro destro inferiore (x=31) ────────────────────────────
    createTorch(state, 31 - wallInset, torchHeight, -31, -1, 0),

    // ── Stanza 2: muro destro superiore (x=31) ────────────────────────────
    createTorch(state, 31 - wallInset, torchHeight, -19, -1, 0),
  ]);

  const validTorches = torches.filter(Boolean);
  state.wallTorches = validTorches;

  // Tutte le torce valide diventano ignition source (accendono la torcia portatile)
  for (const torch of validTorches) {
    makeWallTorchIgnitionSource(torch, state);
  }

  // ── Torce puzzle stanza 1 (spente → devono essere accese dal giocatore) ──
  const puzzleTorchIds = new Set(['room1-left-center', 'room1-right-center']);

  state.roomOnePuzzleTorches = validTorches.filter((t) => puzzleTorchIds.has(t.id));

  for (const torch of state.roomOnePuzzleTorches) {
    torch.isPuzzleTorch = true;
    setTorchLitState(torch, false);
  }

  // ── Torce puzzle stanza 2 (filtrate per posizione X >= 13) ───────────────
  const _worldPos = new THREE.Vector3();

  state.roomTwoPuzzleTorches = validTorches.filter((torch) => {
    if (!torch?.group) return false;
    torch.group.updateMatrixWorld(true);
    torch.group.getWorldPosition(_worldPos);
    return _worldPos.x >= 13;
  });

  

  state.roomTwoPuzzleTorches.forEach((torch, i) => {
    torch.group.getWorldPosition(_worldPos);
    torch.isRoomTwoTorch  = true;
    torch.isPuzzleTorch   = true;
    setTorchLitState(torch, false);
  });

  return validTorches;
}


// UPDATE LOOP — chiamato ogni frame da main.js / gameLoop
/**Aggiorna flicker, transizione accensione ed embers di tutte le torce.
 * deltaTime viene clampato a 50ms per evitare spike visivi su frame pesanti.
 * Teoria: animazione basata sul tempo (time-based animation) — lo stato visivo dipende da elapsedTime, non dal numero di frame. 
 * Questo garantisce framerate-independence e comportamento identico su macchine diverse.*/
export function updateTorches(state, deltaTime, elapsedTime) {
  if (!state.torches || state.torches.length === 0) return;

  const dt = Math.min(deltaTime, 0.05); // anti-spike: max 50ms per frame

  for (const torch of state.torches) {

    // ── SPENTO ────────────────────────────────────────────────────────────
    if (!torch.isLit) {
      if (torch.light)     torch.light.visible     = false;
      if (torch.spotLight) torch.spotLight.visible  = false;
      if (torch.fillLight) torch.fillLight.visible  = false;
      continue;
    }

    // ── TRANSIZIONE ACCENSIONE ────────────────────────────────────────────
    const progress = torch._litProgress ?? 1.0;

    if (progress < 1.0) {
      torch._litProgress = Math.min(1.0, progress + dt * 2.5);
      const p     = torch._litProgress;
      const eased = Math.pow(p, 0.55); // ease-out: rapido → morbido

      if (torch.flameMaterials) {
        for (const mat of torch.flameMaterials) {
          mat.opacity = eased;
          if ('emissiveIntensity' in mat) {
            mat.emissiveIntensity = torch.baseEmissiveIntensity * eased;
          }
        }
      }

      if (torch.light) {
        torch.light.visible   = true;
        torch.light.intensity = torch.baseIntensity * eased;
      }
      if (torch.spotLight) {
        torch.spotLight.visible   = true;
        torch.spotLight.intensity = torch.baseIntensity * eased;
      }
      if (torch.fillLight) {
        torch.fillLight.visible   = true;
        torch.fillLight.intensity = 0.6 * eased;
      }
      if (torch.flamePivot) {
        torch.flamePivot.visible = p > 0.05;
      }

      continue; // non entrare nel flicker durante la transizione
    }

    // ── FLICKER NORMALE (progress == 1.0) ─────────────────────────────────
    const t          = elapsedTime * 1.35 + torch.timeOffset;
    const slowWave   = Math.sin(t * 1.2);
    const mediumWave = Math.sin(t * 2.1 + 1.3);
    const detailWave = Math.sin(t * 3.4 + 2.4);
    const flicker    = 0.5 + 0.5 * (0.55 * slowWave + 0.3 * mediumWave + 0.15 * detailWave);

    if (torch.light) {
      torch.light.visible   = true;
      torch.light.intensity = torch.baseIntensity * (0.92 + flicker * 0.18);
      torch.light.distance  = torch.baseDistance  * (0.96 + flicker * 0.06);
    }
    if (torch.spotLight) {
      torch.spotLight.visible   = true;
      torch.spotLight.intensity = torch.baseIntensity * (0.92 + flicker * 0.18);
    }
    if (torch.fillLight) {
      torch.fillLight.visible   = true;
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


// ENTRY POINT — createDungeon
/** Assembla l'intero dungeon in sequenza:
 *   1. Carica texture base (pavimento + muri)
 *   2. Costruisce geometria (pavimenti, muri, soffitti)
 *   3. Crea props (torce, chandelier, decorazioni, pickup)
 * Tutti gli await sono necessari: i passi successivi dipendono dalle texture caricate (i materiali clonano da state.floorAlbedoBase ecc.).*/
export async function createDungeon(state, registerObstacle) {
  // ── 1. Texture PBR ────────────────────────────────────────────────────────
  await Promise.all([
    loadFloorTextures(state),
    loadWallTextures(state)
  ]);

  // ── 2. Geometria ──────────────────────────────────────────────────────────
  createFloorLayout(state);
  createRoomOne(state,    registerObstacle);
  createCorridor(state,   registerObstacle);
  createRoomTwo(state,    registerObstacle);
  createCeilingLayout(state);

  // ── 3. Torce da muro + torcia raccoglibile ────────────────────────────────
  await createWallTorches(state);
  state.roomOnePickupTorch = await createRoomOneFloorTorch(state);

  // ── 4. Chandelier ─────────────────────────────────────────────────────────
  await createChandelier({ state, x: 0,      y: ROOM_HEIGHT - 1.8, z:   0,   scale: 0.055 });
  await createChandelier({ state, x: 21.541, y: ROOM_HEIGHT - 1.8, z: -25.077, scale: 0.055 });

  // ── 5. Decorazioni e props GLTF ───────────────────────────────────────────
  createPaper(state.scene, state);
  await createGargoyleStatues(state, registerObstacle);
  await createSpikes(state, registerObstacle);
  await createSkullsDecoration(state, registerObstacle);
  await createOldBed(state, registerObstacle);

  // ── 6. Pickup interattivi ─────────────────────────────────────────────────
  state.shieldPickup = createShieldPickup({
    state,
    position:  new THREE.Vector3(7.0, 1.55, -11.5),
    rotationZ: -Math.PI
  });

  state.swordPickup = createSwordPickup({
    state,
    position:   new THREE.Vector3(10.2, 0.70, 9.8),
    wallNormal: null // sdraiata a terra
  });
}