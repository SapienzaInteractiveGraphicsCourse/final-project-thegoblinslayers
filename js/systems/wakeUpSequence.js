// js/systems/wakeUpSequence.js

import * as THREE from 'three';

const WAKEUP_PHASES = {
  SLEEP:        'sleep',
  EYES_OPENING: 'eyes_opening',
  //CAM_ROTATE:   'cam_rotate',
  //CAM_PAUSE:    'cam_pause',
  DONE:         'done'
};

const EYES_OPEN_DURATION  = 1.6;
// const CAM_PAUSE_DURATION   = 1.5;
//const CAM_ROTATE_DURATION = 1.8;

const PITCH_START = 0;
//const PITCH_END   = 0;

// ── Audio ─────────────────────────────────────────────────────────────────────
let _audioLoader   = null;
let _sleepSound    = null;   // Voicy_Wake_up.mp3  — loop durante SLEEP
let _wakeSound     = null;   // Man_waking_up.mp3  — primi 2.5s all'apertura occhi
let _whereSound    = null;   // Voicy_Where_am_i.mp3 — una volta a camera ferma
let _wakeCutTimer  = null;   // setTimeout per stoppare Man_waking_up a 2.5s

// ── Overlay canvas ────────────────────────────────────────────────────────────
let overlayCanvas = null;
let overlayCtx    = null;

function createOverlayCanvas() {
  overlayCanvas = document.createElement('canvas');
  overlayCanvas.id = 'wakeup-overlay';
  overlayCanvas.style.cssText = `
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 100;
  `;
  document.body.appendChild(overlayCanvas);
  resizeOverlayCanvas();
  window.addEventListener('resize', resizeOverlayCanvas);
  overlayCtx = overlayCanvas.getContext('2d');
  drawFullBlack();
}

function resizeOverlayCanvas() {
  if (!overlayCanvas) return;
  overlayCanvas.width  = window.innerWidth;
  overlayCanvas.height = window.innerHeight;
  if (_phase === WAKEUP_PHASES.SLEEP) drawFullBlack();
}

function drawEyeVignette(progress) {
  if (!overlayCtx) return;
  const w  = overlayCanvas.width;
  const h  = overlayCanvas.height;
  const cx = w / 2;
  const cy = h / 2;

  const maxRadius   = Math.sqrt(cx * cx + cy * cy) * 1.05;
  const eased       = easeOutCubic(Math.min(progress, 1));
  const clearRadius = eased * maxRadius;

  overlayCtx.clearRect(0, 0, w, h);
  if (progress >= 1) return;

  overlayCtx.fillStyle = 'rgba(0,0,0,1)';
  overlayCtx.fillRect(0, 0, w, h);

  overlayCtx.save();
  overlayCtx.globalCompositeOperation = 'destination-out';

  const edgeSize = Math.min(40, clearRadius * 0.15);
  const grad = overlayCtx.createRadialGradient(
    cx, cy, Math.max(0, clearRadius - edgeSize),
    cx, cy, clearRadius
  );
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  overlayCtx.fillStyle = grad;
  overlayCtx.beginPath();
  overlayCtx.arc(cx, cy, clearRadius, 0, Math.PI * 2);
  overlayCtx.fill();
  overlayCtx.restore();
}

function drawFullBlack() {
  if (!overlayCtx) return;
  overlayCtx.fillStyle = '#000';
  overlayCtx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

function clearOverlay() {
  if (!overlayCtx) return;
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

// ── Sleep screen ──────────────────────────────────────────────────────────────
let sleepScreen = null;

function createSleepScreen() {
  sleepScreen = document.createElement('div');
  sleepScreen.id = 'sleep-screen';
  sleepScreen.style.cssText = `
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 101;
    font-family: 'Georgia', serif;
    pointer-events: none;
    background: transparent;
  `;

  const hint = document.createElement('p');
  hint.id = 'wakeup-hint';
  hint.textContent = 'Press E to wake up';
  hint.style.cssText = `
    color: rgba(255,255,255,0.0);
    font-size: clamp(1rem, 2vw, 1.4rem);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    animation: wakeup-fadein 2s ease-out 1.2s forwards;
    user-select: none;
  `;
  sleepScreen.appendChild(hint);

  const style = document.createElement('style');
  style.textContent = `
    @keyframes wakeup-fadein {
      from { color: rgba(255,255,255,0); }
      to   { color: rgba(255,255,255,0.75); }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(sleepScreen);
}

function removeSleepScreen() {
  sleepScreen?.remove();
  sleepScreen = null;
}

// ── Easing ────────────────────────────────────────────────────────────────────
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
/*function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}*/

// ── Stato interno ─────────────────────────────────────────────────────────────
let _phase      = WAKEUP_PHASES.SLEEP;
let _eyesTimer  = 0;
let _pauseTimer = 0;
//let _camTimer   = 0;
let _onComplete = null;
let _state      = null;

// ── Audio helpers ─────────────────────────────────────────────────────────────

/**
 * Crea un THREE.Audio agganciato all'AudioListener del gameState.
 * Restituisce l'oggetto Audio pronto per play/stop.
 */
let _sleepBuffer = null;   // buffer Voicy_Wake_up — salvato per retry
let _sleepStartPending = false; // true se dobbiamo avviare il loop appena possibile

function makeSound(buffer, { loop = false, volume = 1.0 } = {}) {
  if (!_state?.audioListener) return null;
  const sound = new THREE.Audio(_state.audioListener);
  sound.setBuffer(buffer);
  sound.setLoop(loop);
  sound.setVolume(volume);
  return sound;
}

function loadWakeUpAudio() {
  if (!_state?.audioListener) return;
  _audioLoader = new THREE.AudioLoader();

  _audioLoader.load('./assets/audio/Voicy_Wake_up.mp3', (buffer) => {
    _sleepBuffer = buffer;
    _sleepSound  = makeSound(buffer, { loop: true, volume: 0.6 });

    if (_phase === WAKEUP_PHASES.SLEEP) {
      // Tenta il play — potrebbe fallire se il context è ancora sospeso
      try {
        const ctx = _state.audioListener.context;
        if (ctx.state === 'suspended') {
          // Context sospeso: segna come pending, il play avverrà al primo gesto
          _sleepStartPending = true;
          ctx.resume().then(() => {
            if (_phase === WAKEUP_PHASES.SLEEP && _sleepSound && !_sleepSound.isPlaying) {
              _sleepSound.play();
              _sleepStartPending = false;
            }
          });
        } else {
          _sleepSound.play();
        }
      } catch(e) {
        _sleepStartPending = true;
      }
    }
  });

  _audioLoader.load('./assets/audio/Man_waking_up.mp3', (buffer) => {
    _wakeSound = makeSound(buffer, { loop: false, volume: 0.8 });
  });

  _audioLoader.load('./assets/audio/Voicy_Where_am_i.mp3', (buffer) => {
    _whereSound = makeSound(buffer, { loop: false, volume: 0.15 }); // ← volume abbassato
  });
}

function playSleepToWake() {
  // Se il loop era pending (context sospeso), non è mai partito — nessun problema
  _sleepStartPending = false;

  if (_sleepSound?.isPlaying) _sleepSound.stop();

  if (_wakeSound) {
    if (_wakeSound.isPlaying) _wakeSound.stop();
    // Assicura che il context sia sbloccato (E = gesto utente → context ora attivo)
    const ctx = _state?.audioListener?.context;
    const doPlay = () => {
      _wakeSound.play();
      if (_wakeCutTimer) clearTimeout(_wakeCutTimer);
      _wakeCutTimer = setTimeout(() => {
        if (_wakeSound?.isPlaying) _wakeSound.stop();
        _wakeCutTimer = null;
      }, 2500);
    };
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(doPlay);
    } else {
      doPlay();
    }
  }
}

function playWhereAmI() {
  if (_whereSound) {
    if (_whereSound.isPlaying) _whereSound.stop();
    _whereSound.play();
  }
}

function disposeWakeUpAudio() {
  if (_wakeCutTimer) { clearTimeout(_wakeCutTimer); _wakeCutTimer = null; }
  _sleepStartPending = false;
  if (_sleepSound?.isPlaying) _sleepSound.stop();
  if (_wakeSound?.isPlaying)  _wakeSound.stop();
}

// ── API pubblica ──────────────────────────────────────────────────────────────

export function initWakeUpSequence(gameState, onComplete) {
  _state      = gameState;
  _onComplete = onComplete;
  _phase      = WAKEUP_PHASES.SLEEP;

  _state.wakeUpDone = false;
  _state.pitch      = PITCH_START;

  createOverlayCanvas();
  createSleepScreen();

  // Carica i 3 audio (asincrono — il loop parte appena pronto)
  loadWakeUpAudio();

  function onKeyDown(e) {
    if (_phase !== WAKEUP_PHASES.SLEEP) return;
    if (e.code === 'KeyE') {
      document.removeEventListener('keydown', onKeyDown);
      _beginWakeUp();
    }
  }
  document.addEventListener('keydown', onKeyDown);
}

function _beginWakeUp() {
  removeSleepScreen();

  // E = primo gesto utente → sblocca AudioContext se sospeso
  // Questo garantisce anche il retry del sleep loop se era pending
  const ctx = _state?.audioListener?.context;
  const proceed = () => {
    // Se il loop non era ancora partito per via del context sospeso, avvialo ora
    // (verrà subito stoppato da playSleepToWake — ma almeno il context è sbloccato)
    playSleepToWake();
  };

  if (ctx && ctx.state === 'suspended') {
    ctx.resume().then(proceed);
  } else {
    proceed();
  }

  _phase     = WAKEUP_PHASES.EYES_OPENING;
  _eyesTimer = 0;
}

export function updateWakeUpSequence(deltaTime) {
  if (!_state) return;
  if (_phase === WAKEUP_PHASES.DONE) return;

  if (_phase === WAKEUP_PHASES.SLEEP) {
    _state.pitch = PITCH_START;
    return;
  }

  if (_phase === WAKEUP_PHASES.EYES_OPENING) {
    _eyesTimer = Math.min(_eyesTimer + deltaTime, EYES_OPEN_DURATION);
    drawEyeVignette(_eyesTimer / EYES_OPEN_DURATION);
    _state.pitch = PITCH_START;

    if (_eyesTimer >= EYES_OPEN_DURATION) {
      clearOverlay();
      _phase            = WAKEUP_PHASES.DONE;
      _state.pitch      = PITCH_START;
      _state.wakeUpDone = true;

      overlayCanvas?.remove();
      overlayCanvas = null;
      overlayCtx    = null;

      disposeWakeUpAudio();
      playWhereAmI();
      _onComplete?.();
    }
    return;
  }
}