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
import { startAxeSwing }                                            from '../world/axe.js';
import { preloadTorchModel, prewarmViewTorch }                      from '../world/torch.js';
import { createInventoryUI }                                        from '../ui/inventory.js';
import { preloadShieldModel, updateShield, ensureViewShield }                         from '../world/shield.js';
import { startSwordSwing, updateSword }                             from '../world/sword.js';
import { createCorridorOneSystem }                                  from '../systems/corridorOneSystem.js';
import { createCorridorTwoSystem }                                  from '../systems/corridorTwoSystem.js';
import { createDeathOverlay }                                       from '../ui/deathOverlay.js';
import { initDeathSystem,updateDeathSystem,updatePendulumHazards }  from '../systems/deathSystem.js';

import { preloadSound, startLoopingSound, 
        stopLoopingSound, setLoopVolume, warmupAudioContext, setAudioContext, getAudioContext, playSound} from '../systems/audioManager.js';

import { setupDebugPositionLogger } from '../systems/debugPosition.js';
import { createCombatHUD }             from '../ui/hud.js';
import { showPlayerHealthBar, updatePlayerHealthBar } from '../world/mob.js';



// Vettore riutilizzabile per calcoli di distanza nel loop (evita allocazioni ogni frame)
const _tempVec = new THREE.Vector3();


// ── Schermo nero iniziale (copre il canvas durante il caricamento) ────────────
const initBlack = document.createElement('div');
initBlack.style.cssText = 'position:fixed;inset:0;background:#000;z-index:999;pointer-events:none;';
document.body.appendChild(initBlack);

// ── Home screen logic ─────────────────────────────────────────────────────────
const homeScreen = document.getElementById('home-screen');
const btnStart   = document.getElementById('btn-start');
const btnExit    = document.getElementById('btn-exit');

btnStart.addEventListener('click', () => {
  warmupAudioContext();


  preloadSound('pickupItem',   './assets/audio/pickup_item.mp3');
  preloadSound('fireIgnition', './assets/audio/fire_ignition.mp3');
  preloadSound('torchOnView',  './assets/audio/fire_manor_torch_onview.mp3');


  // ── Suono click menu ──────────────────────────────────────────────────
  const menuSound = new Audio('./assets/audio/Menu_Open.mp3');
  menuSound.volume = 0.8;
  menuSound.play();
  // ─────────────────────────────────────────────────────────────────────

  // 1. Feedback visivo immediato: fade-out home
  homeScreen.classList.add('fade-out');
  homeScreen.addEventListener('animationend', () => homeScreen.remove(), { once: true });

  // 2. Sblocca AudioContext
  const listener = gameState.audioListener;
  if (listener) {
    const ctx = listener.context;
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // 3. Avvia il caricamento del dungeon
  init();
  animate();
});

btnExit.addEventListener('click', () => {
  // window.close() funziona solo se la tab è stata aperta da JS
  // In caso contrario mostra un messaggio discreto
  const closed = window.close();
  if (!closed) {
    btnExit.textContent = 'Chiudi il browser per uscire';
    btnExit.style.pointerEvents = 'none';
  }
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

// Chiamata da wakeUpSequence quando l'animazione è completata
function onWakeUpComplete() {
  createPlayer(gameState);
  setupInput(gameState, () => tryInteract(gameState), onPrimaryAction);
  setupPointerLock(gameState);
}

async function init() {
  // ── Flag: blocca il render loop finché tutto non è pronto ─────────────────
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

  const audioListener = new THREE.AudioListener();
  gameState.camera.add(audioListener);
  gameState.audioListener = audioListener;

  setAudioContext(audioListener.context);

  const audioLoader = new THREE.AudioLoader();
  audioLoader.load('./assets/audio/sword_sfx.wav', (buffer) => {
    gameState.swordSfxBuffer = buffer;
  });

  gameState.scene.add(gameState.camera);
  createLights(gameState);

  await Promise.all([
    preloadTorchModel('./assets/models/torch/scene.gltf'),
    preloadTorchModel('./assets/models/manor_torch/manor_torch.glb'),
    preloadShieldModel()
  ]);

  await createDungeon(gameState, (object) => registerObstacle(gameState, object));

  prewarmViewTorch(gameState, './assets/models/manor_torch/manor_torch.glb');

  ensureViewShield(gameState);
  if (gameState.viewShieldHolder) {
    gameState.viewShieldHolder.visible = false;
  }
  gameState.hasShield        = false;
  gameState.isShieldEquipped = false;

  gameState.renderer.compile(gameState.scene, gameState.camera);

  setupDebugPositionLogger(gameState);

  createRoomOneSystem(gameState, { showErrorOverlay });
  createCorridorOneSystem(gameState, {showErrorOverlay});
  await createCorridorTwoSystem(gameState, {showErrorOverlay});
  await createRoomTwoSystem(gameState,{showErrorOverlay});
  createDeathOverlay(gameState);
  initDeathSystem(gameState);
  createCombatHUD();

  // Spawn iniziale del dungeon
  gameState.spawnPoint.set(0, PLAYER_HEIGHT * 0.5, 8);

  // ── Imposta lo spawn point PRIMA della camera wake-up ─────────────────────
  // Sostituisci con le coordinate reali dello spawn del tuo dungeon
  gameState.spawnPosition = new THREE.Vector3(0, PLAYER_HEIGHT * 0.5, 8);
  gameState.yaw   = 0;
  gameState.pitch = Math.PI / 2 + 0.08; // guarda il soffitto
  gameState.wakeUpDone = false;

  // ── Avvia la sequenza wake-up (crea canvas overlay nero) ──────────────────
  initWakeUpSequence(gameState, onWakeUpComplete);

  // Il canvas overlay di wakeUpSequence è ora attivo → rimuovi il div iniziale
  initBlack.remove();

  // ── Ora il render loop può partire ────────────────────────────────────────
  gameState.isInitialized = true;

  window.addEventListener('resize', () => onWindowResize(gameState));

  // ── Audio ambientale (lazy, sul primo click) ───────────────────────────────
  async function initAmbientAudio() {
    //const ctx = new (window.AudioContext || window.webkitAudioContext)();
    //if (ctx.state === 'suspended') await ctx.resume();

    const ctx = getAudioContext(); 
    if (!ctx) return;

    const al = new THREE.AudioLoader();
    const [bufferLoop, bufferAir] = await Promise.all([
      new Promise((res) => al.load('./assets/audio/dungeon_sound_effect_2_good.mp3', res)),
      new Promise((res) => al.load('./assets/audio/dungeon_air.mp3', res))
    ]);

    const loopSource = ctx.createBufferSource();
    loopSource.buffer = bufferLoop;
    loopSource.loop = true;
    const loopGain = ctx.createGain();
    loopGain.gain.value = 0.35;
    loopSource.connect(loopGain);
    loopGain.connect(ctx.destination);
    loopSource.start(0);

    const airDuration     = bufferAir.duration;
    const airClipLength   = 10;
    const airOffset       = Math.max(0, airDuration - airClipLength);
    const airFadeIn       = 3;
    const intervalSeconds = 20;

    const airGain = ctx.createGain();
    airGain.gain.value = 0;
    airGain.connect(ctx.destination);

    function scheduleAirOverlay() {
      const source = ctx.createBufferSource();
      source.buffer = bufferAir;
      source.connect(airGain);
      const now = ctx.currentTime;
      airGain.gain.cancelScheduledValues(now);
      airGain.gain.setValueAtTime(0, now);
      airGain.gain.linearRampToValueAtTime(0.55, now + airFadeIn);
      source.start(0, airOffset, airClipLength);
      source.onended = () => {
        airGain.gain.setValueAtTime(0, ctx.currentTime);
        setTimeout(scheduleAirOverlay, intervalSeconds * 1000);
      };
    }
    setTimeout(scheduleAirOverlay, intervalSeconds * 1000);
  }

  const startAmbientOnce = () => {
    preloadSound('woodDestroy',  './assets/audio/wood_destroy.mp3');
    preloadSound('footsteps',    './assets/audio/footsteps.mp3');
    
    preloadSound('bagZip',       './assets/audio/quick_zip_bag.mp3');
    preloadSound('leverPush',    './assets/audio/lever_push.mp3');

    preloadSound('doorOpen',     './assets/audio/door_open.mp3');
    preloadSound('axeSwing',     './assets/audio/axe_swing_2.mp3');
    preloadSound('swordEquip',   './assets/audio/sword_sfx.wav');
    preloadSound('shieldEquip',  './assets/audio/shield_sound_2.mp3');
    preloadSound('whoosh',       './assets/audio/whoosh_axe_trap.mp3');
    preloadSound('axeTrapHit',   './assets/audio/axe_trap_hit_player.mp3');

    preloadSound('damagePlayer', './assets/audio/damage_for_player.mp3');
    preloadSound('deathByMob', './assets/audio/death_player_by_mob.mp3');

    preloadSound('mobDamage', './assets/audio/ogre_growl3.mp3');
    preloadSound('mobDeath', './assets/audio/death_monster_growl.mp3');

    preloadSound('ogre_walk',   './assets/audio/ogre_walk.mp3');
    preloadSound('ogre_growl1', './assets/audio/ogre_growl1.mp3');
    preloadSound('ogre_growl2', './assets/audio/ogre_growl2.mp3');
    preloadSound('ogre_growl3', './assets/audio/ogre_growl3.mp3');
    preloadSound('ogre_attack', './assets/audio/ogre_attack.mp3');
    preloadSound('roll', './assets/audio/rolling_stone.mp3');
    preloadSound('impact', './assets/audio/impact.mp3');


    initAmbientAudio();
    document.removeEventListener('click', startAmbientOnce);
  };
  document.addEventListener('click', startAmbientOnce);
}




function updatePendulumAudio(state) {
  if (!state.pendulums || state.pendulums.length === 0) return;
  if (state.isDead) return;

  // Camera = posizione del player in prima persona
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

  // 1. Aggiorna animazione pendoli
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

      // ── Aggiorna mob stanza 2 ─────────────────────────────────────────────
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

  // 3. Sistemi che devono continuare sempre
  updatePendulumHazards(gameState, deltaTime);
  updateDeathSystem(gameState, deltaTime);
  updateTorches(gameState, deltaTime, elapsedTime);
  updateShield(gameState, deltaTime);
  updateSword(gameState, deltaTime);
  updateCameraTransform(gameState);

  gameState.renderer.render(gameState.scene, gameState.camera);
}