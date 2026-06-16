import * as THREE from 'three';

import { playSound, preloadSound } from '../systems/audioManager.js';

const _hitPoint = new THREE.Vector3();

export function createHangingAxe({
  state,
  registerObstacle,
  position = new THREE.Vector3(0, 4.3, -22)
}) {
  const root = new THREE.Group();
  root.position.copy(position);

  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: 0xbfc5cc,
    roughness: 0.28,
    metalness: 0.95
  });

  const darkMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x353a40,
    roughness: 0.62,
    metalness: 0.88
  });

  const ceilingAnchor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.08, 16), // Più largo della catena e sottile
    darkMetalMaterial
  );
  // Posizionato leggermente sopra l'anello iniziale per non sovrapporsi
  ceilingAnchor.position.y = 0.04; 
  root.add(ceilingAnchor);

  const pendulumGroup = new THREE.Group();
  root.add(pendulumGroup);

  const topRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.09, 0.018, 12, 28),
    darkMetalMaterial
  );
  topRing.position.y = -0.05;
  root.add(topRing);

  const chainGroup = new THREE.Group();
  pendulumGroup.add(chainGroup);

  const linkCount = 36;
  for (let i = 0; i < linkCount; i++) {
    const link = new THREE.Mesh(
      new THREE.TorusGeometry(0.05, 0.012, 8, 18),
      darkMetalMaterial
    );

    if (i % 2 === 0) {
      link.rotation.y = Math.PI * 0.5;
    }

    link.position.y = -0.11 - (i * 0.08);
    chainGroup.add(link);
  }

  const connector = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.16, 10),
    darkMetalMaterial
  );
  connector.position.y = -0.11 - (linkCount * 0.08);
  pendulumGroup.add(connector);

  const bladeShape = new THREE.Shape();
  const bladeRadius = 0.55;

  bladeShape.moveTo(-bladeRadius, 0);
  bladeShape.lineTo(bladeRadius, 0);
  bladeShape.absarc(0, 0, bladeRadius, 0, Math.PI, true);

  const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.0005,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.012,
    bevelSegments: 2
  });

  bladeGeometry.center();

  const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
  blade.position.y = -0.12 - (linkCount * 0.08) + (bladeRadius / 2) - 0.55;
  blade.position.x = 0;
  pendulumGroup.add(blade);

  // Punto di hit: sta sulla parte realmente pericolosa della lama.
  const hitProbe = new THREE.Object3D();
  hitProbe.position.set(0, blade.position.y - 0.18, 0);
  pendulumGroup.add(hitProbe);

  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });

  state.scene.add(root);

  // IMPORTANTE:
  // NON registriamo più il pendolo intero come ostacolo statico.
  // Così facendo, evitiamo di creare un blocco invisibile al centro del pendolo, che interferisce con il movimento del player e con la telecamera.
  // registerObstacle(root); <-- rimosso apposta

  

  const swingOffset = Math.random() * 10;
  let elapsedTime = swingOffset;
  let _lastSinSign = Math.sign(Math.sin(swingOffset * 1.8)); // ← NUOVO


const pendulum = {
  root,
  pendulumGroup,
  blade,
  hitProbe,
  damageRadius: 0.68,
  enabled: true,
  isFrozen: false,

  // Distanza massima oltre cui non triggerare il whoosh (risparmio CPU + realismo)
  _whooshMaxDist: 5.0,

  getHitPointWorld(out = new THREE.Vector3()) {
    return this.hitProbe.getWorldPosition(out);
  },

  checkPlayerHit(playerWorldPosition, playerRadius = 0.35) {
    if (!this.enabled) return false;
    if (this.isFrozen) return false;
    this.getHitPointWorld(_hitPoint);
    return _hitPoint.distanceTo(playerWorldPosition) <= (this.damageRadius + playerRadius);
  },

  freeze() { this.isFrozen = true; },
  unfreeze() { this.isFrozen = false; },

  // Chiamato da updatePendulumAudio in main.js con la distanza attuale del player
  triggerWhooshIfClose(playerDist) {
    if (playerDist > this._whooshMaxDist) return;
    // Volume scalato sulla distanza: più vicino = più forte
    const t = 1 - (playerDist / this._whooshMaxDist);
    const vol = Math.max(0.06, t * 0.65);
    playSound('whoosh', { volume: vol, offset: 0, duration: 1.5 });
  },

  update(deltaTime, playerPos = null) {
    if (this.isFrozen) return;

    elapsedTime += Math.min(deltaTime, 0.05);

    const sinVal = Math.sin(elapsedTime * 1.8);
    pendulumGroup.rotation.z = sinVal * 1.0;
    pendulumGroup.rotation.x = Math.sin(elapsedTime * 1.2) * 0.04;

    // Passaggio per la verticale: sin cambia segno
    const currentSign = Math.sign(sinVal);
    if (currentSign !== 0 && currentSign !== _lastSinSign) {
      if (playerPos !== null) {
        this.getHitPointWorld(_hitPoint);
        const dist = _hitPoint.distanceTo(playerPos);
        this.triggerWhooshIfClose(dist);
      }
      _lastSinSign = currentSign;
    }
  }
};

  if (!state.pendulums) state.pendulums = [];
  state.pendulums.push(pendulum);

  return pendulum;
}