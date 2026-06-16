import * as THREE from 'three';
import { ROOM_HEIGHT, PASSAGE_WIDTH } from '../core/config.js';

// CARICAMENTO TEXTURE (async, con caching sullo state)
/**
 * Carica una texture in modo asincrono e imposta wrapping + colorSpace.
 * isColorTexture = true → sRGB (albedo/diffuse); false → Linear (normal, roughness, disp).
 */
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

/**
 * Carica le 4 texture PBR del pavimento e le salva su state come base.
 * Le funzioni di creazione materiale le clonano da qui, evitando ricaricamenti.
 *
 * Teoria: le texture sono oggetti GPU; clonarle è O(1) perché puntano allo
 * stesso buffer WebGL — si cambia solo il repeat UV per ogni sezione.
 */
export async function loadFloorTextures(state) {
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

/**
 * Carica le 3 texture PBR dei muri (albedo, normal, roughness) e le salva su state.
 */
export async function loadWallTextures(state) {
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


// FACTORY MATERIALI
/**
 * Crea un MeshStandardMaterial per il pavimento con displacement map.
 * Il repeat UV è proporzionale alla superficie fisica (1 tile ogni ~4m²).
 *
 * Teoria: MeshStandardMaterial usa la pipeline PBR (Physically Based Rendering)
 * di Three.js, che mappa roughness e metalness al BRDF GGX sottostante in WebGL.
 * displacementScale = 0.045 → piccolo sollevamento geometrico per i giunti tra le pietre.
 */
export function createFloorMaterial(state, repeatX, repeatY) {
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
    map:              albedo,
    displacementMap:  displacement,
    displacementScale: 0.045,
    normalMap:        normal,
    normalScale:      new THREE.Vector2(0.55, 0.55),
    roughnessMap:     roughness,
    roughness:        1.0,
    metalness:        0.04
  });
}

/**
 * Crea un MeshStandardMaterial per i muri.
 * Il repeat UV viene calcolato automaticamente dalla dimensione fisica del muro:
 *   - repeatX = max(width, depth) / 4  → 1 tile ogni 4 unità in orizzontale
 *   - repeatY = height / 3             → 1 tile ogni 3 unità in verticale
 * Il parametro tint permette di scurire o illuminare muri di zone diverse (stanza1 vs stanza2).
 */
export function createWallMaterial(state, width, height, depth, tint = 0xffffff) {
  const horizontalSpan = Math.max(width, depth);
  const verticalSpan   = height;

  const repeatX = Math.max(1, horizontalSpan / 4.0);
  const repeatY = Math.max(1, verticalSpan   / 3.0);

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
    map:        albedo,
    normalMap:  normal,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughnessMap: roughness,
    color:      tint,
    roughness:  1.0,
    metalness:  0.02
  });
}

/**
 * Crea un MeshStandardMaterial per il soffitto.
 * Usa le stesse texture dei muri ma con normalScale ridotta (0.28) per un aspetto più liscio, e un color tint scuro (0x5f6368) per simulare
 * l'oscurità del soffitto lontano dalle torce.
 * side: DoubleSide perché il PlaneGeometry del soffitto è visto dall'interno.
 */
export function createCeilingMaterial(state, repeatX, repeatY) {
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
    map:        albedo,
    normalMap:  normal,
    normalScale: new THREE.Vector2(0.28, 0.28),
    roughnessMap: roughness,
    color:      0x5f6368,
    roughness:  1.0,
    metalness:  0.02,
    side:       THREE.DoubleSide
  });
}


// PRIMITIVE DI COSTRUZIONE (sezione singola)
/**Crea e aggiunge alla scena una sezione di pavimento.
 * Teoria: PlaneGeometry con 96×96 segmenti è necessaria per il displacement map:
 * la GPU sposta i vertici in verticale in base alla texture (vertex displacement).
 * Senza suddivisione, la normale del piano è unica e il displacement non è visibile.
 * rotation.x = -PI/2 → ruota il piano (originariamente orizzontale in XY) sul piano XZ.*/
export function createFloorSection(state, width, depth, x, z, repeatX, repeatY) {
  const geometry = new THREE.PlaneGeometry(width, depth, 96, 96);
  const material = createFloorMaterial(state, repeatX, repeatY);

  const floor = new THREE.Mesh(geometry, material);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(x, 0, z);
  floor.receiveShadow = true;

  state.scene.add(floor);
}

/**Crea e aggiunge alla scena una sezione di soffitto.
 * Teoria: rotation.x = +PI/2 → il piano è rivolto verso il basso (vers Z negativo).
 * Posizionato a y = ROOM_HEIGHT - 0.02 per evitare z-fighting con eventuali pareti che arrivano esattamente a ROOM_HEIGHT.*/
export function createCeilingSection(state, width, depth, x, z, repeatX, repeatY) {
  const geometry = new THREE.PlaneGeometry(width, depth);
  const material = createCeilingMaterial(state, repeatX, repeatY);

  const ceiling = new THREE.Mesh(geometry, material);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(x, ROOM_HEIGHT - 0.02, z);
  ceiling.receiveShadow = true;

  state.scene.add(ceiling);
}

/**
 * Crea un muro come BoxGeometry, lo aggiunge alla scena e lo registra come ostacolo.
 * Teoria: BoxGeometry è una mesh di 12 triangoli (6 facce × 2). Il collider è la stessa mesh — AABB coincide con la geometria, nessuno scarto.
 * registerObstacle(wall) aggiunge la mesh all'array di collisioni AABB del player.
 * @returns {THREE.Mesh} la mesh del muro, utile per riferimenti successivi*/
export function createWall(state, registerObstacle, material, width, height, depth, x, y, z) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    material
  );

  wall.position.set(x, y, z);
  wall.castShadow    = true;
  wall.receiveShadow = true;

  state.scene.add(wall);
  registerObstacle(wall);

  return wall;
}


// COSTRUTTORI BATCH (iterano su spec-array)
/** Itera un array di sezioni e chiama createSectionFn per ciascuna.
 * Usato sia per pavimento che per soffitto: la fn specifica è il discriminante.
 * Ogni elemento ha la forma: { width, depth, x, z, repeatX, repeatY } */
export function buildSections(state, sections, createSectionFn) {
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

/*Itera un array di wallSpec e crea ogni muro con il suo materiale dedidcato.
 * Il materiale viene calcolato dalle dimensioni dello spec, così il repeat UV è sempre corretto per le proporzioni fisiche del muro.
 * Ogni elemento ha la forma: { width, height, depth, x, y, z, tint }*/
export function buildWalls(state, registerObstacle, wallSpecs) {
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

// SPEC ARRAY — DATI GEOMETRICI DEL DUNGEON
/**Restituisce le sezioni di pavimento di TUTTO il dungeon.
 * Struttura del layout (asse Z negativo = avanzare nel dungeon):
 *   - Stanza 1:      24×24, centrata a (0, 0)
 *   - Corridoio:     braccio verticale con nicchie per i pendoli, poi svolta L
 *   - Stanza 2:      18×18, centrata a (22, -25)
 *   - Uscita:        striscia 6×PASSAGE_WIDTH a destra della stanza 2*/
export function getFloorSections() {
  return [
    // Stanza 1
    { width: 24, depth: 24, x: 0, z: 0, repeatX: 6, repeatY: 6 },

    // Corridoio stretto — tratto sopra la nicchia (z=-12 → z=-17, center=-14.5)
    { width: 6, depth: 5, x: 0, z: -14.5, repeatX: 1.5, repeatY: 1.25 },

    // Pavimento allargato della nicchia pendoli (z=-17 → z=-23, center=-20)
    { width: 10, depth: 6, x: 0, z: -20, repeatX: 2.5, repeatY: 1.5 },

    // Corridoio stretto — tratto sotto la nicchia (z=-23 → z=-28, center=-25.5)
    { width: 6, depth: 5, x: 0, z: -25.5, repeatX: 1.5, repeatY: 1.25 },

    // Braccio orizzontale della L (svolta destra)
    { width: 10, depth: 9, x: 8, z: -25, repeatX: 4, repeatY: 2 },

    // Stanza 2 — 18×18, centrata a (22, -25)
    { width: 18, depth: 18, x: 22, z: -25, repeatX: 4.5, repeatY: 4.5 },

    // Uscita (a destra della stanza 2)
    { width: 6, depth: PASSAGE_WIDTH, x: 31 + 3, z: -25, repeatX: 1.40, repeatY: 0.61 }
  ];
}

/**
 * Restituisce le sezioni di soffitto di TUTTO il dungeon.
 * Stessa footprint del pavimento; materiale diverso (createCeilingMaterial).
 * repeatX/Y leggermente ridotti per un aspetto visivamente più ruvido in alto.
 */
export function getCeilingSections() {
  return [
    // Stanza 1
    { width: 24, depth: 24, x: 0, z: 0, repeatX: 4, repeatY: 4 },

    // Corridoio stretto — tratto SOPRA la nicchia
    { width: 6, depth: 5, x: 0, z: -14.5, repeatX: 1.5, repeatY: 1.25 },

    // Soffitto allargato della nicchia
    { width: 10, depth: 6, x: 0, z: -20, repeatX: 2.5, repeatY: 1.5 },

    // Corridoio stretto — tratto SOTTO la nicchia
    { width: 6, depth: 5, x: 0, z: -25.5, repeatX: 1.5, repeatY: 1.25 },

    // Braccio orizzontale della L
    { width: 10, depth: 9, x: 8, z: -25, repeatX: 4, repeatY: 2 },

    // Stanza 2
    { width: 18, depth: 18, x: 22, z: -25, repeatX: 3, repeatY: 3 },

    // Uscita
    { width: 6, depth: PASSAGE_WIDTH, x: 31 + 3, z: -25, repeatX: 1.40, repeatY: 0.61 }
  ];
}

/**
 * Spec dei muri della STANZA 1.
 *
 * Layout: stanza 24×24, centrata in (0,0).
 *   - Muro posteriore (z=+12): pieno, larghezza 24.
 *   - Muro sinistro   (x=-12): pieno, profondità 24.
 *   - Muro destro     (x=+12): pieno, profondità 24.
 *   - Muro frontale   (z=-12): aperto al centro (PASSAGE_WIDTH), due segmenti laterali.
 *
 * Teoria: i muri sono BoxGeometry — la loro AABB corrisponde esattamente
 * alla geometria fisica, così il test di collisione AABB del player è preciso.
 */
export function getRoomOneWallSpecs() {
  const y                = ROOM_HEIGHT * 0.5;
  const openingHalf      = PASSAGE_WIDTH * 0.5;
  const frontWallDepth   = 1;
  const roomWidth        = 24;
  const sideSegmentWidth = (roomWidth - PASSAGE_WIDTH) * 0.5;
  const tint             = 0xd6d6d6;

  return [
    // Muro posteriore (z=+12)
    { width: 24, height: ROOM_HEIGHT, depth: 1, x: 0, y, z: 12, tint },

    // Muro sinistro (x=-12)
    { width: 1, height: ROOM_HEIGHT, depth: 24, x: -12, y, z: 0, tint },

    // Muro destro (x=+12)
    { width: 1, height: ROOM_HEIGHT, depth: 24, x: 12, y, z: 0, tint },

    // Muro frontale sinistro (segmento a sinistra dell'apertura)
    {
      width:  sideSegmentWidth - 0.01,
      height: ROOM_HEIGHT,
      depth:  frontWallDepth,
      x:      -(openingHalf + sideSegmentWidth * 0.5),
      y,
      z:      -12,
      tint
    },

    // Muro frontale destro (segmento a destra dell'apertura)
    {
      width:  sideSegmentWidth - 0.01,
      height: ROOM_HEIGHT,
      depth:  frontWallDepth,
      x:       openingHalf + sideSegmentWidth * 0.5,
      y,
      z:      -12,
      tint
    }
  ];
}

/**
 * Spec dei muri del CORRIDOIO (braccio verticale + nicchie + braccio orizzontale L).
 *
 * Geometria del corridoio verticale:
 *   - Da z=-12 a z=-28, larghezza interna PASSAGE_WIDTH.
 *   - Zona nicchia pendoli: z=-17 → z=-23, larghezza allargata a 10 unità (width 10).
 *     I muri interni della nicchia (innerX) e quelli esterni (outerX) sono
 *     collegati da tappi orizzontali in cima (z=-17) e in fondo (z=-23).
 *
 * Geometria del braccio orizzontale (svolta L):
 *   - Parte da x≈0 e va verso x≈13 (ingresso stanza 2).
 *   - Muri top (z=horTopZ) e bottom (z=horBotZ) con nicchie "safe place" per la palla.
 *
 * Nota sui safe places: nella seconda parte del corridoio ci sono due nicchie
 * laterali (safeW=2) in cui il giocatore può ripararsi dalla palla rotolante.
 */
export function getCorridorWallSpecs() {
  const y    = ROOM_HEIGHT * 0.5;
  const T    = 1;                    // spessore muro
  const cH   = PASSAGE_WIDTH * 0.5; // metà larghezza corridoio
  const tint = 0xc8c8c8;
  const endRoom1 = -12;

  // ── Zona nicchia pendoli ──────────────────────────────────────────────────
  const alcoveCenterZ   = -20;
  const alcoveHalfDepth = 3;          // nicchia: z=-17 → z=-23 (6 unità)
  const innerX          = cH + T * 0.5;    // centro del muro stretto interno
  const outerX          = 5 - T * 0.5;    // centro del muro esterno allargato (bordo ±5)

  // Tratti stretti del braccio verticale
  const topSegZ = endRoom1 - 2.5;  // -14.5 (center tra -12 e -17)
  const topSegD = 5;
  const botSegZ = -25.5;            // center tra -23 e -28
  const botSegD = 5;

  // Tappi orizzontali delle nicchie
  const capWidth        = outerX - innerX;
  const capCenterX_left  = -(innerX + capWidth * 0.5);
  const capCenterX_right =  (innerX + capWidth * 0.5);
  const topCapZ          = alcoveCenterZ + alcoveHalfDepth;  // -17
  const botCapZ          = alcoveCenterZ - alcoveHalfDepth;  // -23

  // ── Braccio orizzontale della L ───────────────────────────────────────────
  // horW1: muro top da x=-1.2 a x=4 (safe place a x=5, larghezza 2 → primo bordo a x=4)
  // horW2: muro top da x=6 a x=13.49
  // horLowW2: muro bottom da x=8 a x=13.49 (safe place a x=7, larghezza 2 → primo bordo a x=6, secondo a x=8)
  // safeW: larghezza del muro "safe place" inserito nella parete (2 unità)
  const horW1      = 5.2;
  const horW2      = 7.49;
  const horLowW1   = 1.8;   // non usato come muro completo, solo per calcoli
  const horLowW2   = 5.49;
  const safeW      = 2;
  const safeD      = 1;     // profondità dei safe place (non usato come muro separato)

  const horBotZ      = endRoom1 - (16 - 3 - cH - T * 0.5);
  const horTopZ      = endRoom1 - (16 - 3 + cH + T * 0.5);
  const horBotSafeZ  = horBotZ + 1;  // z del safe-place sul muro bottom
  const horTopSafeZ  = horTopZ - 1;  // z del safe-place sul muro top

  return [
    // LATO SINISTRO del corridoio
    // Tratto stretto sopra la nicchia (da -12 a -17)
    { width: T, height: ROOM_HEIGHT, depth: topSegD + 0.99, x: -innerX, y, z: topSegZ,       tint },

    // Muro esterno della nicchia (da -17 a -23)
    { width: T, height: ROOM_HEIGHT, depth: 6,              x: -outerX, y, z: alcoveCenterZ, tint },

    // Tratto stretto sotto la nicchia (da -23 a -28)
    { width: T, height: ROOM_HEIGHT, depth: botSegD + 1.59, x: -innerX, y, z: botSegZ,       tint },

    // LATO DESTRO del corridoio
    // Tratto stretto sopra la nicchia (da -12 a -17)
    { width: T, height: ROOM_HEIGHT, depth: topSegD + 0.99, x: innerX,  y, z: topSegZ,       tint },

    // Muro esterno della nicchia (da -17 a -23)
    { width: T, height: ROOM_HEIGHT, depth: 6,              x: outerX,  y, z: alcoveCenterZ, tint },

    // Nota: il tratto stretto destro sotto la nicchia è commentato nel codice originale
    // perché la svolta L apre il lato destro verso il braccio orizzontale.
    // Decommentare se si vuole chiudere il lato destro:
    // { width: T, height: ROOM_HEIGHT, depth: botSegD, x: innerX, y, z: botSegZ, tint },

    // TAPPI ORIZZONTALI delle nicchie
    // Collegano il muro stretto (innerX) al muro allargato (outerX) in cima/fondo nicchia
    // Tappo superiore sinistro  (a z = -17)
    { width: capWidth + 0.99, height: ROOM_HEIGHT, depth: T,       x: capCenterX_left,      y, z: topCapZ, tint },

    // Tappo superiore destro    (a z = -17)
    { width: capWidth + 0.99, height: ROOM_HEIGHT, depth: T,       x: capCenterX_right,     y, z: topCapZ, tint },

    // Tappo inferiore sinistro  (a z = -23)
    { width: capWidth + 0.99, height: ROOM_HEIGHT, depth: T + 0.6, x: capCenterX_left,       y, z: botCapZ, tint },

    // Tappo inferiore destro    (a z = -23)
    { width: capWidth + 2,    height: ROOM_HEIGHT, depth: T + 0.6, x: capCenterX_right + 0.5, y, z: botCapZ, tint },

    // BRACCIO ORIZZONTALE DELLA L (secondo corridoio con palla)
    // Safe place sul muro bottom (nicchia in cui ripararsi, centrata a x=7)
    { width: safeW, height: ROOM_HEIGHT, depth: T, x: 7, y, z: horBotSafeZ, tint },

    // Safe place sul muro top (nicchia in cui ripararsi, centrata a x=5)
    { width: safeW, height: ROOM_HEIGHT, depth: T, x: 5, y, z: horTopSafeZ, tint },

    // Muro top — segmento sinistro (da x=-1.2 a x=4)
    { width: horW1,   height: ROOM_HEIGHT, depth: 3, x: horW1   * 0.5 - 1.2, y, z: horTopSafeZ, tint },

    // Muro top — segmento destro (da x=6 a x=13.49)
    { width: horW2,   height: ROOM_HEIGHT, depth: 3, x: horW2   * 0.5 + 6,   y, z: horTopSafeZ, tint },

    // Muro bottom — segmento destro (da x=8 a x=13.49)
    { width: horLowW2, height: ROOM_HEIGHT, depth: 3, x: horLowW2 * 0.5 + 8, y, z: horBotSafeZ, tint }
  ];
}

/**Spec dei muri della STANZA 2.
 * Layout: stanza 18×18, centrata a (22, -25).
 *   x: 13 → 31   (sinistro = ingresso, destro = muro chiuso)
 *   z: -34 → -16  (inferiore/superiore)
 * Il muro sinistro (x=13) ha un'apertura PASSAGE_WIDTH centrata a z=-25 (ingresso dal corridoio).
 * Il muro destro (x=31) ha una piccola apertura centrale (PASSAGE_WIDTH) per l'uscita.
 *   - Due segmenti sopra e sotto l'apertura di uscita.
 *   - Un muro stretto (1×ROOM_HEIGHT×2.4) all'estremo destro (x≈37.5) chiude il corridoio di uscita.*/
export function getRoomTwoWallSpecs() {
  const y    = ROOM_HEIGHT * 0.5;
  const tint = 0xbdb7ae;

  const openingHalf      = PASSAGE_WIDTH * 0.5;          // metà apertura corridoio ingresso
  const sideSegmentDepth = (18 - PASSAGE_WIDTH) * 0.5;   // segmento sopra/sotto apertura sinistro

  return [
    // ── Muro destro (x=31): due segmenti con apertura per l'uscita ─────────────
    // Segmento inferiore (da z=-34 a z=-25+openingHalf)
    {
      width:  7,
      height: ROOM_HEIGHT,
      depth:  sideSegmentDepth,
      x:      31 + 3,
      y,
      z:      -34 + sideSegmentDepth * 0.5,   // centro segmento inferiore
      tint
    },

    // Segmento superiore (da z=-25-openingHalf a z=-16)
    {
      width:  7,
      height: ROOM_HEIGHT,
      depth:  sideSegmentDepth,
      x:      31 + 3,
      y,
      z:      -16 - sideSegmentDepth * 0.5,   // centro segmento superiore
      tint
    },

    // Muro stretto di chiusura del corridoio di uscita (x≈37.5)
    { width: 1, height: ROOM_HEIGHT, depth: 2.4, x: 34 + 3.5, y, z: -25, tint },

    // ── Muro frontale superiore (z=-16): pieno, larghezza 18 ──────────────────
    { width: 18, height: ROOM_HEIGHT, depth: 1, x: 22, y, z: -16, tint },

    // ── Muro frontale inferiore (z=-34): pieno, larghezza 18 ──────────────────
    { width: 18, height: ROOM_HEIGHT, depth: 1, x: 22, y, z: -34, tint },

    // ── Muro sinistro (x=13): due segmenti con apertura ingresso centrata a z=-25 ──

    // Segmento superiore (da z=-16 verso il basso fino all'apertura)
    {
      width:  1,
      height: ROOM_HEIGHT,
      depth:  sideSegmentDepth - 0.01,
      x:      13,
      y,
      z:      -16 - sideSegmentDepth * 0.5,   // centro = -16 - 3.75 = -19.75
      tint
    },

    // Segmento inferiore (dall'apertura fino a z=-34)
    {
      width:  1,
      height: ROOM_HEIGHT,
      depth:  sideSegmentDepth - 0.01,
      x:      13,
      y,
      z:      -34 + sideSegmentDepth * 0.5,   // centro = -34 + 3.75 = -30.25
      tint
    }
  ];
}


// ASSEMBLY — costruttori di alto livello chiamati da dungeon.js
//Costruisce TUTTO il pavimento del dungeon usando buildSections + getFloorSections.
export function createFloorLayout(state) {
  buildSections(state, getFloorSections(), createFloorSection);
}

//Costruisce TUTTO il soffitto del dungeon usando buildSections + getCeilingSections.
export function createCeilingLayout(state) {
  buildSections(state, getCeilingSections(), createCeilingSection);
}

//Costruisce i muri della STANZA 1.
export function createRoomOne(state, registerObstacle) {
  buildWalls(state, registerObstacle, getRoomOneWallSpecs());
}

//Costruisce i muri del CORRIDOIO (verticale + nicchie + braccio L).
export function createCorridor(state, registerObstacle) {
  buildWalls(state, registerObstacle, getCorridorWallSpecs());
}

//Costruisce i muri della STANZA 2.
export function createRoomTwo(state, registerObstacle) {
  buildWalls(state, registerObstacle, getRoomTwoWallSpecs());
}