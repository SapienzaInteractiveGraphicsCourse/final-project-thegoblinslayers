import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CHANDELIER_URL = './assets/models/medieval_chandelier/scene.gltf';
const loader = new GLTFLoader();

export async function createChandelier({
  state,
  x = 0,
  y = 5.8,       // Y del punto di aggancio al soffitto
  z = 0,
  scale = 0.055, // il modello è grande (max 19 unità), scala down
  lightColor = 0xffb870,
  lightIntensity = 2.8,
  lightDistance = 14.0,
  lightDecay = 1.6
}) {
  const gltf = await new Promise((resolve, reject) => {
    loader.load(CHANDELIER_URL, resolve, undefined, reject);
  });

  const model = gltf.scene;

  // Scala e posizione
  model.scale.setScalar(scale);
  model.position.set(x, y, z);

  // Il modello Sketchfab ha già la matrice di rotazione nel root node,
  // Three.js la applica automaticamente — nessuna correzione manuale necessaria.

  // Setup materiali: fiamme già emissive, ma forziamo transparent per correttezza
  model.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = false;
    child.receiveShadow = true;

    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      if (!mat) continue;
      if (mat.name === 'fire') {
        mat.transparent = true;
        mat.depthWrite = false;
        mat.side = THREE.DoubleSide;
      }
    }
  });

  state.scene.add(model);

  // PointLight posizionata leggermente sotto il chandelier
  // per simulare la luce delle candele verso il basso
  const light = new THREE.PointLight(lightColor, lightIntensity, lightDistance, lightDecay);
  light.position.set(x, y - 0.8, z); // 0.8 sotto il punto di aggancio
  light.castShadow = false;
  state.scene.add(light);

  const chandelier = {
    model,
    light,
    baseIntensity: lightIntensity,
    timeOffset: Math.random() * Math.PI * 2
  };

  // Registra nel render loop tramite state
  if (!state.chandeliers) state.chandeliers = [];
  state.chandeliers.push(chandelier);

  return chandelier;
}

// Chiamata ogni frame da dungeon.js / updateTorches o loop principale
export function updateChandeliers(state, elapsedTime) {
  if (!state.chandeliers) return;

  for (const ch of state.chandeliers) {
    const t = elapsedTime * 1.1 + ch.timeOffset;

    // Flicker morbido multi-frequenza, identico alle torce a muro
    const slow   = Math.sin(t * 0.9);
    const medium = Math.sin(t * 2.3 + 1.1);
    const detail = Math.sin(t * 4.1 + 2.7);
    const flicker = 0.5 + 0.5 * (0.5 * slow + 0.35 * medium + 0.15 * detail);

    ch.light.intensity = ch.baseIntensity * (0.88 + flicker * 0.24);
  }
}