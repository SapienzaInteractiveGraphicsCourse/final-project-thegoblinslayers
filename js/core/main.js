// js/core/main.js

import * as THREE from 'three';
import { gameState }                                                from './state.js';
import { createRenderer }                                           from './renderer.js';
import { createCamera, updateCameraTransform, onWindowResize }      from './camera.js';
import { initWakeUpSequence, updateWakeUpSequence }                 from '../systems/wakeUpSequence.js';
import { createPlayer, updatePlayer }                               from '../player/player.js';
import { setupInput, setupPointerLock }                             from '../player/input.js';
import { registerObstacle }                                         from '../player/collision.js';
import { createUI, showErrorOverlay, createStaminaBar }             from '../ui/ui.js';
import { createDungeon, createLights, updateTorches }               from '../world/dungeon.js';
import { INTERACTION_DISTANCE, PLAYER_HEIGHT }                      from './config.js';
import { updateInteraction, tryInteract }                           from '../systems/interactionSystem.js';
import { createRoomOneSystem }                                      from '../systems/roomOneSystem.js';
import { createRoomTwoSystem } from '../systems/roomTwoSystem.js';
import { preloadAxeModel, prewarmViewAxe,startAxeSwing }            from '../world/axe.js';
import { preloadTorchModel, prewarmViewTorch }                      from '../world/torch.js';
import { createInventoryUI }                                        from '../ui/inventory.js';
import { prewarmViewShield, preloadShieldModel, 
          updateShield, ensureViewShield }                          from '../world/shield.js';
import { startSwordSwing, updateSword }                             from '../world/sword.js';
import { createCorridorOneSystem }                                  from '../systems/corridorOneSystem.js';
import { createCorridorTwoSystem }                                  from '../systems/corridorTwoSystem.js';
import { createDeathOverlay }                                       from '../ui/deathOverlay.js';
import { initDeathSystem,updateDeathSystem,updatePendulumHazards }  from '../systems/deathSystem.js';

import { initAmbientAudio, preloadGameSounds }                      from '../systems/audioSetup.js';
import { preloadSound, startLoopingSound, 
        stopLoopingSound, setLoopVolume, warmupAudioContext,
        setAudioContext, getAudioContext, playSound}                from '../systems/audioManager.js';

import { setupDebugPositionLogger }                                 from '../systems/debugPosition.js';
import { createCombatHUD }                                          from '../ui/hud.js';
import { showPlayerHealthBar, updatePlayerHealthBar }               from '../world/mob.js';





/** 
* Pre-compile all WebGL variant shaders to avoid spikes during gameplay. 
* 
* Theory: WebGL compiles a GLSL program the first time it is used (onFirstUse). 
* Three.js generates different variants based on the number of active lights in the scene. 
* By turning on all lights before compiling, we force everyone to compile 
* variants needed during loading, not during gameplay. 
*/


// Reusable vector for distance calculations in the loop (avoids allocations every frame)
const _tempVec = new THREE.Vector3();

// ── Initial black screen (covers canvas while loading) ────────────
const initBlack = document.createElement('div');
initBlack.style.cssText = 'position:fixed;inset:0;background:#000;z-index:999;pointer-events:none;';
document.body.appendChild(initBlack);

// ── Home screen logic ─────────────────────────────────────────────────────────
const homeScreen = document.getElementById('home-screen');
const winScreen = document.getElementById('win-screen');
const btnStart1   = document.getElementById('btn-start1');
const btnStart2   = document.getElementById('btn-start2');

btnStart1.addEventListener('click', async () => {
  warmupAudioContext();


  // ── Suono click menu ──────────────────────────────────────────────────
  const menuSound = new Audio('./assets/audio/Menu_Open.mp3');
  menuSound.volume = 0.8;
  menuSound.play();
  // ─────────────────────────────────────────────────────────────────────

  // 1. visual Feedback : fade-out home
  homeScreen.classList.add('fade-out');
  homeScreen.addEventListener('animationend', () => homeScreen.remove(), { once: true });

  gameState.isLoading = true;
  document.getElementById("loading-screen").style.display = "flex";

  // 2. Unlock AudioContext
  const listener = gameState.audioListener;
  if (listener) {
    const ctx = listener.context;
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // 3. start the loading of dungeon
  await init();
  gameState.isLoading = false;

  // Wait 1 second to "Ready!" before hiding the loading screen
  await new Promise(resolve => setTimeout(resolve, 1000));

  document.getElementById("loading-screen").style.display = "none";
  gameState.isInitialized = true;

  animate();
});

btnStart2.addEventListener('click', async () => {
  window.location.reload();
});

// ─────────────────────────────────────────────────────────────────────────────

function onPrimaryAction() {
  if (gameState.isDead) return;
  if (gameState.isSwordEquipped) {
    const wasSwinging = gameState.isSwordSwinging;
    startSwordSwing(gameState);
    if (!wasSwinging && gameState.isSwordSwinging && gameState.swordSfxBuffer && gameState.audioListener) {
      const sound = new THREE.Audio(gameState.audioListener);
      sound.setBuffer(gameState.swordSfxBuffer);
      sound.setVolume(0.3);
      sound.play();
    }
  } else if (gameState.isAxeEquipped) {
    startAxeSwing(gameState);
  }
}

// Called by wakeUpSequence when the animation is complete
function onWakeUpComplete() {
  createPlayer(gameState);
  setupInput(gameState, () => tryInteract(gameState), onPrimaryAction);
  setupPointerLock(gameState);
}


// Manual progress bar in stages
function setLoadingProgress(pct, label) {
  const fill = document.getElementById('loading-bar-fill');
  const perc = document.getElementById('loading-percent');
  const lbl  = document.getElementById('loading-label');
  if (fill) fill.style.width  = Math.min(100, pct) + '%';
  if (perc) perc.textContent  = Math.min(100, pct) + '%';
  if (lbl)  lbl.textContent   = label;
}
// ─────────────────────────────────────────────────────────────────────────

async function init() {
  // ── Flag: Block the render loop until everything is ready
  gameState.isInitialized = false;

  gameState.scene = new THREE.Scene();
  gameState.scene.background = new THREE.Color(0x101820);
  gameState.scene.fog = new THREE.Fog(0x101820, 30, 70);

  gameState.clock    = new THREE.Clock();
  gameState.renderer = createRenderer();

  createUI(gameState);
  createStaminaBar();
  createInventoryUI(gameState);
  createCamera(gameState);

  setLoadingProgress(5, 'Initialization...'); 

  const audioListener = new THREE.AudioListener();
  gameState.camera.add(audioListener);
  gameState.audioListener = audioListener;

  setAudioContext(audioListener.context);

  preloadGameSounds(); // avvia il preload in background durante il loading

  const audioLoader = new THREE.AudioLoader();
  audioLoader.load('./assets/audio/sword_sfx.wav', (buffer) => {
    gameState.swordSfxBuffer = buffer;
  });

  gameState.scene.add(gameState.camera);
  createLights(gameState);

  setLoadingProgress(15, 'Loading models...');

  await Promise.all([
    preloadTorchModel('./assets/models/torch/scene.gltf'),
    preloadTorchModel('./assets/models/manor_torch/manor_torch.glb'),
    preloadAxeModel(),
    preloadShieldModel()
  ]);

  setLoadingProgress(40, 'Dungeon construction...');

  await createDungeon(gameState, (object) => registerObstacle(gameState, object));

  setLoadingProgress(60, 'Preparation of objects...');

  prewarmViewTorch(gameState, './assets/models/manor_torch/manor_torch.glb');
  prewarmViewAxe(gameState, gameState.renderer);   
  prewarmViewShield(gameState, gameState.renderer);

  // ── Pre-warm shader variant: scudo visibile + torcia spenta ──────────────
  // Problema: quando il giocatore switcha torcia→scudo, il numero di luci attive
  // cambia (SpotLight + fillLight della torcia si spengono). Questo forza WebGL
  // a compilare un nuovo variant shader ON THE FLY → spike di lag.
  // Soluzione: precompiliamo questa combinazione durante il loading.
  if (gameState.viewShieldHolder) {
      gameState.viewShieldHolder.visible = true; // scudo visibile
  }
  if (gameState.heldTorch?.group) {
      gameState.heldTorch.group.visible = false;
      if (gameState.heldTorch.spotLight) gameState.heldTorch.spotLight.visible = false;
      if (gameState.heldTorch.fillLight) gameState.heldTorch.fillLight.visible = false;
  }
  // Compila il variant shader con questa combinazione
  if (typeof gameState.renderer.compileAsync === 'function') {
      await gameState.renderer.compileAsync(gameState.scene, gameState.camera);
  } else {
      gameState.renderer.compile(gameState.scene, gameState.camera);
  }
  // Ripristina tutto nascosto
  if (gameState.viewShieldHolder) {
      gameState.viewShieldHolder.visible = false;
  }
  // ────────────────────────────────────────────────────────────────────────

  gameState.hasShield        = false;
  gameState.isShieldEquipped = false;

  

  setupDebugPositionLogger(gameState);

  setLoadingProgress(70, 'Loading rooms...'); 

  createRoomOneSystem(gameState, { showErrorOverlay });
  createCorridorOneSystem(gameState, {showErrorOverlay});
  await createCorridorTwoSystem(gameState, {showErrorOverlay});
  await createRoomTwoSystem(gameState,{showErrorOverlay});
  createDeathOverlay(gameState);
  initDeathSystem(gameState);
  createCombatHUD();


  setLoadingProgress(85, 'Compiling shader...');


// ── Unified warm-up: one traverse for textures + shaders + lights ───────
// Theory: WebGL compiles different variant shaders for each light combination
// active. initTexture() preloads textures into VRAM. Doing everything in one
// single traverse we avoid 3 separate passes on the scene graph (O(n) instead O(3n)).
const _warmHiddenLights   = [];
const _warmRescaledPivots = [];
const _warmHiddenMeshes   = [];

gameState.scene.traverse((child) => {

  // ── Early return: salta Group vuoti, Bone, Object3D decorativi ───────────
  const isLight  = child.isPointLight || child.isSpotLight || child.isDirectionalLight;
  const isMesh   = child.isMesh;
  const isFlame  = child.name?.toLowerCase().includes('flame') && child.scale.x < 0.001;
  
  if (!isLight && !isMesh && !isFlame) return;
  
  //Temporarily turn off lights -> compile variant "lights on"
  if (isLight && !child.visible) {
    child.visible = true;
    _warmHiddenLights.push(child);
  }

  if (isFlame) {
    child.scale.setScalar(1.0);
    _warmRescaledPivots.push(child);
  }

  if (isMesh) {
    if (!child.visible) {
      child.visible = true;
      _warmHiddenMeshes.push(child);
    }
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      if (!mat) continue;
      const textures = [
        mat.map, mat.normalMap, mat.roughnessMap,
        mat.metalnessMap, mat.displacementMap,
        mat.aoMap, mat.emissiveMap
      ];
      for (const tex of textures) {
        if (tex) gameState.renderer.initTexture(tex);
      }
    }
  }
});

// Compile all variant shaders asynchronously (does not block the main thread
// if the GPU driver supports the KHR_parallel_shader_compile extension)
if (typeof gameState.renderer.compileAsync === 'function') {
  await gameState.renderer.compileAsync(gameState.scene, gameState.camera);
} else {
  gameState.renderer.compile(gameState.scene, gameState.camera);
}

// Restore everything to its original state (lights off, flames invisible, meshes hidden)
for (const l of _warmHiddenLights)   l.visible = false;
for (const p of _warmRescaledPivots) p.scale.setScalar(0.0001);
for (const m of _warmHiddenMeshes)   m.visible = false;
// ─────────────────────────────────────────────────────────────────────────

setLoadingProgress(100, 'Ready!');

// ── Shader warm-up complete: pre-compile all variant shaders ───────────
// The problem: Three.js generates different variant shaders based on the number of
// active lights. If a light is off (visible=false) at compile time,
// the variant "with that light on" is not compiled -> spike on first access.
// Solution: Temporarily turn on ALL lights, compile, turn off again.
//await _prewarmAllShaders(gameState);
// ──────────────────────────────────── 


  // Spawn point: set the initial position of the player and camera before wake-up
  gameState.spawnPoint.set(0, PLAYER_HEIGHT * 0.5, 8);

  // ── Set spawn point BEFORE wake-up camera ───────────────────── 
// Replace with the actual coordinates of your dungeon spawn
  gameState.spawnPosition = new THREE.Vector3(0, PLAYER_HEIGHT * 0.5, 8);
  gameState.yaw   = 0;
  gameState.pitch = Math.PI / 2 + 0.08; // guarda il soffitto
  gameState.wakeUpDone = false;

  // ── Start wake-up sequence (create black canvas overlay) ──────────────────
  initWakeUpSequence(gameState, onWakeUpComplete);

  // The wakeUpSequence canvas overlay is now active -> remove the initial div
  initBlack.remove();

  window.addEventListener('resize', () => onWindowResize(gameState));



  const startAmbientOnce = () => {
    //preloadGameSounds();      
    initAmbientAudio();       
    document.removeEventListener('click', startAmbientOnce);
  };
  document.addEventListener('click', startAmbientOnce);
}

function updatePendulumAudio(state) {
  if (!state.pendulums || state.pendulums.length === 0) return;
  if (state.isDead) return;

  // Camera = first-person player position
  const playerPos = state.camera.position;

  let minDist = Infinity;
  for (const p of state.pendulums) {
    if (p.isFrozen) continue;
    p.getHitPointWorld(_tempVec);
    const d = _tempVec.distanceTo(playerPos);
    if (d < minDist) minDist = d;
  }

  if (minDist < WHOOSH_START_DIST) {
    const t = 1 - (minDist - WHOOSH_MAX_DIST) / (WHOOSH_START_DIST - WHOOSH_MAX_DIST);
    const vol = Math.max(0, Math.min(1, t)) * 0.7;
    startLoopingSound('whoosh', { volume: vol });
    setLoopVolume('whoosh', vol);
  } else {
    stopLoopingSound('whoosh');
  }
}

// function for showing the win screen and freezing the gameplay when the player wins
function triggerWin(){
  if (gameState.hasWon) return;
  gameState.hasWon = true;

  gameState.isDead = true; // reused for freezeng the gameplay
  gameState.isInitialized = false;
  stopLoopingSound('footsteps');

  const winScreen = document.getElementById("win-screen");
  winScreen.classList.add("active"); // changes css  for the winning screen
}

function animate() {
  requestAnimationFrame(animate);

  if (!gameState.isInitialized) return;
  if (!gameState.camera || !gameState.renderer || !gameState.scene || !gameState.clock) return;

  const deltaTime = Math.min(gameState.clock.getDelta(), 0.1);
  const elapsedTime = gameState.clock.elapsedTime;

  updateWakeUpSequence(deltaTime);

  if (!gameState.wakeUpDone) {
    updateTorches(gameState, deltaTime, elapsedTime);
    updateDeathSystem(gameState, deltaTime);
    updateCameraTransform(gameState);
    gameState.renderer.render(gameState.scene, gameState.camera);
    return;
  }

  // 1. Update pendulum animation
  if (gameState.pendulums) {
    for (const pendulum of gameState.pendulums) {
      pendulum.update(deltaTime, gameState.camera.position);
    }
  }

  // 2. Gameplay normale solo se non sei morto
  if (!gameState.isDead) {
    updatePlayer(gameState, deltaTime);
    gameState.roomOne?.update(deltaTime);
    gameState.corridorOne?.update(deltaTime);
    gameState.corridorTwo?.update(deltaTime);

    gameState.roomTwo?.update(deltaTime);

      // ── Update mob room 2 ────────────────────── ───────────────────────
    if (gameState.mob) {
        gameState.mob.update(deltaTime, gameState);
    }

    updateInteraction({
      camera: gameState.camera,
      renderer: gameState.renderer,
      interactableMeshes: gameState.interactableMeshes,
      interactionTextElement: gameState.interactionTextElement,
      interactionDistance: INTERACTION_DISTANCE,
      state: gameState,
      deltaTime
    });
  }

  // 3. Systems that must always continue
  updatePendulumHazards(gameState, deltaTime);
  updateDeathSystem(gameState, deltaTime);
  updateTorches(gameState, deltaTime, elapsedTime);
  updateShield(gameState, deltaTime);
  updateSword(gameState, deltaTime);
  updateCameraTransform(gameState);
  // implementation of the win zone
  if(!gameState.hasWon && gameState.camera){
    const x = gameState.camera.position.x;
    const z = gameState.camera.position.z;

    const winZone = (
      x<32 && x>31 && z>-25-1.2 && z<-25+1.2
    );
    if(winZone){
      triggerWin();
    }
  }

  gameState.renderer.render(gameState.scene, gameState.camera);
}