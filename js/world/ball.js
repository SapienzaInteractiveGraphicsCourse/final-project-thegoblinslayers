// ball.js
import * as THREE from 'three';
import {
  startLoopingSound,
  stopLoopingSound,
  setLoopVolume,
  playSound
} from '../systems/audioManager.js';
const BALL_START = new THREE.Vector3(11.5, 0.03, -25.0);
const BALL_TARGET = new THREE.Vector3(0.0, 0.03, -25.0);

const BALL_RADIUS = 1.15;
const BALL_SPEED = 3.0;
const ROLL_DELAY = 3.0;

export async function createBall({
  scene,
  registerObstacle,
  showErrorOverlay,
  wallTextures
}) {
  const pathVector = new THREE.Vector3().subVectors(BALL_TARGET, BALL_START);
  const pathLength = pathVector.length();
  const direction = pathVector.clone().normalize();

  const ball = {
    group: null,
    visualMesh: null,

    isRolling: false,
    hasStopped: false,
    _pendingStart: false,
    rollDelayTimer: 0,
    travelledDistance: 0,

    worldCenter: new THREE.Vector3(),

    triggerRoll() {
      if (this.isRolling || this.hasStopped || this._pendingStart) return;
      this._pendingStart = true;
      this.rollDelayTimer = ROLL_DELAY;
      //console.log('[Ball] triggerRoll()');
    },

    reset() {
      if (!this.group) return;

      this.group.position.copy(BALL_START);

      if (this.visualMesh) {
        this.visualMesh.rotation.set(0, 0, 0);
      }

      this.isRolling = false;
      this.hasStopped = false;
      this._pendingStart = false;
      this.rollDelayTimer = 0;
      this.travelledDistance = 0;

      this.updateWorldCenter();
      //console.log('[Ball] reset()');
    },

    updateWorldCenter() {
      if (!this.group) return;
      this.group.getWorldPosition(this.worldCenter);
      this.worldCenter.y += BALL_RADIUS;
    },

    update(deltaTime, playerPos=null) {
      if (!this.group) return;

      if (this._pendingStart && !this.isRolling) {
        this.rollDelayTimer -= deltaTime;
        if (this.rollDelayTimer <= 0) {
          this._pendingStart = false;
          this.isRolling = true;
          //console.log('[Ball] Rolling start');
          if(playerPos){
            const dist = this.worldCenter.distanceTo(playerPos);
            if(dist<=10){
              const t = 1 - dist / 10;
              const volume = Math.max(0.35, t * 2.0);
              startLoopingSound('roll', {
                volume
              });
            }
          }
        }
      }

      if (this.isRolling && !this.hasStopped) {
        const step = BALL_SPEED * deltaTime;
        this.travelledDistance += step;

        if (this.travelledDistance >= pathLength) {
          this.travelledDistance = pathLength;
          this.isRolling = false;
          this.hasStopped = true;
          stopLoopingSound('roll');
          playSound('impact', {volume: 0.2});
        }

        this.group.position.copy(BALL_START).addScaledVector(direction, this.travelledDistance);
        this.group.position.y = BALL_START.y;
        this.group.position.z = BALL_START.z;

        if (this.visualMesh) {
          const angularStep = step / BALL_RADIUS;
          this.visualMesh.rotation.z += angularStep;
        }
      }

      this.updateWorldCenter();
    },

    checkPlayerHit(playerPos, playerRadius) {
      if (!this.group) return false;
      const dist = this.worldCenter.distanceTo(playerPos);
      return dist < (BALL_RADIUS + playerRadius);
    }
  };

  try {
    if (!wallTextures || !wallTextures.map) {
      throw new Error('Texture muro non disponibili');
    }

    // Cloniamo le texture per non alterare quelle dei muri
    const colorMap = wallTextures.map.clone();
    colorMap.needsUpdate = true;
    colorMap.wrapS = THREE.RepeatWrapping;
    colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.repeat.set(3.2, 2.0);
    colorMap.offset.set(0.18, 0.0);
    colorMap.colorSpace = THREE.SRGBColorSpace;

    const maxAnisotropy =
      scene?.renderer?.capabilities?.getMaxAnisotropy?.() || 8;
    colorMap.anisotropy = maxAnisotropy;

    let normalMap = null;
    if (wallTextures.normalMap) {
      normalMap = wallTextures.normalMap.clone();
      normalMap.needsUpdate = true;
      normalMap.wrapS = THREE.RepeatWrapping;
      normalMap.wrapT = THREE.RepeatWrapping;
      normalMap.repeat.set(3.2, 2.0);
      normalMap.offset.set(0.18, 0.0);
      normalMap.anisotropy = maxAnisotropy;
    }

    let roughnessMap = null;
    if (wallTextures.roughnessMap) {
      roughnessMap = wallTextures.roughnessMap.clone();
      roughnessMap.needsUpdate = true;
      roughnessMap.wrapS = THREE.RepeatWrapping;
      roughnessMap.wrapT = THREE.RepeatWrapping;
      roughnessMap.repeat.set(3.2, 2.0);
      roughnessMap.offset.set(0.18, 0.0);
      roughnessMap.anisotropy = maxAnisotropy;
    }

    // Più segmenti = shading e silhouette più puliti
    const sphereGeometry = new THREE.SphereGeometry(BALL_RADIUS, 96, 64);

    const sphereMaterial = new THREE.MeshStandardMaterial({
      map: colorMap,
      normalMap: normalMap,
      roughnessMap: roughnessMap,
      roughness: 1.0,
      metalness: 0.0,
      color: new THREE.Color(0xb8b1a3)
    });

    if (normalMap) {
      sphereMaterial.normalScale = new THREE.Vector2(0.45, 0.45);
    }

    ball.group = new THREE.Group();
    ball.group.position.copy(BALL_START);

    ball.visualMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    ball.visualMesh.castShadow = true;
    ball.visualMesh.receiveShadow = true;

    // Centro della sfera a radius sopra il pavimento
    ball.visualMesh.position.set(0, BALL_RADIUS, 0);

    scene.add(ball.group);
    ball.group.add(ball.visualMesh);

    if (registerObstacle) {
      registerObstacle(ball.group);
    }

    ball.updateWorldCenter();

    //console.log('[Ball] loaded with improved shared wall textures');
    //console.log('[Ball] start:', BALL_START.x, BALL_START.y, BALL_START.z);
    //console.log('[Ball] target:', BALL_TARGET.x, BALL_TARGET.y, BALL_TARGET.z);
    //console.log('[Ball] texture repeat:', colorMap.repeat.x, colorMap.repeat.y);
    //console.log('[Ball] texture offset:', colorMap.offset.x, colorMap.offset.y);
  } catch (error) {
    console.error('[Ball] load error:', error);
    if (showErrorOverlay) showErrorOverlay('Errore setup palla');
  }

  return ball;
}