import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareHighlightMaterials, applyHighlight } from '../systems/highlight.js';

const PAPER_POSITION = new THREE.Vector3(0.2, 0.05, 0.9);
const PAPER_SCALE    = 0.005;

const PAPER_TEXT = `"Traveler,

If you are reading these words, it means that
you woke up from a deep sleep.

The lever will not work until the barrel is
reduced to splinters.

The torches must burn before the door opens.

Don't stop. The way out exists.
PS: Prepare to fight total darkness.

— The Dungeon Architect"`;


// ── Audio ──────────────────────────────────────────────────────────────────
// Carica il buffer una sola volta e lo riusa ad ogni chiamata.
// Usiamo la Web Audio API nativa: nessuna dipendenza da THREE.Audio,
// e ci permette di specificare offset (2s) e duration (1s) esatti.
let _paperAudioBuffer = null;
let _paperAudioCtx    = null;

function getPaperAudioContext() {
  if (!_paperAudioCtx) {
    _paperAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _paperAudioCtx;
}

async function preloadPaperSound() {
  if (_paperAudioBuffer) return;
  try {
    const ctx      = getPaperAudioContext();
    const response = await fetch('./assets/audio/paper_sound.mp3');
    const arrayBuf = await response.arrayBuffer();
    _paperAudioBuffer = await ctx.decodeAudioData(arrayBuf);
  } catch (err) {
    console.warn('[paper] Errore caricamento audio:', err);
  }
}

// Riproduce dal secondo 2 al secondo 3 (duration = 1s)
function playPaperSound() {
  if (!_paperAudioBuffer) return;
  try {
    const ctx    = getPaperAudioContext();
    // Resume necessario: il browser blocca AudioContext finché non c'è interazione utente
    if (ctx.state === 'suspended') ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = _paperAudioBuffer;
    source.connect(ctx.destination);
    source.start(0, 2, 0.5);   // offset=2s, duration=0.5s → riproduce [2s → 2.5s]
  } catch (err) {
    console.warn('[paper] Errore riproduzione audio:', err);
  }
}
// ──────────────────────────────────────────────────────────────────────────


// ── Overlay DOM ────────────────────────────────────────────────────────────
let _overlayEl = null;

function createPaperOverlay() {
  if (_overlayEl) return;

  _overlayEl = document.createElement('div');
  Object.assign(_overlayEl.style, {
    position:      'fixed',
    top:           '50%',
    left:          '50%',
    transform:     'translate(-50%, -50%)',
    width:         'min(480px, 88vw)',
    padding:       '32px 36px',
    background:    'rgba(10, 8, 5, 0.82)',
    border:        '1px solid rgba(245, 220, 150, 0.25)',
    borderRadius:  '6px',
    color:         '#e8d9b0',
    fontFamily:    '"Palatino Linotype", Palatino, Georgia, serif',
    fontSize:      '15px',
    lineHeight:    '1.75',
    whiteSpace:    'pre-line',
    textAlign:     'left',
    zIndex:        '30',
    pointerEvents: 'none',
    display:       'none',
    boxShadow:     '0 8px 40px rgba(0,0,0,0.7)',
    letterSpacing: '0.01em'
  });

  document.body.appendChild(_overlayEl);
}

function showPaperOverlay() {
  if (_overlayEl) {
    _overlayEl.textContent = PAPER_TEXT;
    _overlayEl.style.display = 'block';
  }
}

function hidePaperOverlay() {
  if (_overlayEl) _overlayEl.style.display = 'none';
}

// ── Interactable object ────────────────────────────────────────────────────
function makePaperInteractable(meshes, state) {
  const highlightMats = prepareHighlightMaterials(meshes);

  const interactable = {
    setHighlightT: (t) => applyHighlight(highlightMats, t),

    getPrompt() {
      return state.isReading ? 'Press E to stop reading' : 'Press E to read the paper';
    },

    canInteract() { return true; },

    interact() {
      // Usa solo state.isReading — nessuna variabile locale separata
      if (state.isReading) {
        stopReading(state);
        
      } else {
        showPaperOverlay();
        state.isReading = true;
        playPaperSound();
      }
    }
  };

  for (const mesh of meshes) {
    mesh.userData.interactable = interactable;
    state.interactableMeshes.push(mesh);
  }
}

export function stopReading(state) {
  hidePaperOverlay();
  state.isReading = false;
  playPaperSound();
}

// ── Entry point ────────────────────────────────────────────────────────────
export function createPaper(scene, state) {
  createPaperOverlay();
  preloadPaperSound();

  const loader = new GLTFLoader();

  loader.load(
    'assets/models/paper/scene.gltf',
    (gltf) => {
      const root = gltf.scene;

      root.scale.setScalar(PAPER_SCALE);
      root.position.copy(PAPER_POSITION);
      root.rotation.y = -Math.PI / 2;

      const meshes = [];
      root.traverse((child) => {
        if (child.isMesh) {
          child.receiveShadow = true;
          child.castShadow    = false;
          meshes.push(child);
        }
      });

      scene.add(root);
      makePaperInteractable(meshes, state);
    },
    undefined,
    (error) => { console.error('Errore caricamento paper.gltf:', error); }
  );
}

