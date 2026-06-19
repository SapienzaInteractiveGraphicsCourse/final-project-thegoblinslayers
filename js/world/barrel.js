import * as THREE from 'three';
import { playSound } from '../systems/audioManager.js';

const SPLINTER_PARTICLE_COUNT = 62;

const DESTROY_EXTRA_SPLINTER_COUNT = 20;
const DESTROY_BASE_RADIUS_MIN = 0.02;
const DESTROY_BASE_RADIUS_MAX = 0.28;
const DESTROY_BASE_UPWARD_MIN = 0.18;
const DESTROY_BASE_UPWARD_MAX = 0.75;
const DESTROY_BASE_OUTWARD_MIN = 0.05;
const DESTROY_BASE_OUTWARD_MAX = 0.30;

const SPLINTER_MIN_LIFE = 1.45;
const SPLINTER_MAX_LIFE = 1.95;

const SPLINTER_GROUND_Y = 0.07;
const SPLINTER_GROUND_DELAY = 5.0;
const SPLINTER_GROUND_FADE_DURATION = 1.8;
const SPLINTER_START_OPACITY = 0.95;

const _barrelHitOrigin = new THREE.Vector3();
const _barrelBurstDirection = new THREE.Vector3();
const _barrelBaseCenterWorld = new THREE.Vector3();

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function createBarrelHitParticleSystem() {
  const group = new THREE.Group();
  group.name = 'barrel-hit-particles';

  const dust = [];

  const splinters = [];
  for (let i = 0; i < SPLINTER_PARTICLE_COUNT; i += 1) {
    const material = new THREE.MeshStandardMaterial({
      color: i % 2 === 0 ? 0x7a5230 : 0x684226,
      roughness: 0.96,
      metalness: 0.02,
      transparent: true,
      opacity: 0
    });

    const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.22, 0.04),
    material
    );

    mesh.visible = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);

    splinters.push({
    mesh,
    velocity: new THREE.Vector3(),
    angularVelocity: new THREE.Vector3(),
    life: 0,
    maxLife: 1,
    active: false,
    isGrounded: false,
    groundElapsed: 0
    });
  }

  return {
    group,
    dust,
    splinters
  };
}

function emitBarrelHitParticles(barrel, hitPoint = null) {
  
  const system = barrel.particleSystem;
  if (!system) return;

  if (hitPoint) {
    _barrelHitOrigin.copy(hitPoint);
  } else {
    barrel.root.getWorldPosition(_barrelHitOrigin);
    _barrelHitOrigin.y += 0.2;
  }


  for (let i = 0; i < 12; i += 1) {
    const splinter = system.splinters.find((particle) => !particle.active);
    if (!splinter) break;

    splinter.active = true;
    splinter.life = 0;
    splinter.maxLife = randomRange(SPLINTER_MIN_LIFE, SPLINTER_MAX_LIFE);

    splinter.isGrounded = false;
    splinter.groundElapsed = 0;

    _barrelBurstDirection.set(
      randomRange(-1, 1),
      randomRange(-0.02, 0.25),
      randomRange(-1, 1)
    ).normalize();

    splinter.mesh.visible = true;
    splinter.mesh.position.copy(_barrelHitOrigin);
    splinter.mesh.position.addScaledVector(_barrelBurstDirection, randomRange(0.14, 0.28));
    splinter.mesh.position.y += randomRange(0.015, 0.10);

    splinter.mesh.rotation.set(
      randomRange(0, Math.PI * 2),
      randomRange(0, Math.PI * 2),
      randomRange(0, Math.PI * 2)
    );

    splinter.mesh.material.opacity = SPLINTER_START_OPACITY;

    splinter.velocity.copy(_barrelBurstDirection).multiplyScalar(randomRange(1.1, 1.7));
    splinter.velocity.y += randomRange(0.6, 1.2);

    splinter.angularVelocity.set(
      randomRange(-9, 9),
      randomRange(-9, 9),
      randomRange(-9, 9)
    );
  }
}

function emitBarrelDestroyBaseSplinters(barrel) {
  const system = barrel.particleSystem;
  if (!system) return;

  barrel.root.getWorldPosition(_barrelBaseCenterWorld);
  _barrelBaseCenterWorld.y = SPLINTER_GROUND_Y + 0.02;

  for (let i = 0; i < DESTROY_EXTRA_SPLINTER_COUNT; i += 1) {
    const splinter = system.splinters.find((particle) => !particle.active);
    if (!splinter) break;

    splinter.active = true;
    splinter.life = 0;
    splinter.maxLife = randomRange(SPLINTER_MIN_LIFE, SPLINTER_MAX_LIFE);
    splinter.isGrounded = false;
    splinter.groundElapsed = 0;

    const angle = randomRange(0, Math.PI * 2);
    const radius = randomRange(DESTROY_BASE_RADIUS_MIN, DESTROY_BASE_RADIUS_MAX);
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);

    splinter.mesh.visible = true;
    splinter.mesh.position.copy(_barrelBaseCenterWorld);
    splinter.mesh.position.x += dirX * radius;
    splinter.mesh.position.z += dirZ * radius;
    splinter.mesh.position.y += randomRange(0.02, 0.10);

    splinter.mesh.rotation.set(
      randomRange(0, Math.PI * 2),
      randomRange(0, Math.PI * 2),
      randomRange(0, Math.PI * 2)
    );

    splinter.mesh.material.opacity = SPLINTER_START_OPACITY;

    splinter.velocity.set(
      dirX * randomRange(DESTROY_BASE_OUTWARD_MIN, DESTROY_BASE_OUTWARD_MAX),
      randomRange(DESTROY_BASE_UPWARD_MIN, DESTROY_BASE_UPWARD_MAX),
      dirZ * randomRange(DESTROY_BASE_OUTWARD_MIN, DESTROY_BASE_OUTWARD_MAX)
    );

    splinter.angularVelocity.set(
      randomRange(-5, 5),
      randomRange(-5, 5),
      randomRange(-5, 5)
    );
  }
}

function updateBarrelHitParticles(barrel, deltaTime) {
  const system = barrel.particleSystem;
  if (!system) return;

  let hasActiveParticles = false;



  for (const splinter of system.splinters) {
    if (!splinter.active) continue;
  hasActiveParticles = true;

  if (!splinter.isGrounded) {
    splinter.life += deltaTime;

    splinter.velocity.y -= 5.4 * deltaTime;
    splinter.mesh.position.addScaledVector(splinter.velocity, deltaTime);

    splinter.mesh.rotation.x += splinter.angularVelocity.x * deltaTime;
    splinter.mesh.rotation.y += splinter.angularVelocity.y * deltaTime;
    splinter.mesh.rotation.z += splinter.angularVelocity.z * deltaTime;

    if (splinter.mesh.position.y <= SPLINTER_GROUND_Y) {
      splinter.mesh.position.y = SPLINTER_GROUND_Y;
      splinter.velocity.set(0, 0, 0);
      splinter.angularVelocity.set(0, 0, 0);
      splinter.isGrounded = true;
      splinter.groundElapsed = 0;
      splinter.mesh.material.opacity = SPLINTER_START_OPACITY;
    } else {
      const airT = splinter.life / splinter.maxLife;
      splinter.mesh.material.opacity = Math.max(0.35, (1 - airT) * SPLINTER_START_OPACITY);
      }
    } else {
      splinter.groundElapsed += deltaTime;

      if (splinter.groundElapsed <= SPLINTER_GROUND_DELAY) {
        splinter.mesh.material.opacity = SPLINTER_START_OPACITY;
      } else {
        const fadeT = Math.min(
          (splinter.groundElapsed - SPLINTER_GROUND_DELAY) / SPLINTER_GROUND_FADE_DURATION,
          1
        );

        splinter.mesh.material.opacity = THREE.MathUtils.lerp(
          SPLINTER_START_OPACITY,
          0,
          fadeT
        );

        if (fadeT >= 1) {
          splinter.active = false;
          splinter.mesh.visible = false;
          splinter.mesh.material.opacity = 0;
        }
      }
    }
  }

  if (barrel.isDestroyed && !hasActiveParticles && !barrel.particlesDisposed) {
    system.group.parent?.remove(system.group);
    barrel.particlesDisposed = true;
  }
}


export function createBarrel({
  state,
  registerObstacle,
  position = new THREE.Vector3(-8.2, 0.62, -10.95)
}) {
  const root = new THREE.Group();
  root.position.copy(position);

  const particleSystem = createBarrelHitParticleSystem();
  state.scene.add(particleSystem.group);

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x7a5230,
    roughness: 0.94,
    metalness: 0.03
  });

  const woodAltMaterial = new THREE.MeshStandardMaterial({
    color: 0x684226,
    roughness: 0.96,
    metalness: 0.02
  });

  const woodCapMaterial = new THREE.MeshStandardMaterial({
    color: 0x5d3b23,
    roughness: 0.97,
    metalness: 0.02
  });

  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0x454b52,
    roughness: 0.56,
    metalness: 0.72
  });

  const rivetMaterial = new THREE.MeshStandardMaterial({
    color: 0x6a7078,
    roughness: 0.42,
    metalness: 0.85
  });

  const barrelCore = new THREE.Group();
  root.add(barrelCore);

  const upperBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.50, 0.58, 0.36, 20, 1),
    woodMaterial
  );
  upperBody.position.y = 0.44;
  barrelCore.add(upperBody);

  const middleBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.60, 0.60, 0.52, 20, 1),
    woodMaterial
  );
  middleBody.position.y = 0.0;
  barrelCore.add(middleBody);

  const lowerBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.50, 0.36, 20, 1),
    woodMaterial
  );
  lowerBody.position.y = -0.44;
  barrelCore.add(lowerBody);

  const staveGroup = new THREE.Group();
  root.add(staveGroup);

  const staveCount = 14;
  for (let index = 0; index < staveCount; index += 1) {
    const angle = (index / staveCount) * Math.PI * 2;
    const radius = 0.54;

    const stave = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 1.16, 0.03),
      index % 2 === 0 ? woodMaterial : woodAltMaterial
    );

    stave.position.set(
      Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius
    );
    stave.rotation.y = -angle;
    staveGroup.add(stave);
  }

  const topCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.43, 0.04, 20),
    woodCapMaterial
  );
  topCap.position.y = 0.62;
  root.add(topCap);

  const bottomCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.43, 0.04, 20),
    woodCapMaterial
  );
  bottomCap.position.y = -0.62;
  root.add(bottomCap);

  const topRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.545, 0.03, 8, 28),
    ringMaterial
  );
  topRing.rotation.x = Math.PI * 0.5;
  topRing.position.y = 0.34;
  root.add(topRing);

  const middleRingGroup = new THREE.Group();
  root.add(middleRingGroup);

  const middleRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.60, 0.035, 8, 28),
    ringMaterial
  );
  middleRing.rotation.x = Math.PI * 0.5;
  middleRing.position.y = 0.0;
  middleRingGroup.add(middleRing);

  const bottomRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.545, 0.03, 8, 28),
    ringMaterial
  );
  bottomRing.rotation.x = Math.PI * 0.5;
  bottomRing.position.y = -0.34;
  root.add(bottomRing);

  const topRivetsGroup = addRingRivets(root, 0.58, 0.34, rivetMaterial);
  const middleRivetsGroup = addRingRivets(root, 0.63, 0.0, rivetMaterial);
  const bottomRivetsGroup = addRingRivets(root, 0.58, -0.34, rivetMaterial);

  middleRingGroup.add(middleRivetsGroup);

  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });

  state.scene.add(root);
  registerObstacle(root);

  const barrel = {
    root,
    obstacleObject: root,
    hitMeshes: [],
    maxHp: 15,          // ← HP totali del barile
    hp: 15,  
    isDestroyed: false,
    middleReinforcementGroup: middleRingGroup,
    outerStavesGroup: staveGroup,
    state,
    particleSystem,
    particlesDisposed: false,

    update(deltaTime) {
    updateBarrelHitParticles(this, deltaTime);
    },

    hit(hitPoint = null, damage = 5) {   // ← damage con default = 5 (compatibile col vecchio codice)
        if (this.isDestroyed) return;

        this.hp -= damage;

        root.rotation.z += 0.05;
        root.rotation.x += 0.03;

        emitBarrelHitParticles(this, hitPoint);
        // Colpo: wood_destroy a velocità 1.5 (suono secco e rapido)
        playSound('woodDestroy', { volume: 0.4, playbackRate: 0.9 });

        // Le fasi visive ora si basano sulla percentuale di vita rimanente
        const hpRatio = this.hp / this.maxHp;

        if (hpRatio <= 0.66 && this.middleReinforcementGroup.visible) {
          this.middleReinforcementGroup.visible = false;
        }

        if (hpRatio <= 0.33 && this.outerStavesGroup.visible) {
          this.outerStavesGroup.visible = false;
        }

        if (this.hp <= 0) {
          emitBarrelDestroyBaseSplinters(this);
          this.destroy();
        }
      },

    destroy() {
      if (this.isDestroyed) return;
      this.isDestroyed = true;

      removeObstacle(state, this.obstacleObject);
      root.parent?.remove(root);
      // Distruzione: wood_destroy a velocità normale (più pesante e definitivo)
      playSound('woodDestroy', { volume: 0.60, playbackRate: 1.0 });
    }
  };

  root.traverse((child) => {
    if (!child.isMesh) return;
    barrel.hitMeshes.push(child);
  });

  return barrel;
}

function addRingRivets(parent, radius, y, material) {
  const rivetGroup = new THREE.Group();
  rivetGroup.position.y = y;

  const rivetCount = 8;

  for (let index = 0; index < rivetCount; index += 1) {
    const angle = (index / rivetCount) * Math.PI * 2;

    const rivet = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 8, 8),
      material
    );

    rivet.position.set(
      Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius
    );

    rivetGroup.add(rivet);
  }

  parent.add(rivetGroup);
  return rivetGroup;
}

function removeObstacle(state, object) {
  const index = state.obstacleObjects.indexOf(object);
  if (index >= 0) {
    state.obstacleObjects.splice(index, 1);
  }
}

