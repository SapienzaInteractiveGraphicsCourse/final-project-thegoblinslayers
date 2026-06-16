// mob.js
// Mob della stanza 2: ogre 3D con AnimationMixer.
// Tutta la logica di danno, movimento, spawn, lifebar e suoni è invariata.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { registerObstacle } from '../player/collision.js';
import { playSound, startLoopingSound, stopLoopingSound } from '../systems/audioManager.js';
import { triggerDamageVignette,   } from '../ui/screenEffects.js';

// ── Costanti di gioco (invariate) ─────────────────────────────────────────────
const MOB_HP_MAX       = 300;
const MOB_SPEED        = 3.8;
const MOB_ATTACK_RANGE = 2.0;
const MOB_CHAIN_HIT_RANGE = 2.25;   // hit effettiva attackChain
const MOB_POWER_HIT_RANGE = 2.45;   // hit effettiva powerAttack
const MOB_SHIELD_BASH_HIT_RANGE = 2.55; // hit effettiva bash
//const MOB_ATTACK_RATE  = 1.8;
const MOB_STOP_RADIUS  = 1.0;
const ACTIVATE_DELAY   = 1.5;
const MOB_HALF_W       = 0.35;


// Danno per tipo di attacco — valori separati e bilanciati
const MOB_CHAIN_DAMAGE        = 12;   // colpo normale: rapido, basso
const MOB_POWER_DAMAGE        = 35;   // power attack: lento, devastante
const MOB_SHIELD_BASH_DAMAGE  = 25;   // shield bash: break guardia + danno fisso


// timeScale > 1 = animazione più veloce, < 1 = più lenta.
// Calibra questo valore fino a ottenere ~1.5s per catena completa.
const ATK_TIME_SCALE = 1.6;
const POWER_ATTACK_TIME_SCALE = 1.35;
const SHIELD_BASH_TIME_SCALE = 1.45;


const SHIELD_HIT_THRESHOLD = 2; // colpi ricevuti prima di attivare lo scudo
const PHASE2_SHIELD_HIT_THRESHOLD = 1;
const PHASE2_BLOCK_CHANCE = 0.55;

const MOB_MAX_BLOCK_REACTIONS = 3;       // colpi prima di abbassare lo scudo
const MOB_BLOCK_REACTION_COOLDOWN = 0.4; // secondi minimi tra una reaction e l'altra


const PHASE2_POWER_BASE_CHANCE = 0.30;
const PHASE2_POWER_BONUS_AFTER_2_CHAINS = 0.45;
const PHASE2_POWER_FORCED_AFTER_3_CHAINS = true;
const POWER_ATTACK_COOLDOWN = 2.5;

const ROOM2_MIN_X =  14.0;
const ROOM2_MAX_X =  31.5;
const ROOM2_MIN_Z = -35.0;
const ROOM2_MAX_Z = -16.0;

// ── Log diagnostico centralizzato ────────────────────────────────────────────
// Ogni messaggio mostra: [mob][tempo] emoji label | dettagli
let _mobLogStart = null;
function _log(label, data = '') {
  if (!_mobLogStart) _mobLogStart = performance.now();
  const t = ((performance.now() - _mobLogStart) / 1000).toFixed(2);
  console.log(`[mob][${t}s] ${label}`, data);
}




const _toPlayer  = new THREE.Vector3();
const _mobPos    = new THREE.Vector3();
const _playerPos = new THREE.Vector3();


// ── Nomi animazioni nel GLTF (nomi esatti dal log del loader) ────────────────
const ANIM = {
  IDLE_PATROL:      'Ogre_IdlePatrol',
  //WALK:           'Ogre_WalkForward',
  RUN:              'Ogre_RunForward', 

  IDLE:             'Ogre_Idle',
  ATK_ENTER:        'Ogre_AttackLeft_Enter',
  ATK_IDLE:         'Ogre_AttackLeft_Idle',
  ATK_DAMAGE:       'Ogre_AttackLeft_Damage',

  ATK_ENTER_R:      'Ogre_AttackRight_Enter',   
  ATK_IDLE_R:       'Ogre_AttackRight_Idle',    
  ATK_DAMAGE_R:     'Ogre_AttackRight_Damage',

  SHIELD_ENTER:     'Ogre_ShieldBash_Enter',
  SHIELD_IDLE:      'Ogre_ShieldBash_Idle',
  SHIELD_BASH:      'Ogre_ShieldBash',

  POWER_ATTACK:     'Ogre_Attack_PowerAttack',
  STAGGER:          'Ogre_StaggerBack',
  RECOIL_IDLE:      'Ogre_Recoil_Idle',

  
  BLOCK_ENTER: 'Ogre_Block_Enter',
  BLOCK: 'Ogre_Block',
  BLOCK_REACTION: 'Ogre_Block_Reaction',
  BLOCK_LOWER: 'Ogre_Block_Lower',

  

};




const MOB_SPEED_RUN      = 4;   // unità/sec in modalità run

// Durata crossfade tra animazioni (secondi)
const FADE = 0.02;

const _loader = new GLTFLoader();
const OGRE_MODEL_PATH = './assets/models/ogre_mob/scene.gltf';

// ── Caricamento modello GLTF ──────────────────────────────────────────────────
function loadOgreModel(onLoaded) {
  _loader.load(
    OGRE_MODEL_PATH,
    (gltf) => {
      const model = gltf.scene;

      // Il nodo root Sketchfabmodel ha già una matrice interna con scala 97x
      // e swap Y/Z. Three.js la applica come matrice locale, quindi il modello
      // risulta già posizionato correttamente rispetto al suo centro.
      // Dobbiamo solo: azzerare le rotazioni ereditate e scalare a dimensioni gioco.
      
      // Azzeramento rotazione: il nodo "NPC" dentro lo skeleton ha rotation
      // quaternion (0, 0.707, 0.707, 0) = 90° su X+Z → Three.js la legge
      // come matrice decomposed, quindi dobbiamo applicare una contro-rotazione
      // sul gruppo esterno.
      model.rotation.set(0, 0, 0);

      // Scala: la matrice interna porta il modello a ~0.978 unità di altezza.
      // L'ogre dovrebbe essere circa 2 unità (2m). Scala fine.
      model.scale.setScalar(1.0);

      // Ombre
      model.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow    = true;
        child.receiveShadow = true;
      });

      onLoaded(model, gltf.animations);
    },
    undefined,
    (err) => console.error('[mob] Errore caricamento ogre:', err)
  );
}

// ── Creazione mob ─────────────────────────────────────────────────────────────
export function createMob(state, position) {
  // Group vuoto — il modello viene aggiunto quando il GLTF è caricato
  const group = new THREE.Group();
  group.position.copy(position);
  group.position.y = 0;
  state.scene.add(group);
  //registerObstacle(state, group);

  // hitMeshes provvisori (box invisibili) per il raycast dell'ascia/spada
  // verranno sostituiti con le mesh reali appena il modello carica
  const bodyGeo  = new THREE.BoxGeometry(0.70, 1.80, 0.50);
  const bodyMat  = new THREE.MeshStandardMaterial({ visible: false });
  const bodyHit  = new THREE.Mesh(bodyGeo, bodyMat);
  bodyHit.position.y = 0.90;
  group.add(bodyHit);

  const mob = {
    group,
    hp:               MOB_HP_MAX,

    // ── Audio state ───────────────────────────────────────────────────────
    _walkSoundPlaying: false,

    _fadeMaterials: [],

    isDead:           false,
    isActive:         false,
    _waitingForPlate: true,
    _activateTimer:   0,
    //_attackTimer:     0,
    _attackPhase:     'idle',
    hitMeshes:        [bodyHit],
     _chainCounter: 0,

    // Animazione
    _mixer:           null,
    _currentAction:   null,
    _currentAnimName: null,
    _isStaggering:    false,
    _attackStep:      0,   // 0=idle, 1=enter, 2=idle_atk, 3=damage

    _attackLeftTurn: true,   // ← alterna Left/Right ad ogni catena

    _hitCounter:      0,      // conta i colpi ricevuti consecutivi
    _isShielding:     false,  // true durante tutta la sequenza scudo

    _isPhase2: false,
    _phase2PowerLanded: false,

    _isBlocking: false,
    _blockTimer: 0,
    _blockDuration: 2.0,
    _blockDamageMultiplier: 0.2,
    _blockReactionCount:    0,
    _blockReactionCooldown: 0,   // timer decrescente


    _powerAttackAction: null,
    _powerAttackHitChecked: false,
    _powerAttackHitLanded: false,
    _powerAttackHitRatio: 0.5,

    _normalAttackAction: null,
    _normalAttackHitChecked: false,
    _normalAttackHitLanded: false,
    _normalAttackHitRatio: 0.30,

    _normalChainsSincePower: 0,
    _powerAttackCooldownTimer: 0,
    _lastAttackType: 'none', // 'none' | 'normal' | 'power' | 'block'

    _deathState: 'none',      // 'none' | 'stagger' | 'recoil' | 'dissolve'
    _deathTimer: 0,
    _deathHoldDuration: 2.0,
    _deathFadeDuration: 2.0,
    _isDissolving: false,


    _flashWhiteTimeoutId: null,
    _flashWhiteToken: 0,

    // ── update ────────────────────────────────────────────────────────────
update(deltaTime, state) {
  if (this._blockReactionCooldown > 0) {
    this._blockReactionCooldown -= deltaTime;
  }

  if (this._mixer) this._mixer.update(deltaTime);

  this._updatePowerAttackHitWindow(state);
  this._updateNormalAttackHitWindow(state);

  if (this._powerAttackCooldownTimer > 0) {
    this._powerAttackCooldownTimer = Math.max(0, this._powerAttackCooldownTimer - deltaTime);
  }

    if (this.isDead) {
    this._updateDeathSequence(deltaTime);
    return;
    }

  if (this._waitingForPlate) {
    this._playAnim(ANIM.IDLE_PATROL, true);
    return;
  }

  if (!this.isActive) {
    this._activateTimer += deltaTime;
    if (this._activateTimer >= ACTIVATE_DELAY) this.isActive = true;
    this._playAnim(ANIM.IDLE_PATROL, true);
    return;
  }

  if (state.isDead) {
    this._playAnim(ANIM.IDLE_PATROL, true);
    return;
  }

  if (this._isStaggering) return;
  if (this._isShielding) return;

  if (this._isBlocking) {
  this._blockTimer += deltaTime;

  if (this._blockTimer >= this._blockDuration) {
    this._isBlocking = false;
    this._blockTimer = 0;
      this._blockReactionCount = 0;     
  this._blockReactionCooldown = 0; 
    this._attackPhase = 'idle';
    this._currentAction = null;
    this._currentAnimName = null;
    _log(`🛡️ Block END`, `torno a rincorrere`);
  }

  return;
}

  this.group.getWorldPosition(_mobPos);
  state.camera.getWorldPosition(_playerPos);
  _toPlayer.subVectors(_playerPos, _mobPos);
  _toPlayer.y = 0;

  const dist = _toPlayer.length();

  if (dist > 0.01) {
    this.group.rotation.y = Math.atan2(_toPlayer.x, _toPlayer.z);
  }

  // Se sto già attaccando, non interrompere la chain
  if (this._attackPhase === 'attacking') {
    return;
  }

if (dist <= MOB_ATTACK_RANGE) {
  this._attackPhase = 'attacking';
  this._attackStep = 0;
  this._stopWalkSound();  

  if (this._shouldUsePowerAttack()) {
    this._startPowerAttack(state);
  } else {
    this._startAttackChain(state);
  }

  return;
}

  this._attackPhase = 'chasing';
  this._attackStep = 0;

  this._playAnim(ANIM.RUN, true);

  this._startWalkSound(); 

  if (dist > MOB_STOP_RADIUS) {
    const step = MOB_SPEED_RUN * deltaTime;
    _toPlayer.normalize();

    const nx = Math.max(
      ROOM2_MIN_X + MOB_HALF_W,
      Math.min(ROOM2_MAX_X - MOB_HALF_W, _mobPos.x + _toPlayer.x * step)
    );
    const nz = Math.max(
      ROOM2_MIN_Z + MOB_HALF_W,
      Math.min(ROOM2_MAX_Z - MOB_HALF_W, _mobPos.z + _toPlayer.z * step)
    );

    this.group.position.x = nx;
    this.group.position.z = nz;
  }
},

_updatePowerAttackHitWindow(state) {
  if (!this._powerAttackAction) return;
  if (this._powerAttackHitChecked) return;
  if (this._currentAnimName !== ANIM.POWER_ATTACK) return;

  const clip = this._powerAttackAction.getClip();
  if (!clip) return;

  const hitTime = clip.duration * this._powerAttackHitRatio;

  if (this._powerAttackAction.time < hitTime) return;

  this._powerAttackHitChecked = true;

  this.group.getWorldPosition(_mobPos);
  state.camera.getWorldPosition(_playerPos);
  _toPlayer.subVectors(_playerPos, _mobPos);
  _toPlayer.y = 0;
  const distNow = _toPlayer.length();

  if (distNow <= MOB_POWER_HIT_RANGE) {
    this._powerAttackHitLanded = true;
    this._phase2PowerLanded = true;
    _log(`🔥 PowerAttack HIT`,
    `danno:${MOB_POWER_DAMAGE} | dist:${distNow.toFixed(2)} | range:${MOB_POWER_HIT_RANGE} | t:${this._powerAttackAction.time.toFixed(2)}/${clip.duration.toFixed(2)}`);
    dealDamageToPlayer(state, MOB_POWER_DAMAGE);
    showMobHealthBar();
    if (shouldPlayAttackSound(state)) playSound('ogre_attack', { volume: 1.0 });
  } else {
    this._powerAttackHitLanded = false;
    _log(`🔥 PowerAttack MISS`, `dist:${distNow.toFixed(2)} | range:${MOB_ATTACK_RANGE} | t:${this._powerAttackAction.time.toFixed(2)}/${clip.duration.toFixed(2)}`);
  }
},

_updateNormalAttackHitWindow(state) {
if (!this._normalAttackAction) return;
if (this._normalAttackHitChecked) return;

const isDamageAnim =
this._currentAnimName === ANIM.ATK_DAMAGE ||
this._currentAnimName === ANIM.ATK_DAMAGE_R;

if (!isDamageAnim) return;

const clip = this._normalAttackAction.getClip();
if (!clip) return;

const hitTime = clip.duration * this._normalAttackHitRatio;
if (this._normalAttackAction.time < hitTime) return;

this._normalAttackHitChecked = true;

this.group.getWorldPosition(_mobPos);
state.camera.getWorldPosition(_playerPos);
_toPlayer.subVectors(_playerPos, _mobPos);
_toPlayer.y = 0;
const distNow = _toPlayer.length();

if (distNow <= MOB_CHAIN_HIT_RANGE) {
this._normalAttackHitLanded = true;
_log(`💢 AttackChain HIT`, `danno:${MOB_CHAIN_DAMAGE} | 
anim:${this._currentAnimName} | dist:${distNow.toFixed(2)} | range:${MOB_CHAIN_HIT_RANGE} | t:${this._normalAttackAction.time.toFixed(2)}/${clip.duration.toFixed(2)}`);

dealDamageToPlayer(state, MOB_CHAIN_DAMAGE);
showMobHealthBar();
if (shouldPlayAttackSound(state)) playSound('ogre_attack', { volume: 0.8 });
} else {
this._normalAttackHitLanded = false;
_log(
`🫥 AttackChain MISS`,
`anim:${this._currentAnimName} | dist:${distNow.toFixed(2)} | range:${MOB_CHAIN_HIT_RANGE} | t:${this._normalAttackAction.time.toFixed(2)}/${clip.duration.toFixed(2)}`
);
}
},



_flashWhite(duration = 0.08) {
if (!this._fadeMaterials || this._fadeMaterials.length === 0) return;

this._flashWhiteToken++;
const token = this._flashWhiteToken;

if (this._flashWhiteTimeoutId) {
clearTimeout(this._flashWhiteTimeoutId);
this._flashWhiteTimeoutId = null;
}

const originals = this._fadeMaterials.map((mat) => ({
color: mat.emissive?.getHex() ?? 0x000000,
intensity: mat.emissiveIntensity ?? 0,
}));

for (const mat of this._fadeMaterials) {
if (!mat) continue;
if (mat.emissive) mat.emissive.setHex(0xffffff);
mat.emissiveIntensity = 1.5;
}

this._flashWhiteTimeoutId = setTimeout(() => {
if (token !== this._flashWhiteToken) return;

this._fadeMaterials.forEach((mat, i) => {
if (!mat) return;
if (mat.emissive) mat.emissive.setHex(originals[i].color);
mat.emissiveIntensity = originals[i].intensity;
});

this._flashWhiteTimeoutId = null;
}, duration * 1000);
},

_playBlockSequence() {
  if (!this._mixer || this._isBlocking || this._isShielding || this.isDead) return;

  this._isBlocking = true;
  this._isStaggering = false;
  this._attackPhase = 'blocking';
  this._blockTimer = 0;
  this._chainCounter++;

  //this._mixer.stopAllAction();
  
  //this._clearAllFinishedListeners();
  //this._currentAction = null;
  //this._currentAnimName = null;

  this._lastAttackType = 'block';

  // Raffreddamento: il block abbassa la pressione offensiva,
  // ma non la azzera del tutto.
  const prevChains = this._normalChainsSincePower;
  this._normalChainsSincePower = Math.max(0, this._normalChainsSincePower - 1);

  _log(
    `🛡️ Block START`,
    `durata:${this._blockDuration}s | normalChains:${prevChains} -> ${this._normalChainsSincePower}`
  );

  //this._playAnim(ANIM.BLOCK_ENTER, false, 1.0);

  //const expectedEnter = this._currentAction;

  this._clearAllFinishedListeners();

  const expectedEnter = this._hardSwitchTo(ANIM.BLOCK_ENTER, false, 1.0);
  if (!expectedEnter) return;

  const onEnter = (e) => {
    if (e.action !== expectedEnter) return;
    this._mixer.removeEventListener('finished', onEnter);

    if (!this._isBlocking || this.isDead) return;

    _log(`🛡️ Block HOLD`, `anim:${ANIM.BLOCK}`);
    //this._playAnim(ANIM.BLOCK, true, 1.0);
    const holdAction = this._hardSwitchTo(ANIM.BLOCK, true, 1.0);
    if (!holdAction) return;
  };

  this._mixer.addEventListener('finished', onEnter);
},


_updateDeathSequence(deltaTime) {
  if (this._deathState === 'recoil') {
    this._deathTimer += deltaTime;

    if (this._deathTimer >= this._deathHoldDuration) {
      this._deathState = 'dissolve';
      this._deathTimer = 0;
      this._isDissolving = true;
      _log(`☁️ DISSOLVE START`, `durata:${this._deathFadeDuration}s`);
    }

    return;
  }

if (this._deathState === 'dissolve') {
  this._deathTimer += deltaTime;

  const t = Math.min(this._deathTimer / this._deathFadeDuration, 1);
  const opacity = 1 - t;

  for (const mat of this._fadeMaterials) {
    mat.opacity = opacity;
    mat.depthWrite = false;
  }

  if (t >= 1) {
    _log(`🫥 DESPAWN`, `dissolve completato`);
    if (this._mixer) {
      this._mixer.stopAllAction();
      this._clearAllFinishedListeners();
    }
    this.group.parent?.remove(this.group);
    hideMobHealthBar();
    this._deathState = 'done';
  }
}
},

// ── Audio helpers ─────────────────────────────────────────────────────

_startWalkSound() {
    if (this._walkSoundPlaying) return;
    this._walkSoundPlaying = true;
    startLoopingSound('ogre_walk', { volume: 0.6 });
},

_stopWalkSound() {
    if (!this._walkSoundPlaying) return;
    this._walkSoundPlaying = false;
    stopLoopingSound('ogre_walk');
},

_playRandomGrowl() {
    const idx = Math.floor(Math.random() * 2) + 1;
    playSound(`ogre_growl${idx}`, { volume: 0.85 });
},

_stopAllCombatSounds() {
    this._stopWalkSound();
    // I growl sono one-shot su AudioContext nativo: non hanno un handle
    // da stoppare, si esauriscono da soli. Non serve stop esplicito.
},



// Rimuove tutti i listener 'finished' dal mixer in modo sicuro.
// Usato quando si interrompe bruscamente una catena (stagger, shield, morte).
_clearAllFinishedListeners() {
  if (!this._mixer) return;
  // Three.js espone _listeners come oggetto interno — non è API pubblica
  // ma è l'unico modo per fare cleanup completo senza tenere reference a ogni callback.
  // Alternativa sicura: sostituire il mixer con uno nuovo.
  if (this._mixer._listeners && this._mixer._listeners['finished']) {
    this._mixer._listeners['finished'] = [];
  }
  _log(`🧹 clearAllFinishedListeners — listener rimossi`);
},

_hardSwitchTo(name, loop = false, timeScale = 1.0) {
if (!this._mixer) return null;

const next = this._getAction(name);
if (!next) {
_log(`❌ _hardSwitchTo — clip non trovata`, `"${name}"`);
return null;
}

// Stop solo delle action realmente esistenti nel controller del mob
const candidates = [
this._currentAction,
this._powerAttackAction,
this._normalAttackAction,
this._getAction(ANIM.RUN),
this._getAction(ANIM.IDLE_PATROL),
this._getAction(ANIM.ATK_ENTER),
this._getAction(ANIM.ATK_DAMAGE),
this._getAction(ANIM.ATK_ENTER_R),
this._getAction(ANIM.ATK_DAMAGE_R),
this._getAction(ANIM.SHIELD_ENTER),
this._getAction(ANIM.SHIELD_IDLE),
this._getAction(ANIM.SHIELD_BASH),
this._getAction(ANIM.BLOCK_ENTER),
this._getAction(ANIM.BLOCK),
this._getAction(ANIM.BLOCK_REACTION),
this._getAction(ANIM.BLOCK_LOWER), 
this._getAction(ANIM.STAGGER),
this._getAction(ANIM.RECOIL_IDLE),
].filter(Boolean);

const unique = [...new Set(candidates)];

for (const action of unique) {
action.enabled = false;
action.stop();
}

next.enabled = true;
next.reset();
next.setEffectiveWeight(1);
next.setEffectiveTimeScale(timeScale);
next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
next.clampWhenFinished = !loop;
next.play();

this._currentAction = next;
this._currentAnimName = name;

_log(`🎬 _hardSwitchTo`, `${name} | loop:${loop} | speed:${timeScale}x`);

return next;
},

_canUsePowerAttack() {
  return (
    this._isPhase2 &&
    !this.isDead &&
    !this._isStaggering &&
    !this._isShielding &&
    !this._isBlocking &&
    this._attackPhase === 'attacking' &&
    this._powerAttackCooldownTimer <= 0
  );
},

_shouldUsePowerAttack() {
  if (!this._canUsePowerAttack()) return false;

  // Dopo 3 chain normali consecutive, forzo il power attack
  if (PHASE2_POWER_FORCED_AFTER_3_CHAINS && this._normalChainsSincePower >= 3) {
    _log(`🔥 PowerAttack DECISION`, `forzato dopo ${this._normalChainsSincePower} chain normali`);
    return true;
  }

  let chance = PHASE2_POWER_BASE_CHANCE;

  // Dopo 2 chain normali alzo molto la probabilità
  if (this._normalChainsSincePower >= 2) {
    chance += PHASE2_POWER_BONUS_AFTER_2_CHAINS;
  }

  const roll = Math.random();
  const usePower = roll < chance;

  _log(
    `🔥 PowerAttack DECISION`,
    `roll:${roll.toFixed(2)} | chance:${chance.toFixed(2)} | normalChains:${this._normalChainsSincePower}`
  );

  return usePower;
},


_startPowerAttack(state) {
  const chainId = ++this._chainCounter;

    this._lastAttackType = 'power';
    this._normalChainsSincePower = 0;
    this._powerAttackCooldownTimer = POWER_ATTACK_COOLDOWN;

  _log(`🔥 PowerAttack START`, `chainId:${chainId} | phase2:${this._isPhase2}`);

  const isValid = () => {
    const ok =
      !this.isDead &&
      !this._isStaggering &&
      !this._isShielding &&
      this._attackPhase === 'attacking' &&
      this._chainCounter === chainId;

    if (!ok) {
      _log(
        `🔥 PowerAttack INVALIDATO`,
        `chainId:${chainId} | dead:${this.isDead} | phase:${this._attackPhase} | counter:${this._chainCounter}`
      );
    }

    return ok;
  };

  if (!isValid()) return;

  this._attackStep = 0;
  this._powerAttackHitChecked = false;
  this._powerAttackHitLanded = false;

  this._playAnim(ANIM.POWER_ATTACK, false, POWER_ATTACK_TIME_SCALE);

  this._playRandomGrowl();

  const expectedAction = this._currentAction;
  this._powerAttackAction = expectedAction;

  const clip = expectedAction?.getClip?.();
  if (clip) {
    _log(
      `🔥 PowerAttack WINDUP`,
      `hitWindow:${(clip.duration * this._powerAttackHitRatio).toFixed(2)}s / duration:${clip.duration.toFixed(2)}s`
    );
  }

  const onPowerEnd = (e) => {
    if (e.action !== expectedAction) return;
    this._mixer.removeEventListener('finished', onPowerEnd);

    if (this._powerAttackAction === expectedAction) {
      this._powerAttackAction = null;
    }

    if (!isValid()) return;

    if (this._powerAttackHitLanded) {
    _log(`🔥 PowerAttack END`, `colpo riuscito -> resetto pressione power`);
    } else {
    _log(`🔥 PowerAttack END`, `colpo mancato -> resto libero di riselezionarlo più avanti`);
    }

    this._attackPhase = 'idle';
    this._attackStep = 0;
  };

  this._mixer.addEventListener('finished', onPowerEnd);
},





// ── Catena animazioni attacco: Enter → Damage ─────────────────────────
_startAttackChain(state) {
const chainId = ++this._chainCounter;
this._lastAttackType = 'normal';

const isLeft = this._attackLeftTurn;
this._attackLeftTurn = !this._attackLeftTurn;

const ENTER = isLeft ? ANIM.ATK_ENTER : ANIM.ATK_ENTER_R;
const DAMAGE = isLeft ? ANIM.ATK_DAMAGE : ANIM.ATK_DAMAGE_R;
const side = isLeft ? 'LEFT' : 'RIGHT';

_log(`⚔️ AttackChain START`, `chainId:${chainId} | side:${side} | mode:ENTER->DAMAGE`);

const isValid = () => {
const ok =
!this.isDead &&
!this._isStaggering &&
!this._isShielding &&
this._attackPhase === 'attacking' &&
this._chainCounter === chainId;

if (!ok) {
_log(
`⚔️ AttackChain INVALIDATA`,
`chainId:${chainId} | dead:${this.isDead} | phase:${this._attackPhase} | counter:${this._chainCounter}`
);
}

return ok;
};

const playStep1 = () => {
if (!isValid()) return;

this._attackStep = 1;
_log(`⚔️ Fase 1 — ENTER`, `anim:${ENTER} | speed:1.0x`);
this._playAnim(ENTER, false, ATK_TIME_SCALE);

const expectedAction = this._currentAction;

const onEnter = (e) => {
if (e.action !== expectedAction) return;
this._mixer.removeEventListener('finished', onEnter);
playStep3();
};

this._mixer.addEventListener('finished', onEnter);
};

const playStep3 = () => {
if (!isValid()) return;

this._attackStep = 3;
this._normalAttackHitChecked = false;
this._normalAttackHitLanded = false;

_log(`⚔️ Fase 2 — DAMAGE`, `anim:${DAMAGE} | speed:1.0x`);
this._playAnim(DAMAGE, false, ATK_TIME_SCALE);

this._playRandomGrowl();

const expectedAction = this._currentAction;
this._normalAttackAction = expectedAction;

const clip = expectedAction?.getClip?.();
if (clip) {
_log(
`⚔️ AttackChain WINDUP`,
`anim:${DAMAGE} | hitWindow:${(clip.duration * this._normalAttackHitRatio).toFixed(2)}s | duration:${clip.duration.toFixed(2)}s`
);
}

const onDamage = (e) => {
if (e.action !== expectedAction) return;
this._mixer.removeEventListener('finished', onDamage);

if (this._normalAttackAction === expectedAction) {
this._normalAttackAction = null;
}

if (!isValid()) return;

this.group.getWorldPosition(_mobPos);
state.camera.getWorldPosition(_playerPos);
_toPlayer.subVectors(_playerPos, _mobPos);
_toPlayer.y = 0;
const distAfter = _toPlayer.length();

_log(
`⚔️ Fase 2 — DAMAGE finita`,
`chainId:${chainId} | dist:${distAfter.toFixed(2)} | hit:${this._normalAttackHitLanded}`
);

if (distAfter <= MOB_CHAIN_HIT_RANGE) {
this._normalChainsSincePower++;
_log(
`⚔️ Chain CONTINUE`,
`normalChainsSincePower:${this._normalChainsSincePower}`
);

this._attackPhase = 'idle';
this._attackStep = 0;
} else {
this._attackPhase = 'chasing';
this._attackStep = 0;
}
};

this._mixer.addEventListener('finished', onDamage);
};

playStep1();
},

takeDamage(amount, state) {
  if (this.isDead) return false;

  _log(
    `💥 takeDamage`,
    `danno:${amount} | HP:${this.hp} | shielding:${this._isShielding} | blocking:${this._isBlocking} | staggering:${this._isStaggering} | hitCounter:${this._hitCounter + 1}/${SHIELD_HIT_THRESHOLD}`
  );

  // 1) Shield bash / guardia forte: danno completamente bloccato
  if (this._isShielding) {
    _log(`🛡️ DANNO BLOCCATO`, `dallo scudo`);
    return false;
  }


// 2) Block normale: danno azzerato + sistema reaction con contatore e cooldown
if (this._isBlocking) {
  _log(`🛡️ BLOCK HIT`, `danno:0 (scudo regge) | reaction:${this._blockReactionCount + 1}/${MOB_MAX_BLOCK_REACTIONS}`);

  // Aggiorna HP a 0 di danno — ma aggiorna comunque la barra per visibilità
  //this._flashWhite();

  // Cooldown attivo → lo scudo assorbe silenziosamente, nessuna animazione
  if (this._blockReactionCooldown > 0) {
    _log(`🛡️ BLOCK HIT assorbito`, `cooldown attivo:${this._blockReactionCooldown.toFixed(2)}s`);
    return false;
  }

  this._blockReactionCount++;
  this._blockReactionCooldown = MOB_BLOCK_REACTION_COOLDOWN;

  // Soglia superata → block break: lo scudo cede e il mob contrattacca
  if (this._blockReactionCount >= MOB_MAX_BLOCK_REACTIONS) {
    _log(`🛡️ BLOCK BREAK`, `scudo ceduto dopo ${this._blockReactionCount} colpi → contrattacco`);
    this._isBlocking = false;
    this._blockTimer = 0;
    this._blockReactionCount = 0;
    this._blockReactionCooldown = 0;

    this._clearAllFinishedListeners();

    const lowerAction = this._hardSwitchTo(ANIM.BLOCK_LOWER ?? ANIM.BLOCK_ENTER, false, 1.0);
    if (!lowerAction) {
      this._attackPhase = 'idle';
      return false;
    }

    const onLowerEnd = (e) => {
      if (e.action !== lowerAction) return;
      this._mixer.removeEventListener('finished', onLowerEnd);
      _log(`🛡️ Block Lower END`, `riprendo attacco`);
      this._attackPhase = 'idle';
      this._attackStep = 0;
      this._currentAction = null;
      this._currentAnimName = null;
    };
    this._mixer.addEventListener('finished', onLowerEnd);
    return false;
  }

  // Reaction normale
  this._clearAllFinishedListeners();

  const reactionAction = this._hardSwitchTo(ANIM.BLOCK_REACTION, false, 1.0);
  if (!reactionAction) return false;

  const onReactionEnd = (e) => {
    if (e.action !== reactionAction) return;
    this._mixer.removeEventListener('finished', onReactionEnd);

    if (!this._isBlocking || this.isDead) return;

    _log(`🛡️ BLOCK REACTION END`, `torno in guardia`);
    this._hardSwitchTo(ANIM.BLOCK, true, 1.0);
  };

  this._mixer.addEventListener('finished', onReactionEnd);
  return false;
}

  // 3) Caso normale: prende danno pieno
  this.hp = Math.max(0, this.hp - amount);
  updateMobHealthBar(this.hp, MOB_HP_MAX);
  showMobHealthBar();

  this._flashWhite();

  this._isPhase2 = this.hp <= MOB_HP_MAX * 0.5;

  if (this._isPhase2 && !this._phase2PowerLanded) {
    _log(`🔥 PHASE 2`, `HP:${this.hp}/${MOB_HP_MAX} <= 50%`);
  }

  this._hitCounter++;

  _log(`❤️ HP aggiornato`, `${this.hp + amount} → ${this.hp} | hitCounter:${this._hitCounter}`);

  if (this.hp <= 0) {
    _log(`💀 HP a zero`, `avvio death sequence`);
    this._die(state);
    return true;
  }

  // 4) Nuova scelta: block normale in phase 2 con probabilità moderata
 const shieldThreshold = this._isPhase2
  ? PHASE2_SHIELD_HIT_THRESHOLD
  : SHIELD_HIT_THRESHOLD;

const shouldUseNormalBlock =
  this._isPhase2 &&
  !this._isShielding &&
  !this._isBlocking &&
  !this._isStaggering &&
  Math.random() < PHASE2_BLOCK_CHANCE;

if (shouldUseNormalBlock) {
  this._hitCounter = 0;
  _log(`🛡️ Difesa normale`, `phase2:true | chance:${PHASE2_BLOCK_CHANCE}`);
  this._playBlockSequence();
} else if (this._hitCounter >= shieldThreshold) {
  this._hitCounter = 0;
  _log(`🛡️ Shield trigger`, `phase2:${this._isPhase2} | threshold:${shieldThreshold}`);
  this._playShieldSequence(state);
} else {
  _log(`🌀 Sotto soglia — attivo Stagger`, `hitCounter:${this._hitCounter}/${shieldThreshold}`);
  this._playStagger();
}

  return false;
},


_playShieldSequence(state) {
  if (!this._mixer || this._isShielding) {
    _log(`⚠️ Shield IGNORATA`, `mixer:${!!this._mixer} | già in shield:${this._isShielding}`);
    return;
  }

  this._isShielding  = true;
  this._isStaggering = false;
  this._chainCounter++;
  this._attackPhase = 'shielding';

  _log(`🛡️  Shield sequence START`);

  // Pulizia pulita invece di hack su _listeners
  //this._mixer.stopAllAction();
  
  this._clearAllFinishedListeners();
  /*this._currentAction   = null;
  this._currentAnimName = null;*/

  this._lastAttackType = 'block';
  this._normalChainsSincePower = 0;

  // Fase 1: Enter
  _log(`🛡️  Shield Fase 1 — ENTER`);
  //this._playAnim(ANIM.SHIELD_ENTER, false, 1.0);
  const shieldEnter = this._hardSwitchTo(ANIM.SHIELD_ENTER, false, SHIELD_BASH_TIME_SCALE);
  if (!shieldEnter) return;

  const onEnter = (e) => {
  if (e.action !== shieldEnter) return;
  this._mixer.removeEventListener('finished', onEnter);
  if (this.isDead) { this._isShielding = false; return; }

  _log(`🛡️ Shield Fase 2 — IDLE guardia`);
  const shieldIdle = this._hardSwitchTo(ANIM.SHIELD_IDLE, false, SHIELD_BASH_TIME_SCALE);
  if (!shieldIdle) return;

  const onIdle = (e2) => {
  if (e2.action !== shieldIdle) return;
  this._mixer.removeEventListener('finished', onIdle);
  if (this.isDead) { this._isShielding = false; return; }

  this.group.getWorldPosition(_mobPos);
  state.camera.getWorldPosition(_playerPos);
  _toPlayer.subVectors(_playerPos, _mobPos);
  _toPlayer.y = 0;
  const dist = _toPlayer.length();

  _log(`🛡️ Shield Fase 3 — BASH`, `distanza player:${dist.toFixed(2)} | range:${MOB_SHIELD_BASH_HIT_RANGE.toFixed(2)}`);
  const bashAction = this._hardSwitchTo(ANIM.SHIELD_BASH, false, SHIELD_BASH_TIME_SCALE);
  if (!bashAction) return;

  this._playRandomGrowl();

  if (dist <= MOB_SHIELD_BASH_HIT_RANGE) {
  //const bashDmg = MOB_ATTACK_DAMAGE * 1.3 | 0;
  _log(`🛡️ Shield BASH colpisce`, `danno:${MOB_SHIELD_BASH_DAMAGE}`);
  damagePlayer(state, MOB_SHIELD_BASH_DAMAGE);
  showMobHealthBar();
  if (shouldPlayAttackSound(state)) playSound('ogre_attack', { volume: 0.9 });
  } else {
  _log(`🛡️ Shield BASH mancato`, `player fuori range`);
  }

  const onBash = (e3) => {
  if (e3.action !== bashAction) return;
  this._mixer.removeEventListener('finished', onBash);
  this._isShielding = false;
  this._currentAction = null;
  this._currentAnimName = null;
  this._attackPhase = 'idle';
  _log(`🛡️ Shield sequence END — torno normale`);
  };

  this._mixer.addEventListener('finished', onBash);
  };

  this._mixer.addEventListener('finished', onIdle);
  };

  this._mixer.addEventListener('finished', onEnter);
},



_playStagger() {
  if (!this._mixer) {
    _log(`⚠️ Stagger IGNORATO`, `mixer non inizializzato`);
    return;
  }
  if (this._isStaggering) {
    _log(`⚠️ Stagger IGNORATO`, `già in stagger`);
    return;
  }

  _log(`🌀 Stagger START`, `animazione:${ANIM.STAGGER} | phase:${this._attackPhase}`);

  this._isStaggering = true;
  this._chainCounter++;        // invalida catene attacco pendenti
  this._attackPhase  = 'idle';

  // Stop pulito: fermiamo tutto e ripartiamo da zero con lo stagger
  //this._mixer.stopAllAction();
  
  this._clearAllFinishedListeners();

  this._stopAllCombatSounds();

  this._currentAction   = null;
  this._currentAnimName = null;

  this._normalAttackAction = null;
  this._normalAttackHitChecked = false;
  this._normalAttackHitLanded = false;

  this._powerAttackAction = null;
  this._powerAttackHitChecked = false;
  this._powerAttackHitLanded = false;

  const staggerAction = this._hardSwitchTo(ANIM.STAGGER, false, 1.0);
  if (!staggerAction) {
    this._isStaggering = false;
    _log(`❌ Stagger clip non trovata: "${ANIM.STAGGER}"`);
    return;
  }

  /*staggerAction.reset().setLoop(THREE.LoopOnce, 1);
  staggerAction.clampWhenFinished = true;
  staggerAction.timeScale = 1.0;
  staggerAction.fadeIn(0.12).play();

  this._currentAction   = staggerAction;
  this._currentAnimName = ANIM.STAGGER;*/

  const onStaggerEnd = (e) => {
    if (e.action !== staggerAction) return;
    this._mixer.removeEventListener('finished', onStaggerEnd);
    this._isStaggering    = false;
    this._currentAction   = null;
    this._currentAnimName = null;



    this._attackPhase     = 'idle';
    _log(`✅ Stagger END`, `torno ad idle — update() decide il prossimo stato`);
  };

  this._mixer.addEventListener('finished', onStaggerEnd);
},
    // ── Utility: play animazione con crossfade ────────────────────────────
_playAnim(name, loop = true, timeScale = 1.0) {
  if (!this._mixer) return;

  if (loop && this._currentAnimName === name) return;

  const action = this._getAction(name);
  if (!action) {
    _log(`❌ _playAnim — clip non trovata`, `"${name}"`);
    return;
  }

  _log(`🎬 _playAnim`, `${name} | loop:${loop} | speed:${timeScale}x | prev:${this._currentAnimName ?? 'none'}`);

  if (this._currentAction) this._currentAction.fadeOut(FADE);

  action.reset();
  action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
  action.clampWhenFinished = !loop;
  action.timeScale = timeScale;
  action.fadeIn(FADE).play();

  this._currentAction = action;
  this._currentAnimName = name;
},

    // ── Utility: recupera AnimationAction dal mixer ───────────────────────
    _getAction(name) {
      if (!this._mixer || !this._clips) return null;
      const clip = THREE.AnimationClip.findByName(this._clips, name);
      if (!clip) {
        console.warn(`[mob] Animazione non trovata: "${name}"`);
        return null;
      }
      return this._mixer.clipAction(clip);
    },

    // ── activateFromPlate ─────────────────────────────────────────────────
    activateFromPlate() {
      if (this.isDead) return;
      this._waitingForPlate = false;
      this._activateTimer   = 0;
      this.isActive         = false;
    },

    // ── _die ──────────────────────────────────────────────────────────────
_die(state) {
  if (this.isDead) return;

  this.isDead = true;
  this.isActive = false;
  this._waitingForPlate = false;

  this._chainCounter++;
  this._chainCooldown = 0;
  this._attackPhase = 'dead';
  this._attackStep = 0;

  this._isShielding = false;
  this._isStaggering = false;
  this._hitCounter = 0;

  this._deathState = 'stagger';
  this._deathTimer = 0;
  this._isDissolving = false;

  this._blockReactionCount    = 0;
this._blockReactionCooldown = 0;
this._onBlockHit            = null;


  this._normalChainsSincePower = 0;
  this._powerAttackCooldownTimer = 0;
  this._lastAttackType = 'none';

  if (this._mixer) {
    this._mixer.stopAllAction();
    this._clearAllFinishedListeners();
  }

  this._currentAction = null;
  this._currentAnimName = null;

  this._normalAttackAction = null;
this._normalAttackHitChecked = false;
this._normalAttackHitLanded = false;

    this._powerAttackAction = null;
    this._powerAttackHitChecked = false;
    this._powerAttackHitLanded = false;

  _log(`💀 MORTE`, `death sequence: stagger -> recoil(2s) -> dissolve(2s)`);

  regenAndHidePlayerBar(state);

  this.group.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    for (const mat of materials) {
      if (!mat) continue;
      mat.transparent = true;
      mat.opacity = 1;
      mat.depthWrite = true;
    }
  });

  if (!this._mixer) {
    this._deathState = 'dissolve';
    return;
  }

  const staggerAction = this._getAction(ANIM.STAGGER);
  const recoilAction = this._getAction(ANIM.RECOIL_IDLE);

  if (!staggerAction || !recoilAction) {
    _log(`⚠️ Death fallback`, `clip mancante stagger o recoil`);
    this._deathState = 'dissolve';
    return;
  }

  staggerAction.reset();
  staggerAction.setLoop(THREE.LoopOnce, 1);
  staggerAction.clampWhenFinished = true;
  staggerAction.timeScale = 1.0;
  staggerAction.fadeIn(0.12).play();

  this._currentAction = staggerAction;
  this._currentAnimName = ANIM.STAGGER;

  const onDeathStaggerEnd = (e) => {
    if (e.action !== staggerAction) return;
    this._mixer.removeEventListener('finished', onDeathStaggerEnd);

    if (!this.isDead) return;

    _log(`☠️ STAGGER END`, `passo a recoil idle`);

    recoilAction.reset();
    recoilAction.setLoop(THREE.LoopRepeat, Infinity);
    recoilAction.clampWhenFinished = true;
    recoilAction.timeScale = 1.0;
    recoilAction.fadeIn(0.1).play();

    this._currentAction = recoilAction;
    this._currentAnimName = ANIM.RECOIL_IDLE;

    this._deathState = 'recoil';
    this._deathTimer = 0;
  };

  this._mixer.addEventListener('finished', onDeathStaggerEnd);
},

    // ── reset ─────────────────────────────────────────────────────────────
reset(position) {
  this.hp = MOB_HP_MAX;
  this.isDead = false;
  this.isActive = false;
  this._waitingForPlate = true;
  this._activateTimer = 0;

  this._attackPhase = 'idle';
  this._attackStep = 0;
  this._isStaggering = false;
  this._isShielding = false;

  this._currentAction = null;
  this._currentAnimName = null;

  this._chainCounter = 0;
  this._chainCooldown = 0;
  this._attackLeftTurn = true;
  this._hitCounter = 0;

  this._isPhase2 = false;
  this._phase2PowerLanded = false;

  this._powerAttackAction = null;
  this._powerAttackHitChecked = false;
  this._powerAttackHitLanded = false;

  this._normalAttackAction = null;
this._normalAttackHitChecked = false;
this._normalAttackHitLanded = false;

  this._deathState = 'none';
  this._deathTimer = 0;
  this._isDissolving = false;

  this._normalChainsSincePower = 0;
  this._powerAttackCooldownTimer = 0;
  this._lastAttackType = 'none';

  this._blockReactionCount    = 0;
this._blockReactionCooldown = 0;
this._onBlockHit            = null;



  if (!this.group.parent) state.scene.add(this.group);

  for (const mat of this._fadeMaterials) {
  mat.transparent = false;
  mat.opacity = 1;
  mat.depthWrite = true;
}

  if (this._mixer) {
    this._mixer.stopAllAction();
    this._clearAllFinishedListeners();
    this._playAnim(ANIM.IDLE_PATROL, true);
  }


  this._stopWalkSound();             
  this._walkSoundPlaying = false; 

  this.group.position.copy(position);
  this.group.position.y = 0;

  updateMobHealthBar(MOB_HP_MAX, MOB_HP_MAX);
  hideMobHealthBar();
}
  };  // ← fine oggetto mob

  // ── Carica il modello GLTF e aggancia mixer ───────────────────────────────
  loadOgreModel((model, animations) => {
    // Posiziona i piedi sul pavimento: calcola bounding box del modello
    const box = new THREE.Box3().setFromObject(model);
    const minY = box.min.y;
    // Se il modello non è già con i piedi a y=0, traslalo verso l'alto
    if (minY < -0.01) {
      model.position.y = -minY;
    }

    group.add(model);

    mob._fadeMaterials = [];


    const realMeshes = [];
    model.traverse((child) => {
        if (!child.isMesh || !child.material) return;

        realMeshes.push(child);

        const materials = Array.isArray(child.material)
        ? child.material.map((mat) => mat.clone())
        : [child.material.clone()];

        child.material = Array.isArray(child.material) ? materials : materials[0];

        for (const mat of materials) {
        mat.transparent = true;
        mat.opacity = 1;
        mat.depthWrite = true;
        mob._fadeMaterials.push(mat);
        }
    });

    if (realMeshes.length > 0) {
        mob.hitMeshes = realMeshes;
        group.remove(bodyHit);
    }

    // Crea AnimationMixer sul modello — THREE.AnimationMixer riceve l'oggetto
    // root della gerarchia su cui le clip animano i nodi figli
    mob._mixer = new THREE.AnimationMixer(model);
    mob._clips = animations;


    // ── Neutralizza il root motion su tutte le clip ───────────────────────────
    // Le clip FBX/Sketchfab animano spesso il nodo root spostandolo in avanti.
    // In Three.js il mixer applica queste traslazioni direttamente alla mesh,
    // causando uno scatto ad ogni loop. Rimuoviamo le tracce di posizione
    // del nodo root da tutte le clip di movimento.
    for (const clip of animations) {
    clip.tracks = clip.tracks.filter((track) => {
        // Rimuove SOLO le tracce ".position" del nodo root (primo livello)
        // Mantiene tutte le tracce delle ossa figlie (contengono "Bone" o "mixamorig")
        const isRootPosition = track.name.endsWith('.position') &&
        !track.name.includes('Bone') &&
        !track.name.includes('mixamorig') &&
        !track.name.includes('spine') &&
        !track.name.includes('hip') &&
        !track.name.includes('Hips');
        return !isRootPosition;
    });
    }




    // Parte subito con IdlePatrol in loop
    mob._playAnim(ANIM.IDLE_PATROL, true);

    console.log('[mob] Ogre caricato. Animazioni disponibili:',
      animations.map(a => a.name).join(', '));
  });

  state.mob = mob;
  return mob;
}

// ── Danno al player (invariato) ───────────────────────────────────────────────
function damagePlayer(state, amount) {
  if (state.isDead) return;
  if (state.respawnInvulnerability > 0) return;

  if (state.isBlocking && state.isShieldEquipped && !state.shieldBroken) {
    amount = Math.floor(amount * 0.5);
    state.shieldHP = (state.shieldHP ?? 3) - 1;
    _flashShield(state);
    if (state.shieldHP <= 0) _breakShield(state);
  }

  state.playerHP = Math.max(0, (state.playerHP ?? 100) - amount);
  state.damageFlash = Math.min(1.0, (state.damageFlash ?? 0) + 0.35);

  triggerDamageVignette();

  updatePlayerHealthBar(state.playerHP, state.playerHPMax ?? 100);

  if (state.playerHP <= 0) {
    playSound('deathByMob', { volume: 0.9 });
    import('../systems/deathSystem.js').then(({ killPlayer }) => {
      state._deathCause = 'mob';
      killPlayer(state);
    });
  } else {
    playSound('damagePlayer', { volume: 0.75, duration: 1.0 });
  }
}

function _flashShield(state) {
  const holder = state.viewShieldHolder;
  if (!holder) return;
  holder.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const mat = child.material;
    const origEmissive = mat.emissive?.getHex() ?? 0x000000;
    const origIntensity = mat.emissiveIntensity ?? 0;
    mat.emissive?.setHex(0xffffff);
    mat.emissiveIntensity = 1.2;
    setTimeout(() => {
      mat.emissive?.setHex(origEmissive);
      mat.emissiveIntensity = origIntensity;
    }, 120);
  });
  playSound('shieldEquip', { volume: 0.8 });
}

function _breakShield(state) {
  if (state.shieldBroken) return;
  state.shieldBroken     = true;
  state.hasShield        = false;
  state.isShieldEquipped = false;
  state.isBlocking       = false;
  if (state.viewShieldHolder) state.viewShieldHolder.visible = false;
  import('../ui/inventory.js').then(({ removeFromInventory, ITEM_TYPES }) => {
    removeFromInventory(state, ITEM_TYPES.SHIELD);
  });
  import('../systems/audioManager.js').then(({ playSound }) => {
    playSound('woodDestroy', { volume: 0.5 });
  });
}

// ── Lifebar (invariata) ───────────────────────────────────────────────────────
export function updatePlayerHealthBar(hp, maxHp) {
  const fill = document.getElementById('player-hp-fill');
  if (fill) fill.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
}

export function updateMobHealthBar(hp, maxHp) {
  const fill = document.getElementById('mob-hp-fill');
  if (fill) fill.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
}

export function showMobHealthBar() {
  const bar = document.getElementById('mob-hp-bar');
  if (bar) bar.style.opacity = '1';
}

export function hideMobHealthBar() {
  const bar = document.getElementById('mob-hp-bar');
  if (bar) bar.style.opacity = '0';
}

export function showPlayerHealthBar() {
  const bar = document.getElementById('player-hp-bar');
  if (bar) bar.style.opacity = '1';
}

function regenAndHidePlayerBar(state) {
  const MAX_HP     = state.playerHPMax ?? 100;
  const REGEN_TIME = 2.0;
  const HIDE_DELAY = 800;
  const TICK_MS    = 30;

  const startHP   = state.playerHP ?? MAX_HP;
  const hpToRegen = MAX_HP - startHP;
  const steps     = Math.ceil((REGEN_TIME * 1000) / TICK_MS);
  const hpPerStep = hpToRegen / steps;
  let   step      = 0;

  const interval = setInterval(() => {
    step++;
    state.playerHP = Math.min(MAX_HP, startHP + hpPerStep * step);
    updatePlayerHealthBar(state.playerHP, MAX_HP);
    if (step >= steps) {
      clearInterval(interval);
      state.playerHP = MAX_HP;
      updatePlayerHealthBar(MAX_HP, MAX_HP);
      setTimeout(() => {
        const bar = document.getElementById('player-hp-bar');
        if (bar) bar.style.opacity = '0';
      }, HIDE_DELAY);
    }
  }, TICK_MS);
}

function shouldPlayAttackSound(state) {
    return !(state.isBlocking && state.isShieldEquipped && !state.shieldBroken);
}


// Helper locale: applica riduzione scudo prima di chiamare damagePlayer
function dealDamageToPlayer(state, rawDamage) {
  if (state.isBlocking && state.hasShield && state.isShieldEquipped) {
    const SHIELD_BLOCK_MULTIPLIER = 0.35; // riduce al 35% → quasi dimezza
    const reduced = Math.max(1, Math.floor(rawDamage * SHIELD_BLOCK_MULTIPLIER));
    damagePlayer(state, reduced);
    // Opzionale: piccolo feedback visivo anche quando blocchi
    triggerDamageVignette?.();
  } else {
    damagePlayer(state, rawDamage);
  }
}
